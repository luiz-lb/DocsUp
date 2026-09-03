import * as laborRequestModel from '../models/laborRequestModel.js'
import * as trasaction from '../models/trasaction.js'

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
 *  - documentTypeIds[] → persistidos em labor_request_documents
 *  - nrTypeIds[]       → persistidos em labor_request_NRs
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

        // Ao aprovar exige documentos E NRs
        if (decision === 2) {
            if (!documentTypeIds || !Array.isArray(documentTypeIds) || documentTypeIds.length === 0) {
                return {success: false, body: { message: "Informe ao menos um documento obrigatório para aprovar." }}
            }
            if (!nrTypeIds || !Array.isArray(nrTypeIds) || nrTypeIds.length === 0) {
                return {success: false, body: { message: "Informe ao menos uma NR obrigatória para aprovar." }}
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
            // Salva documentos obrigatórios (labor_request_documents)
            await laborRequestModel.deleteLaborRequestDocuments(transaction, laborRequestId);
            for (const docTypeId of documentTypeIds) {
                await laborRequestModel.insertLaborRequestDocument(
                    transaction, laborRequestId, docTypeId, approverId, null
                );
            }

            // Salva NRs obrigatórias (labor_request_NRs)
            await laborRequestModel.deleteLaborRequestNrs(transaction, laborRequestId);
            for (const nrTypeId of nrTypeIds) {
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

/**
 * Segurança do Trabalho atualiza os documentos obrigatórios de uma solicitação
 * que já foi aprovada. Permite ajustes pós-aprovação sem reabrir o fluxo.
 */
export async function updateDocsRequired(laborRequestId, userId, documentTypeIds) {
    let transaction;
    let transactionDone = false;

    try {
        if (!documentTypeIds || !Array.isArray(documentTypeIds) || documentTypeIds.length === 0) {
            return {success: false, body: { message: "Informe ao menos um documento obrigatório." }}
        }

        const request = await laborRequestModel.getLaborRequestById(laborRequestId);
        if (!request) {
            return {success: false, body: { message: "Solicitação não encontrada." }}
        }

        transaction = await trasaction.iniciarTransacao();

        await laborRequestModel.deleteLaborRequestDocuments(transaction, laborRequestId);

        for (const docTypeId of documentTypeIds) {
            await laborRequestModel.insertLaborRequestDocument(
                transaction, laborRequestId, docTypeId, userId, null
            );
        }

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        return {success: true, body: { message: "Documentos obrigatórios atualizados." }}
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('Erro no updateDocsRequired service:', error);
        return {success: false, body: { message: "Erro ao atualizar documentos obrigatórios." }}
    }
}
