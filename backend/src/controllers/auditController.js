import * as auditService from '../services/auditService.js';
import { AUDIT_ACTIONS } from '../constants/audit.js';

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];
const VALID_ACTIONS = Object.values(AUDIT_ACTIONS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /audit-logs?page=1&limit=25&action=user.update&from=2026-10-01&to=2026-10-31&search=texto
 */
export async function listAuditLogs(req, res) {
    try {
        const { page: pageParam, limit: limitParam, action, from, to, search: searchParam } = req.query;

        const page = Math.max(Number.parseInt(pageParam, 10) || 1, 1);
        const parsedLimit = Number.parseInt(limitParam, 10);
        const limit = ALLOWED_PAGE_SIZES.includes(parsedLimit) ? parsedLimit : 25;
        const search = typeof searchParam === 'string' ? searchParam.trim().slice(0, 200) : '';

        if (action && !VALID_ACTIONS.includes(action)) {
            return res.status(400).json({ success: false, body: { message: 'Ação inválida.' } });
        }
        if ((from && !DATE_PATTERN.test(from)) || (to && !DATE_PATTERN.test(to))) {
            return res.status(400).json({ success: false, body: { message: 'Use datas no formato AAAA-MM-DD.' } });
        }

        const result = await auditService.listAuditLogs({
            page,
            limit,
            action: action || undefined,
            from: from || undefined,
            to: to || undefined,
            search,
        });

        if (!result.success) {
            return res.status(result.status ?? 500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('Erro no listAuditLogs controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
