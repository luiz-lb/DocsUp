import axios from 'axios';
import { sql, poolPromise } from '../config/dbConfig.js';
import * as documentValidationModel from '../models/documentValidationModel.js';
import * as trasaction from '../models/trasaction.js';
import * as deliveryModel from '../models/deliveryModel.js';
import * as auditModel from '../models/auditModel.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { collaboratorAuditEntry } from '../utils/audit.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Extrai o CNPJ do supplier para consultas de API pública.
 * Busca via supplierModel — importado inline para evitar dependência circular.
 */
async function getSupplierCnpj(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, supplierId)
        .query('SELECT cnpj FROM suppliers WHERE id = @id');
    return result.recordset[0]?.cnpj ?? null;
}

// ─────────────────────────────────────────────
// Validação por API pública
// ─────────────────────────────────────────────

/**
 * Valida um documento via API pública conforme o api_endpoint configurado no document_type.
 *
 * Endpoints suportados atualmente:
 *  - cnd_federal   : Consulta débitos federais (CND) via api_endpoint = 'cnd_federal'
 *  - crf_fgts      : Consulta regularidade FGTS
 *  - trabalhista   : Consulta débitos trabalhistas (CNIA/CNDT)
 *
 * Retorna { valid: boolean, rawResponse: string }
 */
