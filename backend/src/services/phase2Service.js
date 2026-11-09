import * as contractProgressService from './contractProgressService.js';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import * as assignmentModel from '../models/assignmentModel.js';
import * as employeeModel from '../models/employeeModel.js';
import * as laborRequestModel from '../models/laborRequestModel.js';
import * as documentTypeModel from '../models/documentTypeModel.js';
import * as supplierUserModel from '../models/supplierUserModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import * as deliveryModel from '../models/deliveryModel.js';
import * as documentDownloadService from './documentDownloadService.js';
import { getDeclarationItems, isDeadlineClosed } from './assignmentService.js';
import * as producers from '../events/producers.js';
import { groupDeliveriesBySlot, slotKey, toSupplierDelivery } from './deliveryService.js';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES, AUDIT_ENTITIES } from '../constants/audit.js';
import { DOCUMENT_CATEGORIES, EMPLOYEE_DOCUMENT_CATEGORIES } from '../constants/documentCategories.js';
import { ASSIGNMENT_STATUSES, DECLARATION_MAX_EMPLOYEES, LABOR_REQUEST_STATUSES } from '../constants/laborRequest.js';
import { isBlank, toInteger } from '../utils/parse.js';
import { parseLocalDate, startOfToday } from '../utils/dates.js';
import { getUploadBaseDir } from '../utils/uploadPaths.js';

// Validação automática (API pública / IA via N8N) desligada por enquanto: o RH baixa o documento,
// valida no portal externo e muda o status à mão. O documento entra como Pendente. Para voltar a
// usar, chamar triggerDocumentValidation (documentValidationService) depois de gravar o envio.

// Depois do prazo dos documentos iniciais, só dá para reenviar o que o RH devolveu
const RESENDABLE_STATUSES = [3, 4]; // Reprovado, Reenvio Necessário
const DEADLINE_CLOSED_MESSAGE =
    'O prazo dos documentos encerrou. Agora só dá para reenviar documentos reprovados ou com reenvio necessário.';

const COMPANY_DOCUMENT_CHOICE_ERROR =
    'Escolha, para cada arquivo, um dos documentos da empresa exigidos nesta solicitação.';

