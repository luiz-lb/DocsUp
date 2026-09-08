import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import nodemailer from 'nodemailer';
import * as quotationModel from '../models/quotationModel.js';
import * as employeeModel from '../models/employeeModel.js';
import * as laborRequestModel from '../models/laborRequestModel.js';
import * as supplierModel from '../models/supplierModel.js';
import * as trasaction from '../models/trasaction.js';
import { triggerDocumentValidation } from './documentValidationService.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function createMailTransport() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
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

/** Diretório raiz de uploads (absoluto). */
function getUploadBaseDir() {
    const configured = process.env.UPLOAD_DIR ?? 'uploads';
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

/** Data de hoje no formato YYYY-MM-DD para organizar pastas por dia de upload. */
function todayFolder() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Monta o diretório destino organizado por escopo, fornecedor e data de upload.
 *   uploads/<scope>/<supplierId>/<YYYY-MM-DD>/
 *
 * @param {'employees'|'company'} scope
 * @param {number} supplierId
 * @returns {{ absDir: string, baseDir: string }}
 */
function buildUploadDir(scope, supplierId) {
    const baseDir = getUploadBaseDir();
    const absDir = path.join(baseDir, scope, String(supplierId), todayFolder());
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
 * @param {object}   docData       — { supplierId, documentTypeId, laborRequestId, employeeId }
 * @param {string[]} savedPaths    — acumulador para rollback de arquivos
 */
async function persistFile(transaction, scope, file, docData, savedPaths) {
    const { supplierId, documentTypeId, laborRequestId, employeeId = null } = docData;

    const { absDir, baseDir } = buildUploadDir(scope, supplierId);

    const fileHash = hashBuffer(file.buffer);
    const ext = path.extname(file.originalname).toLowerCase();
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
        fileName: file.originalname,
        filePath: relPath,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
        fileHash,
    });

    return docId;
}

// ─────────────────────────────────────────────
// Buscar dados da Fase 2 pelo token
// ─────────────────────────────────────────────

/**
 * Retorna o deadline, funcionários já enviados e documentos da empresa.
 */
export async function getPhase2ByToken(token) {
    try {
        const deadline = await quotationModel.getPhase2DeadlineByToken(token);
        if (!deadline) {
            return { success: false, message: 'Link da Fase 2 inválido.' };
        }

        const employees = await employeeModel.getEmployeesBySupplierAndRequest(
            deadline.supplier_id,
            deadline.labor_request_id,
        );

        const documents = await employeeModel.getDocumentsBySupplierAndRequest(
            deadline.supplier_id,
            deadline.labor_request_id,
        );

        // Documentos obrigatórios definidos por Segurança do Trabalho
        const requiredDocs = await laborRequestModel.getLaborRequestDocuments(deadline.labor_request_id);

        // NRs obrigatórias definidas por Segurança do Trabalho para a atividade
        const requiredNrTypes = await laborRequestModel.getLaborRequestNrs(deadline.labor_request_id);

        const now = new Date();
        const expiresAt = new Date(deadline.expires_at);
        const isExpired = now > expiresAt;

        return {
            success: true,
            body: {
                deadline: { ...deadline, isExpired },
                employees,
                documents,
                requiredDocuments: requiredDocs,
                requiredNrTypes,
            },
        };
    } catch (error) {
        console.error('getPhase2ByToken error:', error);
        return { success: false, message: 'Erro ao buscar Fase 2.' };
    }
}

// ─────────────────────────────────────────────
// Cadastrar funcionário com documentos
// ─────────────────────────────────────────────

/**
 * Cadastra um funcionário e processa os arquivos enviados.
 *
 * @param {string}   token      — link_token do phase2_deadline
 * @param {number}   supplierId — extraído do JWT do fornecedor
 * @param {object}   data       — { fullName, cpf, rg, roleFunction, nrTypeIds[] }
 * @param {File[]}   files      — arquivos enviados via multer (req.files)
 */
