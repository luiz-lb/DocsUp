import * as documentTypeService from '../services/documentTypeService.js';
import * as activityService from '../services/activityService.js';

const CATEGORY_FILTERS = ['0', '1', '2', '3'];

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Quem fez a ação e de onde, para a auditoria. Atrás de proxy, req.ip depende do TRUST_PROXY.
function auditContext(req) {
    return {
        actorId: req.usuario?.id ?? null,
        ipAddress: req.ip ? req.ip.replace(/^::ffff:/, '') : null,
        userAgent: req.headers['user-agent'] ?? null,
    };
}

// Converte o resultado do service em resposta HTTP (o service informa o status do erro)
function sendResult(res, result, successStatus = 200) {
    if (result.success) {
        return res.status(successStatus).json({ success: true, body: result.body });
    }
    return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
}

function badRequest(res, message) {
    return res.status(400).json({ success: false, body: { message } });
}

function internalError(res, where, error) {
    console.error(`Erro no ${where} controller:`, error);
    return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
}

// status: '1' = ativos, '0' = inativos, vazio = todos. Retorna { value } ou { error }
function parseStatusFilter(statusParam) {
    if (statusParam === undefined || statusParam === '') return { value: undefined };
    if (statusParam !== '0' && statusParam !== '1') {
        return { error: 'status deve ser 1 (ativos) ou 0 (inativos).' };
    }
    return { value: statusParam === '1' };
}

function parseSearch(searchParam) {
    return typeof searchParam === 'string' ? searchParam.trim().slice(0, 200) : '';
}

// ─────────────────────────────────────────────
// Tipos de documento
// ─────────────────────────────────────────────

/**
 * GET /parameters/document-types?category=0|1|2|3&status=1|0&search=texto
 * Sem paginação; ativos e inativos quando status não vier.
 */
export async function listDocumentTypes(req, res) {
    try {
        const { category: categoryParam, status: statusParam, search: searchParam } = req.query;

        let category;
        if (categoryParam !== undefined && categoryParam !== '') {
            if (!CATEGORY_FILTERS.includes(categoryParam)) {
                return badRequest(res, 'category deve ser 0 (Empresa), 1 (Básico), 2 (NR) ou 3 (Outros).');
            }
            category = Number(categoryParam);
        }

        const status = parseStatusFilter(statusParam);
        if (status.error) return badRequest(res, status.error);

        const result = await documentTypeService.listDocumentTypes({
            category,
            isActive: status.value,
            search: parseSearch(searchParam),
        });
        return sendResult(res, result);
    } catch (error) {
        return internalError(res, 'listDocumentTypes', error);
    }
}

/** POST /parameters/document-types  Body: { name, description?, category, hasExpiration, validityDays, code? } */
export async function createDocumentType(req, res) {
    try {
        const { name, description, category, hasExpiration, validityDays, code } = req.body ?? {};
        const result = await documentTypeService.createDocumentType(
            { name, description, category, hasExpiration, validityDays, code },
            auditContext(req),
        );
        return sendResult(res, result, 201);
    } catch (error) {
        return internalError(res, 'createDocumentType', error);
    }
}

/** PUT /parameters/document-types/:id  Body: { name, description?, hasExpiration, validityDays, category?, code? } */
export async function updateDocumentType(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) return badRequest(res, 'Id de tipo de documento inválido.');

        const { name, description, category, hasExpiration, validityDays, code } = req.body ?? {};
        const result = await documentTypeService.updateDocumentType(
            id,
            { name, description, category, hasExpiration, validityDays, code },
            auditContext(req),
        );
        return sendResult(res, result);
    } catch (error) {
        return internalError(res, 'updateDocumentType', error);
    }
}

/** PUT /parameters/document-types/:id/status  Body: { isActive: boolean } */
export async function setDocumentTypeStatus(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) return badRequest(res, 'Id de tipo de documento inválido.');

        const result = await documentTypeService.setDocumentTypeStatus(id, req.body?.isActive, auditContext(req));
        return sendResult(res, result);
    } catch (error) {
        return internalError(res, 'setDocumentTypeStatus', error);
    }
}

// ─────────────────────────────────────────────
// Atividades
// ─────────────────────────────────────────────

/** GET /parameters/activities?status=1|0&search=texto  (ordenadas por nome, sem paginação) */
export async function listActivities(req, res) {
    try {
        const { status: statusParam, search: searchParam } = req.query;

        const status = parseStatusFilter(statusParam);
        if (status.error) return badRequest(res, status.error);

        const result = await activityService.listActivities({
            isActive: status.value,
            search: parseSearch(searchParam),
        });
        return sendResult(res, result);
    } catch (error) {
        return internalError(res, 'listActivities', error);
    }
}

/** POST /parameters/activities  Body: { name, description?, riskLevel, documentTypeIds } */
export async function createActivity(req, res) {
    try {
        const { name, description, riskLevel, documentTypeIds } = req.body ?? {};
        const result = await activityService.createActivity(
            { name, description, riskLevel, documentTypeIds },
            auditContext(req),
        );
        return sendResult(res, result, 201);
    } catch (error) {
        return internalError(res, 'createActivity', error);
    }
}

/** PUT /parameters/activities/:id  Body: { name, description?, riskLevel, documentTypeIds } */
export async function updateActivity(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) return badRequest(res, 'Id de atividade inválido.');

        const { name, description, riskLevel, documentTypeIds } = req.body ?? {};
        const result = await activityService.updateActivity(
            id,
            { name, description, riskLevel, documentTypeIds },
            auditContext(req),
        );
        return sendResult(res, result);
    } catch (error) {
        return internalError(res, 'updateActivity', error);
    }
}

/** PUT /parameters/activities/:id/status  Body: { isActive: boolean } */
export async function setActivityStatus(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) return badRequest(res, 'Id de atividade inválido.');

        const result = await activityService.setActivityStatus(id, req.body?.isActive, auditContext(req));
        return sendResult(res, result);
    } catch (error) {
        return internalError(res, 'setActivityStatus', error);
    }
}
