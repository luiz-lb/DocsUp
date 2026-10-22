import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import nodemailer from 'nodemailer';
import * as quotationModel from '../models/quotationModel.js';
import * as employeeModel from '../models/employeeModel.js';
import * as laborRequestModel from '../models/laborRequestModel.js';
import * as supplierModel from '../models/supplierModel.js';
import * as documentTypeModel from '../models/documentTypeModel.js';
import * as trasaction from '../models/trasaction.js';
import * as deliveryModel from '../models/deliveryModel.js';
import * as documentDownloadService from './documentDownloadService.js';
import { groupDeliveriesBySlot, slotKey, toSupplierDelivery } from './deliveryService.js';
import { AUDIT_ACTOR_TYPES } from '../constants/audit.js';
import { DOCUMENT_CATEGORIES, EMPLOYEE_DOCUMENT_CATEGORIES } from '../constants/documentCategories.js';
import { isBlank, toInteger } from '../utils/parse.js';
import { getUploadBaseDir } from '../utils/uploadPaths.js';

// Validação automática (API pública / IA via N8N) desligada por enquanto: o RH baixa o documento,
// valida no portal externo e muda o status à mão. O documento entra como Pendente. Para voltar a
// usar, chamar triggerDocumentValidation (documentValidationService) depois de gravar o envio.

// Depois do prazo da Fase 2, só dá para reenviar o que o RH devolveu
const RESENDABLE_STATUSES = [3, 4]; // Reprovado, Reenvio Necessário
const DEADLINE_CLOSED_MESSAGE =
    'O prazo da Fase 2 encerrou. Agora só dá para reenviar documentos reprovados ou com reenvio necessário.';

const COMPANY_DOCUMENT_CHOICE_ERROR =
    'Escolha, para cada arquivo, um dos documentos da empresa exigidos nesta solicitação.';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 'YYYY-MM-DD' → Date à meia-noite no horário LOCAL, ou null se a data for inválida.
 * O pool usa useUTC = false: o sql.Date grava os componentes locais do Date. Passar a
 * string ou um Date.parse (meia-noite UTC = 21h do dia anterior aqui) gravaria um dia antes.
 */
function parseLocalDate(value) {
    if (typeof value !== 'string') return null;
    const match = ISO_DATE_PATTERN.exec(value.trim());
    if (!match) return null;

    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    // O Date "corrige" datas inexistentes (2026-02-30 vira 02/03): essas são inválidas
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

/** Prazo da Fase 2 encerrado (vencido ou já marcado como expirado pelo job). */
function isDeadlineClosed(deadline) {
    return deadline.status === 2 || new Date() > new Date(deadline.expires_at);
}

/** Depois do prazo: o documento atual está reprovado ou com reenvio necessário? */
async function canResendAfterDeadline({ supplierId, laborRequestId, documentTypeId, employeeId = null }) {
    const status = await deliveryModel.getCurrentDeliveryStatus({ supplierId, laborRequestId, documentTypeId, employeeId });
    return RESENDABLE_STATUSES.includes(status);
}

/** Hoje à meia-noite, no horário local. */
function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

/**
 * Validade de um documento conforme o tipo. Com validade (has_expiration): a data é
 * obrigatória, tem de ser válida e não pode ser passada. Sem validade: é ignorada (NULL).
 * Retorna { value } (Date local ou null) ou { error }.
 */
function resolveExpiration(documentType, expiresAt) {
    if (!documentType.has_expiration) return { value: null };
    if (isBlank(expiresAt)) return { error: 'Informe a validade do documento.' };

    const date = parseLocalDate(expiresAt);
    if (!date) return { error: 'Data de validade inválida.' };
    if (date < startOfToday()) return { error: 'A validade não pode ser uma data passada.' };
    return { value: date };
}

function createMailTransport() {
    // TODO: SMTP desativado temporariamente (Gmail recusando credenciais — 535 BadCredentials).
    // Descomentar quando SMTP_USER/SMTP_PASS estiverem corretos no .env.
    // return nodemailer.createTransport({
    //     host: process.env.SMTP_HOST,
    //     port: Number(process.env.SMTP_PORT || 587),
    //     secure: process.env.SMTP_SECURE === 'true',
    //     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // });
    return {
        sendMail: async ({ to, subject }) => {
            console.log(`[SMTP DESATIVADO] Email não enviado → para: ${to} | assunto: ${subject}`);
        },
    };
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
        .replace(/[\u0300-\u036f]/g, '')       // remove acentos
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
 * @param {object}   docData       — { supplierId, supplierName, documentTypeId, laborRequestId, employeeId, expiresAt }
 *                                   (expiresAt: Date local ou null)
 * @param {string[]} savedPaths    — acumulador para rollback de arquivos
 */
async function persistFile(transaction, scope, file, docData, savedPaths) {
    const { supplierId, supplierName, documentTypeId, laborRequestId, employeeId = null, expiresAt = null } = docData;

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
    });

    return docId;
}

