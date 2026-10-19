import * as laborRequestModel from '../models/laborRequestModel.js'
import * as documentTypeModel from '../models/documentTypeModel.js'
import * as docRequiredModel from '../models/docRequiredModel.js'
import * as trasaction from '../models/trasaction.js'
import { DOCUMENT_CATEGORIES } from '../constants/documentCategories.js'
import { toInteger } from '../utils/parse.js'

// Categorias que a Segurança escolhe na aprovação: empresa e outros do colaborador.
// Os básicos entram sempre (todos os ativos); as NRs vêm em nrTypeIds.
const CHOSEN_DOCUMENT_CATEGORIES = [DOCUMENT_CATEGORIES.COMPANY, DOCUMENT_CATEGORIES.EMPLOYEE_OTHER];

// Lista de ids inteiros positivos, sem repetição; null se algum item for inválido
function uniqueIds(values) {
    const ids = values.map(toInteger);
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null;
    return [...new Set(ids)];
}

/**
 * Exigências da aprovação. A Segurança escolhe os documentos da empresa (ao menos um),
 * os outros do colaborador e as NRs (opcionais). Os básicos ativos entram sempre e
 * ficam gravados: a solicitação guarda os básicos do momento da aprovação (um básico
 * enviado na lista é aceito, mas não faz diferença).
 *
 * Retorna { documentTypeIds, nrTypeIds } ou { error }.
 */
async function resolveApprovalRequirements(documentTypeIds, nrTypeIds) {
    if (!Array.isArray(documentTypeIds) || (nrTypeIds !== undefined && nrTypeIds !== null && !Array.isArray(nrTypeIds))) {
        return { error: "Informe os documentos e as NRs exigidos em listas." }
    }

    const docIds = uniqueIds(documentTypeIds);
    if (!docIds) return { error: "Documento exigido inválido." }

    const nrIds = uniqueIds(nrTypeIds ?? []);
    if (!nrIds) return { error: "NR inválida." }

    // Documentos escolhidos: ativos, da empresa ou outros do colaborador (básico é ignorado)
    const rows = await documentTypeModel.getDocumentTypesByIds(docIds);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const chosen = [];
    for (const id of docIds) {
        const row = byId.get(id);
        if (!row || !row.is_active) return { error: "Documento exigido inválido." }
        if (row.category === DOCUMENT_CATEGORIES.EMPLOYEE_BASIC) continue;
        if (!CHOSEN_DOCUMENT_CATEGORIES.includes(row.category)) return { error: "Documento exigido inválido." }
        chosen.push(row);
    }

    if (!chosen.some((row) => row.category === DOCUMENT_CATEGORIES.COMPANY)) {
        return { error: "Informe ao menos um documento da empresa para aprovar." }
    }

    // NRs: só as que têm o tipo de documento ativo (as mesmas que o painel lista)
    const activeNrIds = new Set((await docRequiredModel.getNrTypes()).map((nr) => nr.id));
    if (nrIds.some((id) => !activeNrIds.has(id))) return { error: "NR inválida." }

    const basicIds = await documentTypeModel.getActiveDocumentTypeIdsByCategory(DOCUMENT_CATEGORIES.EMPLOYEE_BASIC);

    return {
        documentTypeIds: [...new Set([...chosen.map((row) => row.id), ...basicIds])],
        nrTypeIds: nrIds,
    }
}

export async function createLaborRequest(idUser, idActivityType, title, description, location, urgency, startDate) {
    let trasactionNumber;
    let transacaoConcluida = false;

    try {
        trasactionNumber = await trasaction.iniciarTransacao();

        const result = await laborRequestModel.laborRequestNew(trasactionNumber, idUser, idActivityType, title, description, location, urgency, startDate);

        if(!result){
            await trasaction.finalizarTransacao(trasactionNumber, false);
            transacaoConcluida = true;
            console.error('Erro ao adicionar solicitação no banco de dados.');
            return {success: false, body: { message: "Erro ao adicionar solicitação no banco de dados." }}
        }

        // Cria aprovação pendente para Segurança do Trabalho (department = 1)
        const createAprovals = await laborRequestModel.createLaborRequestAprovals(trasactionNumber, result.id, 1);

        if(!createAprovals){
            await trasaction.finalizarTransacao(trasactionNumber, false);
            transacaoConcluida = true;
            console.error('Erro ao criar aprovação.');
            return {success: false, body: { message: "Erro ao criar aprovação." }}
        }
        
        await trasaction.finalizarTransacao(trasactionNumber, true)

        transacaoConcluida = true;
        return {success: true, body: { message: "Solicitação criada com sucesso.", solicitacaoId: result.id }}
    } catch (error) {
        if(trasactionNumber && !transacaoConcluida){
            await trasaction.finalizarTransacao(trasactionNumber, false)
        }
        console.error('Erro no createLaborRequest service:', error);
        return {success: false, body: { message: "Erro ao criar solicitação." }}
    }
}

