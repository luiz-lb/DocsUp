import * as deliveryModel from '../models/deliveryModel.js';

/**
 * Histórico de entregas do documento (todas as entregas da mesma vaga, mais nova primeiro),
 * com a observação da última análise de cada uma. Usado pelo RH / Segurança.
 */
export async function getDocumentHistory(documentId) {
    try {
        const deliveries = await deliveryModel.getDeliveryHistory(documentId);
        if (deliveries.length === 0) {
            return { success: false, status: 404, message: 'Documento não encontrado.' };
        }
        return { success: true, body: { deliveries } };
    } catch (error) {
        console.error('Erro no getDocumentHistory service:', error);
        return { success: false, status: 500, message: 'Erro ao buscar o histórico do documento.' };
    }
}

/**
 * Agrupa as entregas de um fornecedor numa solicitação por documento (tipo + colaborador).
 * Retorna um Map 'tipo:colaborador' → entregas (mais nova primeiro).
 */
export function groupDeliveriesBySlot(deliveries) {
    const bySlot = new Map();
    for (const { document_type_id: typeId, employee_id: employeeId, ...delivery } of deliveries) {
        const key = `${typeId}:${employeeId ?? 'empresa'}`;
        if (!bySlot.has(key)) bySlot.set(key, []);
        bySlot.get(key).push(delivery);
    }
    return bySlot;
}

/**
 * Entrega como o fornecedor vê: sem quem analisou nem quando (dados internos do RH).
 */
export function toSupplierDelivery(delivery) {
    return {
        id: delivery.id,
        version: delivery.version,
        is_current: delivery.is_current,
        status: delivery.status,
        file_name: delivery.file_name,
        expires_at: delivery.expires_at,
        uploaded_at: delivery.uploaded_at,
        observation: delivery.observation,
    };
}

/** Chave da vaga de um documento atual (mesma regra de groupDeliveriesBySlot). */
export function slotKey(document) {
    return `${document.document_type_id}:${document.employee_id ?? 'empresa'}`;
}
