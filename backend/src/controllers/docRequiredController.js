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

// ─────────────────────────────────────────────────────────────────────────────
// Endpoints públicos para o portal do fornecedor (sem autenticação interna)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /public/activity_types
 * Retorna todas as activity_types ativas (para o step de atuação do cadastro).
 */
export async function activityTypesPublic(req, res) {
    try {
        const result = await docRequiredService.activityTypesPublic();
        if (result.success) {
            return res.status(200).json({ success: true, body: result.body });
        }
        return res.status(200).json({ success: false, body: result.body });
    } catch (error) {
        console.error('Erro no activityTypesPublic controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * GET /public/regions?state=SP&city=Campin
 * Busca regiões com filtro por estado e/ou cidade parcial.
 */
export async function searchRegions(req, res) {
    try {
        const { state, city } = req.query;
        const result = await docRequiredService.searchRegions({ state, city });
        if (result.success) {
            return res.status(200).json({ success: true, body: result.body });
        }
        return res.status(500).json({ success: false, body: result.body });
    } catch (error) {
        console.error('Erro no searchRegions controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * GET /public/regions/state/:state
 * Retorna todos os IDs de regiões de um estado (para "adicionar estado inteiro").
 */
export async function getRegionIdsByState(req, res) {
    try {
        const { state } = req.params;
        if (!state || state.length !== 2) {
            return res.status(400).json({ success: false, body: { message: 'Informe um UF válido (2 letras).' } });
        }
        const result = await docRequiredService.getRegionIdsByState(state);
        if (result.success) {
            return res.status(200).json({ success: true, body: result.body });
        }
        return res.status(500).json({ success: false, body: result.body });
    } catch (error) {
        console.error('Erro no getRegionIdsByState controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