export async function listLaborRequest({ page = 1, limit = 10, search = '', status, urgency } = {}) {
    try {
        const { rows, total } = await laborRequestModel.getLaborRequest({ page, limit, search, status, urgency });
        const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

        return {
            success: true,
            body: {
                message: "Solicitações listadas com sucesso.",
                solicitacoes: rows,
                pagination: { page, limit, total, totalPages },
            },
        }
    } catch (error) {
        console.error('Erro no listLaborRequest service:', error);
        return {success: false, body: { message: "Erro ao buscar solicitações." }}
    }
}

export async function listLaborRequestById(id) {
    try {
        const result = await laborRequestModel.getLaborRequestById(id);

        if(!result){
            return {success: false, body: { message: "Solicitação não encontrada." } }
        }

        // Busca documentos obrigatórios e NRs obrigatórias já definidas
        const requiredDocuments = await laborRequestModel.getLaborRequestDocuments(id);
        const requiredNrTypes   = await laborRequestModel.getLaborRequestNrs(id);

        return {success: true, body: { message: "Solicitação encontrada com sucesso.", solicitacao: { ...result, requiredDocuments, requiredNrTypes } }}
    } catch (error) {
        console.error('Erro no listLaborRequestById service:', error);
        return {success: false, body: { message: "Erro ao buscar solicitação." }}
    }
}

/**
 * Busca as aprovações de uma solicitação.
 */
export async function listApprovals(laborRequestId) {
    try {
        const approvals = await laborRequestModel.getApprovalsByLaborRequestId(laborRequestId);
        return {success: true, body: { approvals }}
    } catch (error) {
        console.error('Erro no listApprovals service:', error);
        return {success: false, body: { message: "Erro ao buscar aprovações." }}
    }
}

/**
 * Processa a decisão de aprovação de Segurança do Trabalho.
 *
 * Regras de status da labor_request:
 *  - Reprovação → status 2 (Reprovado)
 *  - Aprovação  → status 3 (Em Cotação)
 *
 * Ao aprovar (decision=2), a Segurança do Trabalho define:
 *  - documentTypeIds[] → empresa (ao menos um) e outros do colaborador, persistidos em
 *                        labor_request_documents junto com todos os básicos ativos
 *  - nrTypeIds[]       → NRs (opcionais), persistidas em labor_request_NRs
 */
export async function approveRequest(laborRequestId, approverId, department, decision, comments, documentTypeIds, nrTypeIds) {
    let transaction;
    let transactionDone = false;

    try {
        const request = await laborRequestModel.getLaborRequestById(laborRequestId);
        if (!request) {
            return {success: false, body: { message: "Solicitação não encontrada." }}
        }

        if (request.status !== 0) {
            return {success: false, body: { message: "Esta solicitação não está pendente de aprovação." }}
        }

        // Ao aprovar: ao menos um documento da empresa; NRs e outros do colaborador são
        // opcionais; os básicos ativos entram sempre
        let requirements = null;
        if (decision === 2) {
            requirements = await resolveApprovalRequirements(documentTypeIds, nrTypeIds);
            if (requirements.error) {
                return {success: false, body: { message: requirements.error }}
            }
        }

        transaction = await trasaction.iniciarTransacao();

        // Registra a decisão na tabela de aprovações (comments é texto puro)
        const updated = await laborRequestModel.setApprovalDecision(
            transaction, laborRequestId, approverId, department, decision, comments ?? null
        );

        if (!updated) {
            await trasaction.finalizarTransacao(transaction, false);
            transactionDone = true;
            return {success: false, body: { message: "Aprovação não encontrada para este departamento." }}
        }

        if (decision === 2) {
            // Salva documentos obrigatórios (labor_request_documents): empresa, outros e básicos
            await laborRequestModel.deleteLaborRequestDocuments(transaction, laborRequestId);
            for (const docTypeId of requirements.documentTypeIds) {
                await laborRequestModel.insertLaborRequestDocument(
                    transaction, laborRequestId, docTypeId, approverId, null
                );
            }

            // Salva NRs obrigatórias (labor_request_NRs)
            await laborRequestModel.deleteLaborRequestNrs(transaction, laborRequestId);
            for (const nrTypeId of requirements.nrTypeIds) {
                await laborRequestModel.insertLaborRequestNr(
                    transaction, laborRequestId, nrTypeId, approverId
                );
            }
        }

        // Novo status: reprovado=2, aprovado=3 (Em Cotação)
        let newStatus = request.status;
        if (decision === 1) newStatus = 2;
        else if (decision === 2) newStatus = 3;

        await laborRequestModel.updateLaborRequestStatus(transaction, laborRequestId, newStatus, approverId);

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        return {success: true, body: { message: "Decisão registrada com sucesso.", newStatus }}
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('Erro no approveRequest service:', error);
        return {success: false, body: { message: "Erro ao processar aprovação." }}
    }
}