export async function addEmployee(token, supplierId, data, files = []) {
    const { fullName, cpf, rg, roleFunction, nrTypeIds = [] } = data;

    if (!fullName || !cpf) {
        return { success: false, message: 'Nome completo e CPF são obrigatórios.' };
    }

    // Valida deadline
    const deadline = await quotationModel.getPhase2DeadlineByToken(token);
    if (!deadline) {
        return { success: false, message: 'Token da Fase 2 inválido.' };
    }
    if (deadline.status === 2) {
        return { success: false, message: 'O prazo da Fase 2 expirou.' };
    }
    if (new Date() > new Date(deadline.expires_at)) {
        return { success: false, message: 'O prazo da Fase 2 encerrou.' };
    }
    if (deadline.supplier_id !== supplierId) {
        return { success: false, message: 'Sem permissão para este deadline.' };
    }

    let transaction;
    let transactionDone = false;
    const savedPaths = []; // para rollback de arquivos em caso de erro

    try {
        transaction = await trasaction.iniciarTransacao();

        // 1. Insere o funcionário
        const employeeId = await employeeModel.insertEmployee(transaction, {
            supplierId,
            laborRequestId: deadline.labor_request_id,
            fullName,
            cpf,
            rg,
            roleFunction,
        });

        if (!employeeId) {
            await trasaction.finalizarTransacao(transaction, false);
            transactionDone = true;
            return { success: false, message: 'Erro ao cadastrar funcionário.' };
        }

        // 2. Processa e salva os arquivos — organizados por fornecedor e data de upload
        //    uploads/employees/<supplierId>/<YYYY-MM-DD>/<hash>.<ext>
        const documentIds = [];
        for (const file of files) {
            // document_type_id=7 (ASO/Cert NR) — o tipo exato é refinado na validação (Módulo 5)
            const docId = await persistFile(
                transaction,
                'employees',
                file,
                {
                    supplierId,
                    documentTypeId: 7,
                    laborRequestId: deadline.labor_request_id,
                    employeeId,
                },
                savedPaths,
            );
            documentIds.push(docId);
        }


        // 3. Registra as NRs do funcionário
        for (const nrTypeId of nrTypeIds) {
            await employeeModel.insertEmployeeNr(
                transaction,
                employeeId,
                Number(nrTypeId),
                null,
                null,
            );
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Dispara validação assíncrona para cada documento salvo (fora da transação)
        for (const docId of documentIds) {
            setImmediate(() => triggerDocumentValidation(docId, supplierId));
        }

        console.log(`Funcionário ${employeeId} cadastrado na Fase 2 (supplier ${supplierId}).`);
        return { success: true, body: { employeeId } };
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
 * Processa o upload de documentos da empresa (escopo 0 — não vinculados a colaborador).
 * Os arquivos são organizados em uploads/company/<supplierId>/<YYYY-MM-DD>/.
 *
 * @param {string} token       — link_token do phase2_deadline
 * @param {number} supplierId  — extraído do JWT do fornecedor
 * @param {object} data        — { documentTypeIds: number[] } paralelo a files (opcional)
 * @param {File[]} files       — arquivos enviados via multer (req.files)
 */
export async function addCompanyDocuments(token, supplierId, data, files = []) {
    if (!files || files.length === 0) {
        return { success: false, message: 'Envie ao menos um documento da empresa.' };
    }

    const { documentTypeIds = [] } = data;

    // Valida deadline
    const deadline = await quotationModel.getPhase2DeadlineByToken(token);
    if (!deadline) {
        return { success: false, message: 'Token da Fase 2 inválido.' };
    }
    if (deadline.status === 2) {
        return { success: false, message: 'O prazo da Fase 2 expirou.' };
    }
    if (new Date() > new Date(deadline.expires_at)) {
        return { success: false, message: 'O prazo da Fase 2 encerrou.' };
    }
    if (deadline.supplier_id !== supplierId) {
        return { success: false, message: 'Sem permissão para este deadline.' };
    }

    let transaction;
    let transactionDone = false;
    const savedPaths = [];

    try {
        transaction = await trasaction.iniciarTransacao();

        const documentIds = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // documentTypeIds pode mapear 1:1 com os arquivos; fallback = 1 (Contrato Social)
            const documentTypeId = Number(documentTypeIds[i]) || 1;

            const docId = await persistFile(
                transaction,
                'company',
                file,
                {
                    supplierId,
                    documentTypeId,
                    laborRequestId: deadline.labor_request_id,
                    employeeId: null, // documento da empresa não tem colaborador
                },
                savedPaths,
            );
            documentIds.push(docId);
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Dispara validação assíncrona para cada documento salvo (fora da transação)
        for (const docId of documentIds) {
            setImmediate(() => triggerDocumentValidation(docId, supplierId));
        }

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
