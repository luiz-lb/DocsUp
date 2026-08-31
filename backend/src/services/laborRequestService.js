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

export async function listLaborRequest() {
    try {
        const result = await laborRequestModel.getLaborRequest()

        if(!result){
            console.error('Erro ao listar solicitação no banco de dados.');
            return {success: false, body: { message: "Erro ao listar solicitação no banco de dados." }}
        }
        else {
            return {success: true, body: { message: "Solicitações listadas com sucesso.", solicitacoes: result }}
        }
    } catch (error) {
        console.error('Erro no createLaborRequest service:', error);
        return {success: false, body: { message: "Ero ao buscar solicitações." }}
    }
}

export async function listLaborRequestById(id) {
    try {
        const result = await laborRequestModel.getLaborRequestById(id);

        if(!result){
            return {success: false, body: { message: "Solicitação não encontrada." } }
        }
        else {
            return {success: true, body: { message: "Solicitação encontrada com sucesso.", solicitacao: result }}
        }
    } catch (error) {
        console.error('Erro no listLaborRequestById service:', error);
        return {success: false, body: { message: "Erro ao buscar solicitação." }}
    }
}