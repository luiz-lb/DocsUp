import * as docRequiredService from '../services/docRequiredService.js'

export async function activityTypes(req,res){
    try {
        const result = await docRequiredService.activityTypes();

        if(result.success){
            return res.status(200).json({success: true, body: result.body})
        }else{
            return res.status(200).json({success: false, body: result.body})
        }
    } catch (error) {
        console.error('Erro no activityTypes controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function nr_types(req,res) {
    try {
        const result = await docRequiredService.nrTypes();

        if(result.success){
            return res.status(200).json({success: true, body: result.body})
        }else{
            return res.status(200).json({success: false, body: result.body})
        }
    } catch (error) {
        console.error('Erro no nr_types controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function document_types(req,res) {
    try {
        const result = await docRequiredService.documentTypes();

        if(result.success){
            return res.status(200).json({success: true, body: result.body})
        }else{
            return res.status(200).json({success: false, body: result.body})
        }
    } catch (error) {
        console.error('Erro no document_types controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}