async function validateViaPublicApi(document, supplierId) {
    const cnpj = await getSupplierCnpj(supplierId);
    if (!cnpj) {
        return { valid: false, rawResponse: 'CNPJ não encontrado para o fornecedor.' };
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const endpoint = document.api_endpoint;

    try {
        switch (endpoint) {
            case 'cnd_federal': {
                // Receita Federal — usamos ReceitaWS como proxy informativo
                const { data } = await axios.get(
                    `https://receitaws.com.br/v1/cnpj/${cleanCnpj}`,
                    { timeout: 8000 }
                );
                const situacao = data.situacao ?? 'DESCONHECIDO';
                const valid = situacao === 'ATIVA';
                return {
                    valid,
                    rawResponse: JSON.stringify({ situacao, data_situacao: data.data_situacao }),
                };
            }

            case 'crf_fgts': {
                // FGTS — consulta na API do FGTS (endpoint público de verificação de regularidade)
                // Nota: a API real exige certificado digital. Aqui usamos endpoint de verificação
                // pública disponível via ReceitaWS como fallback.
                const { data } = await axios.get(
                    `https://ws.hubdodesenvolvedor.com.br/v2/fgts/?cnpj=${cleanCnpj}&token=${process.env.HUBDEV_TOKEN ?? ''}`,
                    { timeout: 8000 }
                );
                const valid = data?.return?.regular === true || data?.regular === true;
                return {
                    valid,
                    rawResponse: JSON.stringify(data),
                };
            }

            case 'trabalhista': {
                // CNDT — Certidão Negativa de Débitos Trabalhistas (TST)
                const { data } = await axios.get(
                    `https://cndt-certidao.tst.jus.br/inicio.faces`,
                    { timeout: 10000, params: { cnpj: cleanCnpj } }
                );
                // A resposta HTML é parseada de forma simplificada
                const valid = typeof data === 'string' ? data.includes('NEGATIVA') : false;
                return {
                    valid,
                    rawResponse: typeof data === 'string' ? data.slice(0, 500) : JSON.stringify(data),
                };
            }

            default:
                return { valid: null, rawResponse: `Endpoint '${endpoint}' não configurado.` };
        }
    } catch (err) {
        console.error(`Erro na validação via API pública (${endpoint}):`, err.message);
        // Falha de API pública → encaminha para revisão manual
        return { valid: null, rawResponse: `Erro na consulta: ${err.message}` };
    }
}

// ─────────────────────────────────────────────
// Módulo 5: disparar validação de um documento
// ─────────────────────────────────────────────

/**
 * Inicia o processo de validação de um documento recém-enviado.
 * Chamado pelo phase2Service após salvar o documento.
 *
 * Fluxo:
 *  - validation_method=0 (API Pública): chama validateViaPublicApi
 *  - validation_method=1 (IA): encaminha para fila de revisão manual com final_status=0
 *    (a integração real com IA fica no N8N; aqui registramos o intento)
 *  - validation_method=2 (Manual): vai direto para fila
 *  - validation_method=3 (Híbrida): tenta API pública primeiro; se inválido → manual
 */
export async function triggerDocumentValidation(documentId, supplierId) {
    let transaction;
    let transactionDone = false;

    try {
        const document = await documentValidationModel.getDocumentById(documentId);
        if (!document) {
            console.error(`triggerDocumentValidation: documento ${documentId} não encontrado.`);
            return;
        }

        const method = document.validation_method; // 0=API, 1=IA, 2=Manual, 3=Híbrida

        transaction = await trasaction.iniciarTransacao();

        // Marca o documento como "em validação"
        await documentValidationModel.updateDocumentStatus(transaction, documentId, 1);

        let validationRecord;

        if (method === 0 || method === 3) {
            // Validação por API pública
            const { valid, rawResponse } = await validateViaPublicApi(document, supplierId);

            if (valid === true) {
                // Aprovado pela API
                validationRecord = await documentValidationModel.insertValidation(transaction, {
                    documentId,
                    validationType: 0,
                    aiScore: null,
                    apiResponse: rawResponse,
                    apiValid: true,
                    finalStatus: 1, // Aprovado
                });
                await documentValidationModel.updateDocumentStatus(transaction, documentId, 2); // Aprovado
            } else if (valid === false) {
                // Reprovado pela API
                validationRecord = await documentValidationModel.insertValidation(transaction, {
                    documentId,
                    validationType: 0,
                    aiScore: null,
                    apiResponse: rawResponse,
                    apiValid: false,
                    finalStatus: 2, // Reprovado
                });
                await documentValidationModel.updateDocumentStatus(transaction, documentId, 3); // Reprovado
            } else {
                // API falhou → revisão manual
                validationRecord = await documentValidationModel.insertValidation(transaction, {
                    documentId,
                    validationType: 2, // Manual
                    aiScore: null,
                    apiResponse: rawResponse,
                    apiValid: null,
                    finalStatus: 0, // Pendente
                });
                await documentValidationModel.updateDocumentStatus(transaction, documentId, 1); // Validando
            }
        } else {
            // Método IA (1), Manual (2) ou híbrida sem API → fila de revisão manual
            // O score de IA será preenchido pelo N8N quando processar o webhook
            validationRecord = await documentValidationModel.insertValidation(transaction, {
                documentId,
                validationType: method === 1 ? 1 : 2,
                aiScore: null,
                aiResultJson: null,
                finalStatus: 0, // Pendente de revisão
            });
            await documentValidationModel.updateDocumentStatus(transaction, documentId, 1); // Validando
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        console.log(`Validação iniciada para documento ${documentId} (método ${method}).`);
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('triggerDocumentValidation error:', error);
    }
}

// ─────────────────────────────────────────────
// Webhook N8N: recebe resultado da IA
// ─────────────────────────────────────────────

// Resultado que a IA pode devolver e o tamanho máximo do motivo
const AI_RESULTS = ['aprovado', 'reprovado', 'inconclusivo'];
const AI_REASON_MAX_LENGTH = 1000;
const AI_MODEL_MAX_LENGTH = 100;

/** Texto vindo de fora (N8N): sem tags HTML nem caracteres de controle, cortado no limite. */
function sanitizeExternalText(value, maxLength) {
    if (typeof value !== 'string') return null;
    const clean = value
        .replace(/<[^>]*>/g, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim();
    return clean ? clean.slice(0, maxLength) : null;
}

/**
 * Recebe o resultado da IA (webhook do N8N, autenticado pelo X-Webhook-Secret).
 *
 * A IA só SUGERE: grava a nota (0 a 100), o resultado (aprovado / reprovado / inconclusivo) e o
 * motivo na validação; o status do documento não muda. Quem aprova ou reprova é o RH.
 * Só os campos esperados são aceitos (o resto é descartado) e os textos são limpos antes de
 * gravar. Resposta fora do formato é recusada (o documento segue para a análise manual).
 *
 * Payload: { documentId, validationId, aiScore, result, reason, aiModelUsed? }
 */
export async function receiveAiValidationResult(payload = {}) {
    // O N8N pode mandar números como texto ("123"): converte antes de validar
    const documentId = Number(payload.documentId);
    const validationId = Number(payload.validationId);
    const aiScore = payload.aiScore === null || payload.aiScore === '' ? NaN : Number(payload.aiScore);
    const result = typeof payload.result === 'string' ? payload.result.trim().toLowerCase() : '';
    const reason = sanitizeExternalText(payload.reason, AI_REASON_MAX_LENGTH);
    const aiModelUsed = sanitizeExternalText(payload.aiModelUsed, AI_MODEL_MAX_LENGTH);

    if (!Number.isInteger(documentId) || documentId <= 0 || !Number.isInteger(validationId) || validationId <= 0) {
        return { success: false, message: 'documentId e validationId devem ser inteiros positivos.' };
    }
    if (!Number.isFinite(aiScore) || aiScore < 0 || aiScore > 100) {
        return { success: false, message: 'aiScore deve ser um número entre 0 e 100.' };
    }
    if (!AI_RESULTS.includes(result)) {
        return { success: false, message: 'result deve ser aprovado, reprovado ou inconclusivo.' };
    }
    if (!reason) {
        return { success: false, message: 'reason (motivo da nota) é obrigatório.' };
    }

    try {
        // A validação precisa ser deste documento: impede gravar o resultado no documento errado
        const validation = await documentValidationModel.getValidationByIdAndDocument(validationId, documentId);
        if (!validation) {
            return { success: false, message: 'Validação não encontrada para este documento.' };
        }

        await trasaction.executarEmTransacao(async (transaction) => {
            await new sql.Request(transaction)
                .input('id', sql.Int, validationId)
                .input('ai_score', sql.Decimal(5, 2), aiScore)
                .input('ai_result_json', sql.NVarChar(sql.MAX), JSON.stringify({ result, reason }))
                .input('ai_model_used', sql.VarChar(100), aiModelUsed)
                .query(`
                    UPDATE document_validations
                    SET ai_score       = @ai_score,
                        ai_result_json = @ai_result_json,
                        ai_model_used  = @ai_model_used
                    WHERE id = @id
                `);
        });

        return { success: true, body: { message: 'Resultado da IA registrado. A decisão é do RH.' } };
    } catch (error) {
        console.error('receiveAiValidationResult error:', error);
        return { success: false, message: 'Erro ao processar resultado da IA.' };
    }
}

// ─────────────────────────────────────────────
// Revisão manual
// ─────────────────────────────────────────────

/**
 * RH ou Segurança do Trabalho aprova/reprova manualmente um documento.
 * decision: 1=Aprovado, 2=Reprovado
 */
export async function reviewDocument(validationId, documentId, reviewerId, decision, comments) {
    if (![1, 2].includes(decision)) {
        return { success: false, message: 'decision deve ser 1 (Aprovado) ou 2 (Reprovado).' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        await documentValidationModel.applyManualDecision(transaction, validationId, reviewerId, decision, comments);

        // status do documento: 2=Aprovado, 3=Reprovado / 4=Reenvio Necessário
        const docStatus = decision === 1 ? 2 : 4;
        await documentValidationModel.updateDocumentStatus(transaction, documentId, docStatus);

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        return { success: true, body: { message: 'Revisão registrada com sucesso.' } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('reviewDocument error:', error);
        return { success: false, message: 'Erro ao registrar revisão.' };
    }
}

// ─────────────────────────────────────────────
// Atualização direta de status (RH / Segurança do Trabalho)
// ─────────────────────────────────────────────

// Status em que a observação é obrigatória (o fornecedor precisa saber o motivo)
const STATUS_NEEDS_OBSERVATION = [3, 4];
const OBSERVATION_MAX_LENGTH = 2000;

// Decisão manual e final_status da análise conforme o status do documento
function reviewDecision(status) {
    if (status === 2) return { manualDecision: 1, finalStatus: 1 };          // Aprovado
    if ([3, 4, 5].includes(status)) return { manualDecision: 2, finalStatus: 2 }; // Reprovado / Reenvio / Expirado
    return { manualDecision: null, finalStatus: 0 };                        // Pendente / Validando
}

/**
 * RH / Segurança do Trabalho muda o status da entrega ATUAL de um documento.
 * status: 0=Pendente, 1=Validando, 2=Aprovado, 3=Reprovado, 4=Reenvio Necessário, 5=Expirado
 *
 * Reprovado e Reenvio Necessário exigem observação (o fornecedor vê o motivo). Cada mudança
 * vira uma análise manual (document_validations) e um registro na auditoria, na mesma transação.
 *
 * @param {number} documentId
 * @param {number} status
 * @param {{ id: number, department: number }} reviewer — colaborador logado
 * @param {string} [comments] — observação para o fornecedor
 * @param {object} [context]  — { actorId, ipAddress, userAgent } para a auditoria
 */
export async function setDocumentStatus(documentId, status, reviewer, comments, context = {}) {
    const VALID = [0, 1, 2, 3, 4, 5];
    if (!VALID.includes(status)) {
        return { success: false, status: 400, message: 'Status inválido. Use 0..5.' };
    }

    if (comments !== undefined && comments !== null && typeof comments !== 'string') {
        return { success: false, status: 400, message: 'Observação inválida.' };
    }
    const observation = typeof comments === 'string' && comments.trim() ? comments.trim() : null;
    if (observation && observation.length > OBSERVATION_MAX_LENGTH) {
        return { success: false, status: 400, message: `A observação pode ter no máximo ${OBSERVATION_MAX_LENGTH} caracteres.` };
    }
    if (STATUS_NEEDS_OBSERVATION.includes(status) && !observation) {
        return {
            success: false,
            status: 400,
            message: 'Informe a observação: o fornecedor precisa saber o motivo da reprovação ou do reenvio.',
        };
    }

    try {
        const delivery = await deliveryModel.getDeliveryForReview(documentId);
        if (!delivery) {
            return { success: false, status: 404, message: 'Documento não encontrado.' };
        }
        if (!delivery.is_current) {
            return {
                success: false,
                status: 400,
                message: 'Esta entrega foi substituída por um envio mais novo. Altere o status da entrega atual.',
            };
        }
        if (delivery.status === status && (delivery.observation ?? null) === observation) {
            return { success: true, body: { message: 'Nenhuma alteração para salvar.' } };
        }

        const { manualDecision, finalStatus } = reviewDecision(status);
        await trasaction.executarEmTransacao(async (transaction) => {
            await documentValidationModel.updateDocumentStatus(transaction, documentId, status);
            await documentValidationModel.insertManualReview(transaction, {
                documentId,
                reviewerId: reviewer.id,
                reviewerDepartment: reviewer.department !== undefined ? String(reviewer.department) : null,
                manualDecision,
                finalStatus,
                comments: observation,
            });
            await auditModel.insertAuditLog(transaction, collaboratorAuditEntry(
                context,
                AUDIT_ACTIONS.DOCUMENT_STATUS_CHANGE,
                AUDIT_ENTITIES.DOCUMENT,
                documentId,
                { status: delivery.status, observation: delivery.observation ?? null },
                { status, observation },
            ));
        });

        return { success: true, body: { message: 'Status atualizado com sucesso.' } };
    } catch (error) {
        console.error('setDocumentStatus error:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar status do documento.' };
    }
}

// ─────────────────────────────────────────────
// Listagens (painel interno)
// ─────────────────────────────────────────────

export async function listAllDocuments(filters = {}) {
    try {
        const documents = await documentValidationModel.listDocumentsWithValidation(filters);
        return { success: true, body: { documents } };
    } catch (error) {
        console.error('listAllDocuments error:', error);
        return { success: false, message: 'Erro ao listar documentos.' };
    }
}

export async function listManualReviewQueue() {
    try {
        const queue = await documentValidationModel.listReviewQueue();
        return { success: true, body: { queue } };
    } catch (error) {
        console.error('listManualReviewQueue error:', error);
        return { success: false, message: 'Erro ao buscar fila de revisão.' };
    }
}