// ─────────────────────────────────────────────
// Buscar dados da Fase 2 pelo token
// ─────────────────────────────────────────────

/**
 * Retorna o deadline, funcionários já enviados (com NRs e documentos atuais), documentos
 * enviados, exigências da solicitação e os tipos de documento que o fornecedor pode enviar.
 * O link só abre para o fornecedor dono dele (supplierId vem do JWT do fornecedor).
 */
export async function getPhase2ByToken(token, supplierId) {
    try {
        const deadline = await quotationModel.getPhase2DeadlineByToken(token);
        if (!deadline) {
            return { success: false, status: 404, message: 'Link da Fase 2 inválido.' };
        }
        if (deadline.supplier_id !== Number(supplierId)) {
            return { success: false, status: 403, message: 'Este link é de outro fornecedor.' };
        }

        const laborRequestId = deadline.labor_request_id;

        const [
            employees,
            documents,
            requiredDocs,
            requiredNrTypes,
            employeeDocumentTypes,
            companyDocumentTypes,
            deliveries,
        ] = await Promise.all([
            employeeModel.getEmployeesBySupplierAndRequest(deadline.supplier_id, laborRequestId),
            employeeModel.getDocumentsBySupplierAndRequest(deadline.supplier_id, laborRequestId),
            // Documentos obrigatórios definidos por Segurança do Trabalho
            laborRequestModel.getLaborRequestDocuments(laborRequestId),
            // NRs obrigatórias definidas por Segurança do Trabalho para a atividade
            laborRequestModel.getLaborRequestNrs(laborRequestId),
            // Tipos ativos de documento de colaborador, com `required` para esta solicitação
            documentTypeModel.getEmployeeDocumentTypesForRequest(laborRequestId),
            // Tipos de documento da empresa exigidos nesta solicitação
            documentTypeModel.getRequiredCompanyDocumentTypes(laborRequestId),
            // Todas as entregas (atuais e antigas), para o histórico de cada documento
            deliveryModel.listSupplierDeliveries(deadline.supplier_id, laborRequestId),
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

        // isExpired: prazo encerrado (depois dele, só reenvio de reprovado / reenvio necessário)
        const isExpired = isDeadlineClosed(deadline);

        return {
            success: true,
            body: {
                deadline: { ...deadline, isExpired },
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
        return { success: false, status: 500, message: 'Erro ao buscar Fase 2.' };
    }
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
 * @param {string}   token      — link_token do phase2_deadline
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

    // Valida deadline (depois do prazo, só reenvio: conferido abaixo, com o colaborador)
    const deadline = await quotationModel.getPhase2DeadlineByToken(token);
    if (!deadline) {
        return { success: false, message: 'Token da Fase 2 inválido.' };
    }
    if (deadline.supplier_id !== supplierId) {
        return { success: false, message: 'Sem permissão para este deadline.' };
    }
    const deadlineClosed = isDeadlineClosed(deadline);

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
            deadline.labor_request_id,
            cpf,
        );

        // Prazo encerrado: só reenvio de documento reprovado / reenvio necessário de colaborador já enviado
        if (deadlineClosed) {
            const allowed = employeeId && await canResendAfterDeadline({
                supplierId,
                laborRequestId: deadline.labor_request_id,
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
                laborRequestId: deadline.labor_request_id,
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
                supplierName: deadline.supplier_name,
                documentTypeId: documentType.id,
                laborRequestId: deadline.labor_request_id,
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

        console.log(`Colaborador ${employeeId} + documento tipo ${documentType.id} (doc ${docId}) na Fase 2 (supplier ${supplierId}).`);
        return { success: true, body: { employeeId, documentTypeId: documentType.id, documentId: docId } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        // Remove arquivos físicos em caso de erro de BD
        for (const fp of savedPaths) {
            try { fs.unlinkSync(fp); } catch (_) { /* ignore */ }
        }
        console.error('addEmployee Phase2 error:', error);
        return { success: false, message: 'Erro ao cadastrar funcionário.' };
    }
}

// ─────────────────────────────────────────────
// Upload de documentos da EMPRESA (fornecedor) na Fase 2
// ─────────────────────────────────────────────

/**
 * Processa o upload de documentos da empresa (categoria 0 — não vinculados a colaborador).
 * Cada arquivo tem de ser de um dos tipos de empresa exigidos na solicitação; a validade
 * segue as mesmas regras do envio de colaborador, por arquivo.
 * Os arquivos são organizados em uploads/company/<supplierId>-<razaoSocial>/<YYYY-MM-DD>/.
 *
 * @param {string} token       — link_token do phase2_deadline
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

    // Valida deadline (depois do prazo, só reenvio: conferido abaixo, por arquivo)
    const deadline = await quotationModel.getPhase2DeadlineByToken(token);
    if (!deadline) {
        return { success: false, message: 'Token da Fase 2 inválido.' };
    }
    if (deadline.supplier_id !== supplierId) {
        return { success: false, message: 'Sem permissão para este deadline.' };
    }
    const deadlineClosed = isDeadlineClosed(deadline);

    // Cada arquivo: um dos tipos de empresa exigidos na solicitação (ativos), com a validade dele
    const requiredTypes = await documentTypeModel.getRequiredCompanyDocumentTypes(deadline.labor_request_id);
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
            laborRequestId: deadline.labor_request_id,
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
                    supplierName: deadline.supplier_name,
                    documentTypeId: upload.documentTypeId,
                    laborRequestId: deadline.labor_request_id,
                    employeeId: null, // documento da empresa não tem colaborador
                    expiresAt: upload.expiresAt,
                },
                savedPaths,
            );
            documentIds.push(docId);
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        console.log(`${documentIds.length} documento(s) da empresa enviado(s) na Fase 2 (supplier ${supplierId}).`);
        return { success: true, body: { documentIds } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        for (const fp of savedPaths) {
            try { fs.unlinkSync(fp); } catch (_) { /* ignore */ }
        }
        console.error('addCompanyDocuments Phase2 error:', error);
        return { success: false, message: 'Erro ao enviar documentos da empresa.' };
    }
}

// ─────────────────────────────────────────────
// Lista do fornecedor (portal, "Documentos (Fase 2)")
// ─────────────────────────────────────────────

/**
 * Solicitações em que o fornecedor tem link da Fase 2, com o prazo (isExpired: encerrado) e
 * o resumo dos documentos. Só as dele (supplierId vem do JWT do fornecedor).
 */
export async function listSupplierPhase2Requests(supplierId) {
    try {
        const rows = await quotationModel.listPhase2DeadlinesBySupplier(supplierId);
        const result = rows.map((row) => ({
            ...row,
            isExpired: isDeadlineClosed({ status: row.deadline_status, expires_at: row.expires_at }),
        }));
        return { success: true, body: { result } };
    } catch (error) {
        console.error('listSupplierPhase2Requests error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar as solicitações da Fase 2.' };
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
        const deadline = await quotationModel.getPhase2DeadlineByToken(token);
        if (!deadline) {
            return { success: false, status: 404, message: 'Link da Fase 2 inválido.' };
        }
        if (deadline.supplier_id !== Number(supplierId)) {
            return { success: false, status: 403, message: 'Este link é de outro fornecedor.' };
        }

        return documentDownloadService.prepareDocumentDownload(
            documentId,
            { ...context, actorType: AUDIT_ACTOR_TYPES.SUPPLIER, actorId: deadline.supplier_id },
            { supplierId: deadline.supplier_id, laborRequestId: deadline.labor_request_id },
        );
    } catch (error) {
        console.error('prepareSupplierDownload error:', error);
        return { success: false, status: 500, message: 'Erro ao preparar o download do documento.' };
    }
}

// ─────────────────────────────────────────────
// Processar expiração automática de Phase 2
// ─────────────────────────────────────────────

/**
 * Job periódico: verifica deadlines vencidos e aplica penalidade.
 * Deve ser chamado por um setInterval ou cron no server.js.
 *
 * Para cada deadline expirado:
 *  1. Atualiza phase2_deadline.status = 2 (Expirado)
 *  2. Atualiza quotation.status = 5 (Desclassificada por Doc)
 *  3. Envia alerta para Suprimentos
 */
export async function processExpiredPhase2Deadlines() {
    let processed = 0;
    try {
        const expired = await quotationModel.getExpiredPhase2Deadlines();
        if (expired.length === 0) return 0;

        const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

        for (const deadline of expired) {
            let transaction;
            let transactionDone = false;
            try {
                transaction = await trasaction.iniciarTransacao();

                // Marca deadline como expirado
                await quotationModel.updatePhase2DeadlineStatus(transaction, deadline.id, 2, null);

                // Desclassifica a cotação por documentação
                await quotationModel.updateQuotationStatus(transaction, deadline.quotation_id, 5);

                await trasaction.finalizarTransacao(transaction, true);
                transactionDone = true;
                processed++;

                // Alerta Suprimentos via email (fora da transação)
                try {
                    const transporter = createMailTransport();
                    const alertEmail = process.env.SUPRIMENTOS_EMAIL ?? process.env.SMTP_USER;

                    await transporter.sendMail({
                        from: `"DocsUp Sistema" <${process.env.SMTP_USER}>`,
                        to: alertEmail,
                        subject: `⚠️ Prazo Phase 2 estourado — Fornecedor desclassificado`,
                        html: `
                            <div style="font-family:sans-serif; max-width:520px; margin:auto;">
                                <h2 style="color:#dc2626;">⚠️ Prazo da Fase 2 estourado</h2>
                                <p>O fornecedor não enviou a documentação dos colaboradores no prazo.</p>
                                <p><strong>Labor Request ID:</strong> ${deadline.labor_request_id}</p>
                                <p><strong>Fornecedor ID:</strong> ${deadline.supplier_id}</p>
                                <p>O fornecedor foi desclassificado por documentação.</p>
                                <p style="margin-top:1rem;">
                                    <a href="${frontendUrl}/cotacoes/${deadline.quotation_id}"
                                       style="background:#004643;color:#fff;padding:10px 20px;
                                              border-radius:6px;text-decoration:none;">
                                        Ver rodada de cotação
                                    </a>
                                </p>
                                <p style="color:#6b7280; font-size:0.8rem; margin-top:1rem;">
                                    Deseja chamar o 2º colocado? Acesse a rodada pelo link acima.
                                </p>
                            </div>
                        `,
                    });
                } catch (emailErr) {
                    console.error(`Erro ao enviar alerta de phase2 expirado (id ${deadline.id}):`, emailErr.message);
                }
            } catch (err) {
                if (transaction && !transactionDone) {
                    await trasaction.finalizarTransacao(transaction, false);
                }
                console.error(`Erro ao processar deadline ${deadline.id}:`, err);
            }
        }
    } catch (error) {
        console.error('processExpiredPhase2Deadlines error:', error);
    }
    return processed;
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
