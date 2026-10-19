import * as auditModel from '../models/auditModel.js';

export async function listAuditLogs({ page = 1, limit = 25, action, from, to, search = '' } = {}) {
    try {
        const { rows, total } = await auditModel.listAuditLogs({ page, limit, action, from, to, search });
        const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

        return {
            success: true,
            body: {
                message: 'Auditoria listada com sucesso.',
                result: rows,
                pagination: { page, limit, total, totalPages },
            },
        };
    } catch (error) {
        console.error('Erro no listAuditLogs service:', error);
        return { success: false, status: 500, message: 'Erro ao buscar a auditoria.' };
    }
}
