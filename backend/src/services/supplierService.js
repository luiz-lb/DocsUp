import * as supplierModel from '../models/supplierModel.js';
import * as supplierUserModel from '../models/supplierUserModel.js';

// ─────────────────────────────────────────────
// Painel interno — listagem e detalhe de fornecedores
// ─────────────────────────────────────────────

/**
 * Lista fornecedores cadastrados (painel interno de Suprimentos).
 */
export async function listSuppliers(filters = {}) {
    try {
        const suppliers = await supplierModel.listSuppliers(filters);
        return { success: true, body: { suppliers } };
    } catch (error) {
        console.error('listSuppliers service error:', error);
        return { success: false, message: 'Erro ao listar fornecedores.' };
    }
}

/**
 * Detalhe de um fornecedor: dados da empresa e os usuários (Responsável e Operador).
 */
export async function getSupplierDetail(supplierId) {
    try {
        const supplier = await supplierModel.getSupplierProfile(supplierId);
        if (!supplier) {
            return { success: false, message: 'Fornecedor não encontrado.' };
        }
        const users = await supplierUserModel.listUsersBySupplier(supplierId);
        return { success: true, body: { supplier, users } };
    } catch (error) {
        console.error('getSupplierDetail service error:', error);
        return { success: false, message: 'Erro ao buscar o fornecedor.' };
    }
}
