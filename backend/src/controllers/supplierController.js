import * as supplierService from '../services/supplierService.js';

const ALLOWED_STATUS = [0, 1, 2, 3];

/**
 * GET /suppliers  — lista fornecedores (painel interno).
 * Query: search?, status?
 */
export async function listSuppliers(req, res) {
    try {
        const { search, status } = req.query;

        let statusNum;
        if (status !== undefined && status !== '') {
            statusNum = Number(status);
            if (!ALLOWED_STATUS.includes(statusNum)) {
                return res.status(400).json({ success: false, body: { message: 'Status inválido.' } });
            }
        }

        const result = await supplierService.listSuppliers({
            search: typeof search === 'string' ? search.trim().slice(0, 200) : '',
            status: statusNum,
        });

        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('listSuppliers controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * GET /suppliers/:id  — detalhe de um fornecedor (painel interno).
 */
export async function getSupplierDetail(req, res) {
    try {
        const supplierId = Number(req.params.id);
        if (!Number.isInteger(supplierId) || supplierId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'ID inválido.' } });
        }

        const result = await supplierService.getSupplierDetail(supplierId);
        if (!result.success) {
            return res.status(404).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getSupplierDetail controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