// Mensagens do vínculo que não está ativo (ainda sem declaração, bloqueado ou encerrado)
const ASSIGNMENT_NOT_ACTIVE = {
    [ASSIGNMENT_STATUSES.WAITING_SUPPLIER]: 'Preencha a declaração e assine o termo antes de enviar os documentos.',
    [ASSIGNMENT_STATUSES.BLOCKED]: 'Este convite está pausado: a empresa declarou não ter um documento exigido. Aguarde o contato do setor de Compras.',
    [ASSIGNMENT_STATUSES.ENDED]: 'Este convite foi encerrado pelo setor de Compras.',
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Depois do prazo: o documento atual está reprovado ou com reenvio necessário? */
async function canResendAfterDeadline({ supplierId, laborRequestId, documentTypeId, employeeId = null }) {
    const status = await deliveryModel.getCurrentDeliveryStatus({ supplierId, laborRequestId, documentTypeId, employeeId });
    return RESENDABLE_STATUSES.includes(status);
}

/**
 * Validade de um documento conforme o tipo. Com validade (has_expiration): a data é
 * obrigatória, tem de ser válida e não pode ser passada. Sem validade: é ignorada (NULL).
 * Retorna { value } (Date local ou null) ou { error }.
 */
export function resolveExpiration(documentType, expiresAt) {
    if (!documentType.has_expiration) return { value: null };
    if (isBlank(expiresAt)) return { error: 'Informe a validade do documento.' };

    const date = parseLocalDate(expiresAt);
    if (!date) return { error: 'Data de validade inválida.' };
    if (date < startOfToday()) return { error: 'A validade não pode ser uma data passada.' };
    return { value: date };
}

/**
 * Nome original do arquivo enviado. O multer 1.x lê o nome como Latin-1, mas o navegador
 * envia em UTF-8: sem isto, 'Relatório.pdf' seria gravado como 'RelatÃ³rio.pdf'. Se a
 * conversão não der um UTF-8 válido, mantém o nome como veio.
 */
function originalFileName(file) {
    const name = file.originalname ?? '';
    const utf8Name = Buffer.from(name, 'latin1').toString('utf8');
    return utf8Name.includes('�') ? name : utf8Name;
}

/** Gera hash SHA-256 de um Buffer. */
function hashBuffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Garante que o diretório de uploads existe. */
function ensureUploadDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/** Data de hoje no formato YYYY-MM-DD para organizar pastas por dia de upload. */
function todayFolder() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Sanitiza a razão social para uso seguro em nome de pasta:
 * remove acentos, troca caracteres inválidos por '_' e limita o tamanho.
 */
function sanitizeForFolder(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')       // remove acentos
        .replace(/[^a-zA-Z0-9-_ ]/g, '')       // remove caracteres inválidos
        .trim()
        .replace(/\s+/g, '_')                  // espaços → _
        .slice(0, 60);
}

/**
 * Monta o diretório destino organizado por escopo, fornecedor e data de upload.
 *   uploads/<scope>/<supplierId>-<razaoSocial>/<YYYY-MM-DD>/
 *
 * @param {'employees'|'company'} scope
 * @param {number} supplierId
 * @param {string} supplierName  — razão social (usada no nome da pasta)
 * @returns {{ absDir: string, baseDir: string }}
 */
function buildUploadDir(scope, supplierId, supplierName) {
    const baseDir = getUploadBaseDir();
    const folderName = supplierName
        ? `${supplierId}-${sanitizeForFolder(supplierName)}`
        : String(supplierId);
    const absDir = path.join(baseDir, scope, folderName, todayFolder());
    ensureUploadDir(absDir);
    return { absDir, baseDir };
}

/**
 * Persiste um arquivo enviado no disco de forma organizada e registra no banco.
 * Retorna o document_id gerado.
 *
 * @param {object}   transaction
 * @param {string}   scope         — 'employees' | 'company'
 * @param {object}   file          — item de req.files (multer memoryStorage)
 * @param {object}   docData       — { supplierId, supplierName, documentTypeId, laborRequestId, employeeId,
 *                                   expiresAt, referenceMonth } (expiresAt / referenceMonth: Date local ou null)
 * @param {string[]} savedPaths    — acumulador para rollback de arquivos
 */
export async function persistFile(transaction, scope, file, docData, savedPaths) {
    const {
        supplierId, supplierName, documentTypeId, laborRequestId,
        employeeId = null, expiresAt = null, referenceMonth = null,
    } = docData;

    const { absDir, baseDir } = buildUploadDir(scope, supplierId, supplierName);

    const originalName = originalFileName(file);
    const fileHash = hashBuffer(file.buffer);
    const ext = path.extname(originalName).toLowerCase();
    const savedFileName = `${fileHash}${ext}`;
    const savedFilePath = path.join(absDir, savedFileName);
    const relPath = path.relative(baseDir, savedFilePath);

    fs.writeFileSync(savedFilePath, file.buffer);
    savedPaths.push(savedFilePath);

    const docId = await employeeModel.insertDocument(transaction, {
        supplierId,
        documentTypeId,
        laborRequestId,
        employeeId,
        fileName: originalName,
        filePath: relPath,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
        fileHash,
        expiresAt,
        referenceMonth,
    });

    return docId;
}

/** Remove os arquivos gravados quando a transação do banco falha. */
export function removeSavedFiles(savedPaths) {
    for (const filePath of savedPaths) {
        try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    }
}

/**
 * Vínculo do link (/fase2/<token>) que pertence ao fornecedor logado.
 * Retorna { assignment } ou { error: { status, message } }.
 */
async function loadOwnAssignment(token, supplierId) {
    const assignment = await assignmentModel.getByToken(token);
    if (!assignment) return { error: { status: 404, message: 'Link inválido.' } };
    if (assignment.status === ASSIGNMENT_STATUSES.ENDED) {
        return { error: { status: 410, message: ASSIGNMENT_NOT_ACTIVE[ASSIGNMENT_STATUSES.ENDED] } };
    }
    if (assignment.supplier_id !== Number(supplierId)) {
        return { error: { status: 403, message: 'Este link é de outro fornecedor.' } };
    }
    return { assignment };
}

/** Vínculo do fornecedor já ativo (declarou e assinou): só assim recebe documentos. */
export async function loadActiveAssignment(token, supplierId) {
    const loaded = await loadOwnAssignment(token, supplierId);
    if (loaded.error) return loaded;
    if (loaded.assignment.status !== ASSIGNMENT_STATUSES.ACTIVE) {
        return { error: { status: 400, message: ASSIGNMENT_NOT_ACTIVE[loaded.assignment.status] } };
    }
    return loaded;
}

/** Vínculo como o fornecedor vê (sem token, sem dados internos de Compras). */
function supplierAssignmentView(assignment) {
    return {
        status: assignment.status,
        deadlineAt: assignment.deadline_at,
        isExpired: isDeadlineClosed(assignment),
        declaredAt: assignment.declared_at,
        declaredByName: assignment.declared_by_name ?? null,
        blockedAt: assignment.blocked_at,
        laborRequestId: assignment.labor_request_id,
        laborRequestTitle: assignment.labor_request_title,
        laborRequestLocation: assignment.labor_request_location,
        laborRequestStartDate: assignment.labor_request_start_date,
        laborRequestStatus: assignment.labor_request_status,
        contractNumber: assignment.contract_number,
        supplierName: assignment.supplier_name,
    };
}

// ─────────────────────────────────────────────
// Abrir o contrato pelo link
// ─────────────────────────────────────────────

/**
 * Dados do contrato (vínculo) pelo link, para o fornecedor logado:
 *  - convite ainda sem fornecedor (e-mail sem cadastro): vincula ao fornecedor que abriu;
 *  - aguardando: o que declarar (documentos da empresa e de colaborador exigidos);
 *  - bloqueado: a declaração (o que faltou);
 *  - ativo: a declaração, os colaboradores, os documentos enviados (com histórico) e os
 *    tipos que ele pode enviar.
 * O `deadline` mantém os nomes antigos (expires_at, labor_request_title...) para a tela.
 */
export async function getPhase2ByToken(token, supplierId) {
    try {
        let assignment = await assignmentModel.getByToken(token);
        if (!assignment) {
            return { success: false, status: 404, message: 'Link inválido.' };
        }

        // Convite feito para um e-mail que ainda não tinha cadastro: fica com quem abriu o link
        if (!assignment.supplier_id && assignment.status === ASSIGNMENT_STATUSES.WAITING_SUPPLIER) {
            await assignmentModel.claim(assignment.id, Number(supplierId));
            assignment = await assignmentModel.getByToken(token);
        }

        const loaded = await loadOwnAssignment(token, supplierId);
        if (loaded.error) return { success: false, ...loaded.error };
        assignment = loaded.assignment;

        const laborRequestId = assignment.labor_request_id;
        const [declaration, declarationItems] = await Promise.all([
            assignmentModel.getDeclaration(assignment.id),
            getDeclarationItems(laborRequestId),
        ]);

        const view = supplierAssignmentView(assignment);
        const deadline = {
            expires_at: assignment.deadline_at,
            isExpired: view.isExpired,
            labor_request_id: laborRequestId,
            labor_request_title: assignment.labor_request_title,
            contract_number: assignment.contract_number,
            supplier_name: assignment.supplier_name,
        };
        const base = { assignment: view, deadline, declaration, declarationItems };

        if (assignment.status !== ASSIGNMENT_STATUSES.ACTIVE) {
            return { success: true, body: base };
        }

        const [
            employees,
            documents,
            requiredDocs,
            requiredNrTypes,
            employeeDocumentTypes,
            companyDocumentTypes,
            deliveries,
        ] = await Promise.all([
            employeeModel.getEmployeesBySupplierAndRequest(assignment.supplier_id, laborRequestId),
            employeeModel.getDocumentsBySupplierAndRequest(assignment.supplier_id, laborRequestId),
            // Documentos obrigatórios definidos por Segurança do Trabalho
            laborRequestModel.getLaborRequestDocuments(laborRequestId),
            // NRs obrigatórias definidas por Segurança do Trabalho para a atividade
            laborRequestModel.getLaborRequestNrs(laborRequestId),
            // Tipos ativos de documento de colaborador, com `required` para esta solicitação
            documentTypeModel.getEmployeeDocumentTypesForRequest(laborRequestId),
            // Tipos de documento da empresa exigidos nesta solicitação
            documentTypeModel.getRequiredCompanyDocumentTypes(laborRequestId),
            // Todas as entregas (atuais e antigas), para o histórico de cada documento
            deliveryModel.listSupplierDeliveries(assignment.supplier_id, laborRequestId),
        ]);

        // Cada documento atual ganha a versão, a observação do RH e o histórico de entregas
        const deliveriesBySlot = groupDeliveriesBySlot(deliveries);
        const withHistory = (document) => {
            const history = (deliveriesBySlot.get(slotKey(document)) ?? []).map(toSupplierDelivery);
            const current = history.find((delivery) => delivery.id === document.id);
            return {
                ...document,
                version: current?.version ?? 1,
                observation: current?.observation ?? null,
                history,
            };
        };

        return {
            success: true,
            body: {
                ...base,
                employees: employees.map((employee) => ({
                    ...employee,
                    documents: (employee.documents ?? []).map((document) =>
                        withHistory({ ...document, employee_id: employee.id })),
                })),
                documents: documents.map(withHistory),
                requiredDocuments: requiredDocs,
                requiredNrTypes,
                employeeDocumentTypes,
                companyDocumentTypes,
            },
        };
    } catch (error) {
        console.error('getPhase2ByToken error:', error);
        return { success: false, status: 500, message: 'Erro ao abrir o contrato.' };
    }
}

// ─────────────────────────────────────────────
// Declaração e termo de aceite
// ─────────────────────────────────────────────

/**
 * O fornecedor declara, para cada documento exigido:
 *  - da empresa: se tem (hasDocument: true / false);
 *  - de colaborador (NR e outros): quantos funcionários têm (employeeCount, inteiro ≥ 1);
 * e assina o termo (termAccepted: true). A assinatura grava quem, quando, IP e navegador.
 *
 * Se faltar algum documento da empresa, o convite fica bloqueado (a solicitação também) e
 * Compras é avisado; senão o fornecedor passa a enviar os documentos.
 *
 * @param {{ supplierId, supplierUserId, name }} supplier — fornecedor logado
 * @param {{ companyDocuments: [{ documentTypeId, hasDocument }],
 *           employeeDocuments: [{ documentTypeId, employeeCount }], termAccepted }} payload
 * @param {{ ipAddress, userAgent }} context
 */
export async function submitDeclaration(token, supplier, payload = {}, context = {}) {
    const loaded = await loadOwnAssignment(token, supplier.supplierId);
    if (loaded.error) return { success: false, ...loaded.error };
    const { assignment } = loaded;

    if (assignment.status !== ASSIGNMENT_STATUSES.WAITING_SUPPLIER) {
        return { success: false, status: 409, message: 'A declaração deste contrato já foi enviada.' };
    }
    // Contrato concluído (ou cancelado) enquanto o convite esperava: não há mais o que declarar
    if ([LABOR_REQUEST_STATUSES.CONCLUDED, LABOR_REQUEST_STATUSES.CANCELED].includes(assignment.labor_request_status)) {
        return { success: false, status: 409, message: 'O contrato desta solicitação já foi concluído.' };
    }
    if (payload.termAccepted !== true) {
        return { success: false, status: 400, message: 'Leia e assine o termo de aceite para continuar.' };
    }

    const items = await getDeclarationItems(assignment.labor_request_id);
    const company = Array.isArray(payload.companyDocuments) ? payload.companyDocuments : null;
    const employee = Array.isArray(payload.employeeDocuments) ? payload.employeeDocuments : null;
    if (!company || !employee) {
        return { success: false, status: 400, message: 'Declaração inválida.' };
    }

    // Empresa: uma resposta (tem / não tem) para cada documento exigido, e só para eles
    const companyAnswers = new Map();
    for (const answer of company) {
        const typeId = toInteger(answer?.documentTypeId);
        if (!items.company.some((item) => item.id === typeId) || typeof answer.hasDocument !== 'boolean') {
            return { success: false, status: 400, message: 'Declaração dos documentos da empresa inválida.' };
        }
        companyAnswers.set(typeId, answer.hasDocument);
    }
    const missingCompany = items.company.filter((item) => !companyAnswers.has(item.id));
    if (missingCompany.length > 0) {
        return { success: false, status: 400, message: `Responda se a empresa tem: ${missingCompany.map((item) => item.name).join(', ')}.` };
    }

    // Colaboradores: quantos funcionários têm cada documento exigido (no mínimo 1)
    const employeeAnswers = new Map();
    for (const answer of employee) {
        const typeId = toInteger(answer?.documentTypeId);
        const count = toInteger(answer?.employeeCount);
        if (!items.employee.some((item) => item.id === typeId)) {
            return { success: false, status: 400, message: 'Declaração dos documentos dos colaboradores inválida.' };
        }
        if (!Number.isInteger(count) || count < 1 || count > DECLARATION_MAX_EMPLOYEES) {
            const name = items.employee.find((item) => item.id === typeId)?.name ?? 'documento';
            return { success: false, status: 400, message: `Informe quantos funcionários têm "${name}" (no mínimo 1).` };
        }
        employeeAnswers.set(typeId, count);
    }
    const missingEmployee = items.employee.filter((item) => !employeeAnswers.has(item.id));
    if (missingEmployee.length > 0) {
        return {
            success: false,
            status: 400,
            message: `Informe quantos funcionários têm: ${missingEmployee.map((item) => item.name).join(', ')}.`,
        };
    }

    const missingDocuments = items.company.filter((item) => companyAnswers.get(item.id) === false);
    const blocked = missingDocuments.length > 0;
    const status = blocked ? ASSIGNMENT_STATUSES.BLOCKED : ASSIGNMENT_STATUSES.ACTIVE;

    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            await assignmentModel.saveDeclaration(transaction, assignment.id, [
                ...[...companyAnswers].map(([documentTypeId, hasDocument]) => ({ documentTypeId, hasDocument })),
                ...[...employeeAnswers].map(([documentTypeId, employeeCount]) => ({ documentTypeId, employeeCount })),
            ]);
            const declared = await assignmentModel.markDeclared(transaction, assignment.id, {
                status,
                declaredBy: supplier.supplierUserId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
            });
            if (!declared) throw Object.assign(new Error('Declaração já enviada.'), { conflict: true });

            if (blocked) {
                // Só bloqueia a solicitação que está Pendente de documentação: se ela mudou no meio do
                // caminho (ex.: concluída), a declaração inteira é desfeita
                const changed = await laborRequestModel.setStatusBySystem(
                    transaction, assignment.labor_request_id, LABOR_REQUEST_STATUSES.BLOCKED,
                    [LABOR_REQUEST_STATUSES.PENDING_DOCUMENTATION],
                );
                if (!changed) throw Object.assign(new Error('A solicitação mudou.'), { conflict: true });
                await producers.purchasingContractBlocked(transaction, {
                    assignment, missingDocuments, declaredBy: supplier.name ?? null,
                });
            }
            await auditModel.insertAuditLog(transaction, {
                actorType: AUDIT_ACTOR_TYPES.SUPPLIER,
                actorId: supplier.supplierId,
                action: AUDIT_ACTIONS.SUPPLIER_ASSIGNMENT_DECLARE,
                entityType: AUDIT_ENTITIES.LABOR_REQUEST,
                entityId: assignment.labor_request_id,
                oldValues: null,
                newValues: {
                    assignment_id: assignment.id,
                    status,
                    signed_by: supplier.name ?? null,
                    missing_documents: missingDocuments.map((item) => item.name),
                },
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            });
            // Reenvio para o mesmo fornecedor com tudo já aprovado (ou nada a enviar): o contrato
            // já está com a documentação completa
            if (!blocked) {
                await contractProgressService.advanceIfInitialDocumentationApproved(transaction, {
                    laborRequestId: assignment.labor_request_id,
                    supplierId: supplier.supplierId,
                });
            }
        });
    } catch (error) {
        if (error.conflict) {
            return { success: false, status: 409, message: 'O contrato mudou enquanto você declarava. Abra-o de novo.' };
        }
        console.error('submitDeclaration error:', error);
        return { success: false, status: 500, message: 'Erro ao enviar a declaração.' };
    }

    return {
        success: true,
        body: {
            status,
            blocked,
            missingDocuments: missingDocuments.map((item) => item.name),
            message: blocked
                ? 'Declaração enviada. Como falta documento da empresa, o convite ficou pausado e o setor de Compras foi avisado.'
                : 'Declaração e termo assinados. Agora envie os documentos.',
        },
    };
}

