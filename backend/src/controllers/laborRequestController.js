import * as laborRequestService from '../services/laborRequestService.js'

export async function createLaborRequest(req,res) {
    try {
        const { activityTypeId, title, description, location, urgency, startDate} = req.body;

        const idUser = req.usuario.id;

        if(!idUser || !activityTypeId || !title ||  !location || !urgency || !startDate){
            return res.status(400).json({ success: false, message: "Falta de informações para criação de solicitação."})
        }

        const result = await laborRequestService.createLaborRequest(idUser, activityTypeId, title, description, location, urgency, startDate);

        if(result.success){
            return res.status(200).json({success: true, body: {message: "Solicitação criada com sucesso.", solicitacaoId: result.body.solicitacaoId}})
        }else{
            return res.status(200).json({success: false, body: {message: result.body.message}})
        }
    } catch (error) {
        console.error('Erro no createLaborRequest  controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function listLaborRequest(req, res) {
    try {
        const result = await laborRequestService.listLaborRequest();

        if(result.success){
            return res.status(200).json({success: true, body: {message: "Solicitações listadas.", result: result.body.solicitacoes}})
        }else{
            return res.status(200).json({success: false, body: {message: result.body.message}})
        }
    } catch (error) {
        console.error('Erro no listLaborRequest controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function listLaborRequestById(req, res) {
    try {
        const { id } = req.params;

        const idLaborRequest = Number(id);

        if(!Number.isInteger(idLaborRequest) || idLaborRequest <= 0){
            return res.status(400).json({ success: false, body: { message: "O id da solicitação deve ser um número inteiro válido." } });
        }

        const result = await laborRequestService.listLaborRequestById(idLaborRequest);

        if(result.success){
            return res.status(200).json({success: true, body: {message: "Solicitação encontrada.", result: result.body.solicitacao}})
        }else{
            return res.status(200).json({success: false, body: {message: result.body.message}})
        }
    } catch (error) {
        console.error('Erro no listLaborRequestById controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function updateDocsToResquest(req,res) {
    try {
        const { documentsRequired, NrsRequired, description, location, urgency } = req.body;

    } catch (error) {
        console.error('Erro no createLaborRequest  controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}