import * as supplierModel from '../models/supplierModel.js';

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
 * Detalhe completo de um fornecedor: dados, contatos, regiões e categorias.
 */
export async function getSupplierDetail(supplierId) {
    try {
        const supplier = await supplierModel.getSupplierProfile(supplierId);
        if (!supplier) {
            return { success: false, message: 'Fornecedor não encontrado.' };
        }
        const [contacts, regions, categories] = await Promise.all([
            supplierModel.getSupplierContacts(supplierId),
            supplierModel.getSupplierRegions(supplierId),
            supplierModel.getSupplierCategories(supplierId),
        ]);

        return { success: true, body: { supplier, contacts, regions, categories } };
    } catch (error) {
        console.error('getSupplierDetail service error:', error);
        return { success: false, message: 'Erro ao buscar o fornecedor.' };
    }
}