// ─────────────────────────────────────────────
// Cadastrar funcionário com documentos
// ─────────────────────────────────────────────

/**
 * Cadastra um funcionário com UM documento (um arquivo) de um tipo de colaborador
 * (básico, NR ou outros).
 *
 * Modelo "um documento por vez": cada envio associa o colaborador a um único tipo de
 * documento — assim sabemos exatamente qual arquivo é de qual documento e, mais tarde,
 * qual está faltando. Se o tipo é uma NR (categoria 2), a NR também é vinculada ao
 * colaborador em employee_nrs (certificate_doc_id = documento enviado, expiration_date
 * = validade).
 *
 * Se o colaborador já existir (mesmo CPF no mesmo fornecedor/solicitação),
 * reaproveitamos o registro e apenas adicionamos o novo documento.
 *
 * @param {string}   token      — token do link do contrato
 * @param {number}   supplierId — extraído do JWT do fornecedor
 * @param {object}   data       — { fullName, cpf, rg, roleFunction, documentTypeId, expiresAt ('YYYY-MM-DD') }
 * @param {File[]}   files      — arquivos enviados via multer (espera-se exatamente 1)
 */
export async function addEmployee(token, supplierId, data, files = []) {
    const { fullName, cpf, rg, roleFunction, documentTypeId, expiresAt } = data;

    if (!fullName || !cpf) {
        return { success: false, message: 'Nome completo e CPF são obrigatórios.' };
    }

    if (isBlank(documentTypeId)) {
        return { success: false, message: 'Selecione qual documento é este arquivo.' };
    }

    if (!files || files.length !== 1) {
        return { success: false, message: 'Envie exatamente um arquivo (o documento selecionado).' };
    }

    // Contrato ativo (declaração assinada); depois do prazo, só reenvio (conferido abaixo)
    const loaded = await loadActiveAssignment(token, supplierId);
    if (loaded.error) return { success: false, ...loaded.error };
    const { assignment } = loaded;
    const deadlineClosed = isDeadlineClosed(assignment);

    // Tipo de documento: ativo e de colaborador (básico, NR ou outros)
    const typeId = toInteger(documentTypeId);
    const documentType = Number.isInteger(typeId) && typeId > 0
        ? await documentTypeModel.getDocumentTypeById(typeId)
        : null;
    if (!documentType || !documentType.is_active || !EMPLOYEE_DOCUMENT_CATEGORIES.includes(documentType.category)) {
        return { success: false, message: 'Documento de colaborador inválido.' };
    }

    // Validade: obrigatória quando o tipo tem validade; senão é ignorada (NULL)
    const expiration = resolveExpiration(documentType, expiresAt);
    if (expiration.error) {
        return { success: false, message: expiration.error };
    }

    const isNr = documentType.category === DOCUMENT_CATEGORIES.EMPLOYEE_NR;

    let transaction;
    let transactionDone = false;
    const savedPaths = []; // para rollback de arquivos em caso de erro

    try {
        transaction = await trasaction.iniciarTransacao();

        // 1. Reaproveita o colaborador se já existir (mesmo CPF neste fornecedor/solicitação);
        //    caso contrário, insere um novo.
        let employeeId = await employeeModel.getEmployeeIdByCpf(
            transaction,
            supplierId,
            assignment.labor_request_id,
            cpf,
        );

        // Prazo encerrado: só reenvio de documento reprovado / reenvio necessário de colaborador já enviado
        if (deadlineClosed) {
            const allowed = employeeId && await canResendAfterDeadline({
                supplierId,
                laborRequestId: assignment.labor_request_id,
                documentTypeId: documentType.id,
                employeeId,
            });
            if (!allowed) {
                await trasaction.finalizarTransacao(transaction, false);
                transactionDone = true;
                return { success: false, message: DEADLINE_CLOSED_MESSAGE };
            }
        }

        if (!employeeId) {
            employeeId = await employeeModel.insertEmployee(transaction, {
                supplierId,
                laborRequestId: assignment.labor_request_id,
                fullName,
                cpf,
                rg,
                roleFunction,
            });
        }

        if (!employeeId) {
            await trasaction.finalizarTransacao(transaction, false);
            transactionDone = true;
            return { success: false, message: 'Erro ao cadastrar funcionário.' };
        }

        // 2. Salva o único arquivo, com o tipo escolhido e a validade, organizado por fornecedor e data
        //    uploads/employees/<supplierId>-<razaoSocial>/<YYYY-MM-DD>/<hash>.<ext>
        const docId = await persistFile(
            transaction,
            'employees',
            files[0],
            {
                supplierId,
                supplierName: assignment.supplier_name,
                documentTypeId: documentType.id,
                laborRequestId: assignment.labor_request_id,
                employeeId,
                expiresAt: expiration.value,
            },
            savedPaths,
        );

        // 3. NR: vincula a NR ao colaborador COM o certificado (mapeia qual arquivo é de qual NR)
        if (isNr) {
            await employeeModel.insertEmployeeNr(
                transaction,
                employeeId,
                documentType.nr_type_id,
                docId,
                expiration.value,
            );
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        console.log(`Colaborador ${employeeId} + documento tipo ${documentType.id} (doc ${docId}) enviado (supplier ${supplierId}).`);
        return { success: true, body: { employeeId, documentTypeId: documentType.id, documentId: docId } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        removeSavedFiles(savedPaths);
        console.error('addEmployee error:', error);
        return { success: false, message: 'Erro ao cadastrar funcionário.' };
    }
}

// ─────────────────────────────────────────────
// Upload de documentos da EMPRESA (fornecedor)
// ─────────────────────────────────────────────

/**
 * Processa o upload de documentos da empresa (categoria 0 — não vinculados a colaborador).
 * Cada arquivo tem de ser de um dos tipos de empresa exigidos na solicitação; a validade
 * segue as mesmas regras do envio de colaborador, por arquivo.
 * Os arquivos são organizados em uploads/company/<supplierId>-<razaoSocial>/<YYYY-MM-DD>/.
 *
 * @param {string} token       — token do link do contrato
 * @param {number} supplierId  — extraído do JWT do fornecedor
 * @param {object} data        — { documentTypeIds: number[] (obrigatório), expiresAt?: (string|null)[] },
 *                               ambos paralelos a files (mesmo tamanho)
 * @param {File[]} files       — arquivos enviados via multer (req.files)
 */
export async function addCompanyDocuments(token, supplierId, data, files = []) {
    if (!files || files.length === 0) {
        return { success: false, message: 'Envie ao menos um documento da empresa.' };
    }

    const { documentTypeIds, expiresAt } = data;

    if (!Array.isArray(documentTypeIds) || documentTypeIds.length !== files.length) {
        return { success: false, message: COMPANY_DOCUMENT_CHOICE_ERROR };
    }

    const hasExpiresAt = expiresAt !== undefined && expiresAt !== null;
    if (hasExpiresAt && (!Array.isArray(expiresAt) || expiresAt.length !== files.length)) {
        return { success: false, message: 'Data de validade inválida.' };
    }

    // Contrato ativo (declaração assinada); depois do prazo, só reenvio (conferido abaixo, por arquivo)
    const loaded = await loadActiveAssignment(token, supplierId);
    if (loaded.error) return { success: false, ...loaded.error };
    const { assignment } = loaded;
    const deadlineClosed = isDeadlineClosed(assignment);

    // Cada arquivo: um dos tipos de empresa exigidos na solicitação (ativos), com a validade dele
    const requiredTypes = await documentTypeModel.getRequiredCompanyDocumentTypes(assignment.labor_request_id);
    const requiredById = new Map(requiredTypes.map((type) => [type.id, type]));

    const uploads = [];
    for (let i = 0; i < files.length; i++) {
        const documentType = requiredById.get(toInteger(documentTypeIds[i]));
        if (!documentType) {
            return { success: false, message: COMPANY_DOCUMENT_CHOICE_ERROR };
        }

        const expiration = resolveExpiration(documentType, hasExpiresAt ? expiresAt[i] : null);
        if (expiration.error) {
            return { success: false, message: expiration.error };
        }

        // Uma entrega por documento: o mesmo tipo duas vezes no envio viraria histórico na hora
        if (uploads.some((upload) => upload.documentTypeId === documentType.id)) {
            return { success: false, message: `Envie um arquivo para cada documento: "${documentType.name}" foi escolhido mais de uma vez.` };
        }

        // Prazo encerrado: só reenvio de documento reprovado / reenvio necessário
        if (deadlineClosed && !(await canResendAfterDeadline({
            supplierId,
            laborRequestId: assignment.labor_request_id,
            documentTypeId: documentType.id,
        }))) {
            return { success: false, message: DEADLINE_CLOSED_MESSAGE };
        }

        uploads.push({ file: files[i], documentTypeId: documentType.id, expiresAt: expiration.value });
    }

    let transaction;
    let transactionDone = false;
    const savedPaths = [];

    try {
        transaction = await trasaction.iniciarTransacao();

        const documentIds = [];
        for (const upload of uploads) {
            const docId = await persistFile(
                transaction,
                'company',
                upload.file,
                {
                    supplierId,
                    supplierName: assignment.supplier_name,
                    documentTypeId: upload.documentTypeId,
                    laborRequestId: assignment.labor_request_id,
                    employeeId: null, // documento da empresa não tem colaborador
                    expiresAt: upload.expiresAt,
                },
                savedPaths,
            );
            documentIds.push(docId);
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        console.log(`${documentIds.length} documento(s) da empresa enviado(s) (supplier ${supplierId}).`);
        return { success: true, body: { documentIds } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        removeSavedFiles(savedPaths);
        console.error('addCompanyDocuments error:', error);
        return { success: false, message: 'Erro ao enviar documentos da empresa.' };
    }
}

// ─────────────────────────────────────────────
// Lista do fornecedor (portal, "Meus contratos")
// ─────────────────────────────────────────────

/**
 * Contratos (vínculos abertos) do fornecedor, com o prazo e o resumo dos documentos. Antes,
 * vincula a ele os convites ainda sem fornecedor feitos para os e-mails dos usuários dele
 * (ex.: se cadastrou sem abrir o link). Só e-mail CONFIRMADO puxa convite (claimByEmails
 * confere no banco): um e-mail digitado no cadastro ou trocado no Perfil só conta depois que
 * alguém entrar com o código enviado para ele.
 */
export async function listSupplierPhase2Requests(supplierId) {
    try {
        const emails = (await supplierUserModel.getActiveEmailsBySupplier(supplierId)).map((row) => row.email);
        await assignmentModel.claimByEmails(supplierId, emails);

        const rows = await assignmentModel.listOpenBySupplier(supplierId);
        const result = rows.map((row) => ({
            token: row.invite_token,
            status: row.status,
            deadlineAt: row.deadline_at,
            isExpired: isDeadlineClosed(row),
            declaredAt: row.declared_at,
            createdAt: row.created_at,
            laborRequestId: row.labor_request_id,
            laborRequestTitle: row.labor_request_title,
            laborRequestLocation: row.labor_request_location,
            laborRequestStatus: row.labor_request_status,
            contractNumber: row.contract_number,
            employees: row.employees,
            documentsTotal: row.documents_total,
            documentsPending: row.documents_pending,
            documentsApproved: row.documents_approved,
            documentsReturned: row.documents_returned,
            documentsExpired: row.documents_expired,
        }));
        return { success: true, body: { result } };
    } catch (error) {
        console.error('listSupplierPhase2Requests error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os contratos.' };
    }
}

// ─────────────────────────────────────────────
// Download do próprio fornecedor
// ─────────────────────────────────────────────

/**
 * O fornecedor baixa um arquivo que ele mesmo enviou nesta solicitação (atual ou do histórico).
 * Link de outro fornecedor → 403; documento de outro fornecedor ou solicitação → 404.
 * Registra na auditoria com o fornecedor como autor.
 *
 * @param {object} context — { ipAddress, userAgent } da requisição
 */
export async function prepareSupplierDownload(token, supplierId, documentId, context = {}) {
    try {
        const loaded = await loadOwnAssignment(token, supplierId);
        if (loaded.error) return { success: false, ...loaded.error };
        const { assignment } = loaded;

        return documentDownloadService.prepareDocumentDownload(
            documentId,
            { ...context, actorType: AUDIT_ACTOR_TYPES.SUPPLIER, actorId: assignment.supplier_id },
            { supplierId: assignment.supplier_id, laborRequestId: assignment.labor_request_id },
        );
    } catch (error) {
        console.error('prepareSupplierDownload error:', error);
        return { success: false, status: 500, message: 'Erro ao preparar o download do documento.' };
    }
}

// ─────────────────────────────────────────────
// Listar funcionários (painel interno)
// ─────────────────────────────────────────────

export async function listAllEmployees() {
    try {
        const employees = await employeeModel.getAllEmployees();
        return { success: true, body: { employees } };
    } catch (error) {
        console.error('listAllEmployees error:', error);
        return { success: false, message: 'Erro ao listar funcionários.' };
    }
}
