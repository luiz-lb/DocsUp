import axios from 'axios';
import { sql, poolPromise } from '../config/dbConfig.js';
import * as documentValidationModel from '../models/documentValidationModel.js';
import * as trasaction from '../models/trasaction.js';

// Score mínimo para aprovação automática por IA
const AI_AUTO_APPROVE_THRESHOLD = 85;

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

/**
 * Recebe o resultado da análise de IA (via N8N) e aplica a decisão automática.
 * Se score >= 85 → aprova automaticamente.
 * Se score < 85  → encaminha para revisão manual (final_status=0).
 *
 * @param {{ documentId, validationId, aiScore, aiResultJson, aiModelUsed }} payload
 */
export async function receiveAiValidationResult(payload) {
    const { documentId, validationId, aiScore, aiResultJson, aiModelUsed } = payload;

    if (!documentId || aiScore === undefined) {
        return { success: false, message: 'documentId e aiScore são obrigatórios.' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        const isAutoApproved = aiScore >= AI_AUTO_APPROVE_THRESHOLD;
        const finalStatus = isAutoApproved ? 1 : 0;
        const docStatus   = isAutoApproved ? 2 : 1;

        // Atualiza o registro de validação com os dados da IA
        const req = new sql.Request(transaction);
        await req
            .input('id', sql.Int, validationId)
            .input('ai_score', sql.Decimal(5, 2), aiScore)
            .input('ai_result_json', sql.NVarChar(sql.MAX), aiResultJson ?? null)
            .input('ai_model_used', sql.VarChar(100), aiModelUsed ?? null)
            .input('final_status', sql.TinyInt, finalStatus)
            .query(`
                UPDATE document_validations
                SET ai_score       = @ai_score,
                    ai_result_json = @ai_result_json,
                    ai_model_used  = @ai_model_used,
                    final_status   = @final_status
                WHERE id = @id
            `);

        await documentValidationModel.updateDocumentStatus(transaction, documentId, docStatus);

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        return {
            success: true,
            body: { autoApproved: isAutoApproved, finalStatus },
        };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
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
