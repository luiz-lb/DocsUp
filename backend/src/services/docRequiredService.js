import * as docRequiredModel from '../models/docRequiredModel.js'

export async function activityTypes() {
    try {
        const result = await docRequiredModel.getActivityTypes();

        if(!result || result.length === 0){
            console.error('activityTypes service: nenhum tipo de atividade encontrado.');
            return {success: false, body: { message: "Nenhum tipo de atividade encontrado." }}
        }
        else {
            console.log(`activityTypes service: ${result.length} tipo(s) de atividade encontrado(s).`);
            return {success: true, body: { message: "Tipos de atividade buscados com sucesso.", result }}
        }
    } catch (error) {
        console.error('Erro no activityTypes service:', error);
        return {success: false, body: { message: "Erro ao buscar os tipos de atividade." }}
    }
}

export async function nrTypes() {
    try {
        const result = await docRequiredModel.getNrTypes();

        if(!result || result.length === 0){
            console.error('nrTypes service: nenhuma NR encontrada.');
            return {success: false, body: { message: "Nenhuma NR encontrada." }}
        }
        else {
            console.log(`nrTypes service: ${result.length} NR(s) encontrada(s).`);
            return {success: true, body: { message: "NRs buscadas com sucesso.", result }}
        }
    } catch (error) {
        console.error('Erro no nrTypes service:', error);
        return {success: false, body: { message: "Erro ao buscar as NRs." }}
    }
}

export async function documentTypes() {
    try {
        const result = await docRequiredModel.getDocumentTypes();

        if(!result || result.length === 0){
            console.error('documentTypes service: nenhum tipo de documento encontrado.');
            return {success: false, body: { message: "Nenhum tipo de documento encontrado." }}
        }
        else {
            console.log(`documentTypes service: ${result.length} tipo(s) de documento encontrado(s).`);
            return {success: true, body: { message: "Tipos de documento buscados com sucesso.", result }}
        }
    } catch (error) {
        console.error('Erro no documentTypes service:', error);
        return {success: false, body: { message: "Erro ao buscar os tipos de documento." }}
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Regiões — usadas no cadastro de fornecedor (sem autenticação)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca regiões com filtro por cidade e/ou estado.
 */
export async function searchRegions(filters) {
    try {
        const result = await docRequiredModel.searchRegions(filters);
        return { success: true, body: { result } };
    } catch (error) {
        console.error('Erro no searchRegions service:', error);
        return { success: false, body: { message: 'Erro ao buscar regiões.' } };
    }
}

/**
 * Retorna todos os IDs de regiões de um estado.
 */
export async function getRegionIdsByState(state) {
    try {
        const ids = await docRequiredModel.getRegionIdsByState(state);
        return { success: true, body: { ids } };
    } catch (error) {
        console.error('Erro no getRegionIdsByState service:', error);
        return { success: false, body: { message: 'Erro ao buscar regiões do estado.' } };
    }
}

/**
 * Busca activity_types para o portal do fornecedor (sem restrição de autenticação interna).
 * Reutiliza a mesma função já existente.
 */
export async function activityTypesPublic() {
    return activityTypes();
}
