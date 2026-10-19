import * as activityModel from '../models/activityModel.js';
import * as documentTypeModel from '../models/documentTypeModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { DOCUMENT_CATEGORIES } from '../constants/documentCategories.js';
import { changedFields, collaboratorAuditEntry } from '../utils/audit.js';
import { isBlank, toInteger } from '../utils/parse.js';

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;
// activity_types.risk_level: 0=Baixo, 1=Médio, 2=Alto, 3=Crítico
const RISK_LEVELS = [0, 1, 2, 3];

// Violação de UNIQUE no SQL Server (UQ_activity_types_name)
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];

const ACTIVITY_NOT_FOUND = { success: false, status: 404, message: 'Atividade não encontrada.' };
const NAME_IN_USE = { success: false, status: 409, message: 'Já existe uma atividade com este nome.' };
const INVALID_SUGGESTION = { success: false, status: 400, message: 'Documento sugerido inválido.' };
const BASIC_SUGGESTION = {
    success: false,
    status: 400,
    message: 'Os documentos básicos já são exigidos de todo colaborador e não entram como sugestão.',
};

function badRequest(message) {
    return { success: false, status: 400, message };
}

// ─────────────────────────────────────────────
// Validação
// ─────────────────────────────────────────────

// Retorna { value } ou { error }
function validateName(name) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return { error: 'Informe o nome.' };
    if (cleanName.length > NAME_MAX_LENGTH) return { error: `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.` };
    return { value: cleanName };
}

// Descrição opcional. Retorna { value } (texto ou null) ou { error }
function validateDescription(description) {
    if (isBlank(description)) return { value: null };
    if (typeof description !== 'string') return { error: 'Descrição inválida.' };

    const cleanDescription = description.trim();
    if (cleanDescription.length > DESCRIPTION_MAX_LENGTH) {
        return { error: `A descrição pode ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.` };
    }
    return { value: cleanDescription };
}

// Nível de risco opcional (0 a 3). Retorna { value } (número ou null) ou { error }
function validateRiskLevel(riskLevel) {
    if (isBlank(riskLevel)) return { value: null };
    const level = toInteger(riskLevel);
    if (!RISK_LEVELS.includes(level)) return { error: 'Selecione um nível de risco válido.' };
    return { value: level };
}

// Lista de ids de tipo de documento: sem repetição e em ordem crescente. Retorna { value } ou { error }
function parseDocumentTypeIds(documentTypeIds) {
    if (documentTypeIds === undefined || documentTypeIds === null) return { value: [] };
    if (!Array.isArray(documentTypeIds)) return { error: INVALID_SUGGESTION };

    const ids = documentTypeIds.map(toInteger);
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return { error: INVALID_SUGGESTION };

    return { value: [...new Set(ids)].sort((a, b) => a - b) };
}

/**
 * Cada sugestão tem de existir, estar ativa e ser de categoria 0, 2 ou 3
 * (básico é sempre exigido, não é sugestão). Um tipo inativo só passa se já estava
 * ligado à atividade (`linkedIds`): editar a atividade não obriga a tirar a sugestão,
 * mas não dá para sugerir um tipo inativo novo. Retorna null se estiver tudo certo.
 */
async function checkSuggestedDocuments(ids, linkedIds = []) {
    if (ids.length === 0) return null;

    const rows = await documentTypeModel.getDocumentTypesByIds(ids);
    const byId = new Map(rows.map((row) => [row.id, row]));

    if (ids.some((id) => !byId.has(id))) return INVALID_SUGGESTION;
    if (rows.some((row) => row.category === DOCUMENT_CATEGORIES.EMPLOYEE_BASIC)) return BASIC_SUGGESTION;
    if (rows.some((row) => !row.is_active && !linkedIds.includes(row.id))) return INVALID_SUGGESTION;
    return null;
}

// ─────────────────────────────────────────────
// Auditoria
// ─────────────────────────────────────────────

// Campos da atividade que entram na auditoria (document_type_ids em ordem crescente)
function auditSnapshot(activity, documentTypeIds) {
    return {
        name: activity.name,
        description: activity.description ?? null,
        risk_level: activity.risk_level ?? null,
        is_active: Boolean(activity.is_active),
        document_type_ids: documentTypeIds,
    };
}

function activityAuditEntry(context, action, activityId, oldValues, newValues) {
    return collaboratorAuditEntry(context, action, AUDIT_ENTITIES.ACTIVITY, activityId, oldValues, newValues);
}

// ─────────────────────────────────────────────
// Casos de uso
// ─────────────────────────────────────────────

export async function listActivities({ isActive, search = '' } = {}) {
    try {
        const result = await activityModel.listActivities({ isActive, search });
        return { success: true, body: { message: 'Atividades listadas com sucesso.', result } };
    } catch (error) {
        console.error('Erro no listActivities service:', error);
        return { success: false, status: 500, message: 'Erro ao buscar as atividades.' };
    }
}

/** Cria uma atividade ativa com os documentos sugeridos (colunas legado ficam NULL). */
export async function createActivity(payload = {}, context = {}) {
    const nameResult = validateName(payload.name);
    if (nameResult.error) return badRequest(nameResult.error);

    const descriptionResult = validateDescription(payload.description);
    if (descriptionResult.error) return badRequest(descriptionResult.error);

    const riskResult = validateRiskLevel(payload.riskLevel);
    if (riskResult.error) return badRequest(riskResult.error);

    const idsResult = parseDocumentTypeIds(payload.documentTypeIds);
    if (idsResult.error) return idsResult.error;

    const data = { name: nameResult.value, description: descriptionResult.value, riskLevel: riskResult.value };
    const documentTypeIds = idsResult.value;

    try {
        if (await activityModel.activityNameInUse(data.name)) return NAME_IN_USE;

        const suggestionError = await checkSuggestedDocuments(documentTypeIds);
        if (suggestionError) return suggestionError;

        // Atividade, sugestões e auditoria na mesma transação
        const id = await trasaction.executarEmTransacao(async (transaction) => {
            const newId = await activityModel.insertActivity(transaction, data);
            if (documentTypeIds.length > 0) {
                await activityModel.replaceActivityDocuments(transaction, newId, documentTypeIds);
            }
            await auditModel.insertAuditLog(transaction, activityAuditEntry(
                context,
                AUDIT_ACTIONS.ACTIVITY_CREATE,
                newId,
                null,
                auditSnapshot(
                    { name: data.name, description: data.description, risk_level: data.riskLevel, is_active: true },
                    documentTypeIds,
                ),
            ));
            return newId;
        });

        const activity = await activityModel.getActivityById(id);
        console.log(`Atividade ${id} criada.`);
        return { success: true, body: { message: 'Atividade criada com sucesso.', activity } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return NAME_IN_USE;
        console.error('Erro no createActivity service:', error);
        return { success: false, status: 500, message: 'Erro ao criar a atividade.' };
    }
}

/**
 * Edita a atividade e substitui os documentos sugeridos. Campos que não vierem
 * (description, riskLevel, documentTypeIds) ficam como estão. Só grava e audita o que mudou.
 */
export async function updateActivity(id, payload = {}, context = {}) {
    const nameResult = validateName(payload.name);
    if (nameResult.error) return badRequest(nameResult.error);

    try {
        const before = await activityModel.getActivityById(id);
        if (!before) return ACTIVITY_NOT_FOUND;

        // Estado real gravado (inclusive sugestões que deixaram de valer, ex.: tipo inativado)
        const beforeIds = await activityModel.getActivityDocumentTypeIds(id);

        let description = before.description ?? null;
        if (payload.description !== undefined) {
            const descriptionResult = validateDescription(payload.description);
            if (descriptionResult.error) return badRequest(descriptionResult.error);
            description = descriptionResult.value;
        }

        let riskLevel = before.risk_level ?? null;
        if (payload.riskLevel !== undefined) {
            const riskResult = validateRiskLevel(payload.riskLevel);
            if (riskResult.error) return badRequest(riskResult.error);
            riskLevel = riskResult.value;
        }

        let documentTypeIds = beforeIds;
        if (payload.documentTypeIds !== undefined) {
            const idsResult = parseDocumentTypeIds(payload.documentTypeIds);
            if (idsResult.error) return idsResult.error;
            documentTypeIds = idsResult.value;

            const suggestionError = await checkSuggestedDocuments(documentTypeIds, beforeIds);
            if (suggestionError) return suggestionError;
        }

        const changes = changedFields(
            auditSnapshot(before, beforeIds),
            auditSnapshot(
                { name: nameResult.value, description, risk_level: riskLevel, is_active: before.is_active },
                documentTypeIds,
            ),
        );
        if (!changes) {
            return { success: true, body: { message: 'Nenhuma alteração para salvar.', activity: before } };
        }

        if (nameResult.value !== before.name && await activityModel.activityNameInUse(nameResult.value, id)) {
            return NAME_IN_USE;
        }

        await trasaction.executarEmTransacao(async (transaction) => {
            await activityModel.updateActivity(transaction, id, { name: nameResult.value, description, riskLevel });
            if ('document_type_ids' in changes.newValues) {
                await activityModel.replaceActivityDocuments(transaction, id, documentTypeIds);
            }
            await auditModel.insertAuditLog(transaction, activityAuditEntry(
                context, AUDIT_ACTIONS.ACTIVITY_UPDATE, id, changes.oldValues, changes.newValues,
            ));
        });

        const activity = await activityModel.getActivityById(id);
        console.log(`Atividade ${id} atualizada.`);
        return { success: true, body: { message: 'Atividade atualizada com sucesso.', activity } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return NAME_IN_USE;
        console.error('Erro no updateActivity service:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar a atividade.' };
    }
}

/**
 * Ativa ou inativa uma atividade (idempotente: só grava e audita se mudou).
 * Inativa some da abertura de solicitação e do cadastro de fornecedor.
 */
export async function setActivityStatus(id, isActive, context = {}) {
    if (typeof isActive !== 'boolean') {
        return badRequest('Informe se a atividade fica ativa (true) ou inativa (false).');
    }

    try {
        const before = await activityModel.getActivityById(id);
        if (!before) return ACTIVITY_NOT_FOUND;

        if (Boolean(before.is_active) !== isActive) {
            await trasaction.executarEmTransacao(async (transaction) => {
                await activityModel.setActivityActive(transaction, id, isActive);
                await auditModel.insertAuditLog(transaction, activityAuditEntry(
                    context,
                    isActive ? AUDIT_ACTIONS.ACTIVITY_ACTIVATE : AUDIT_ACTIONS.ACTIVITY_INACTIVATE,
                    id,
                    { is_active: !isActive },
                    { is_active: isActive },
                ));
            });
            console.log(`Atividade ${id} ${isActive ? 'ativada' : 'inativada'}.`);
        }

        const activity = await activityModel.getActivityById(id);
        return {
            success: true,
            body: { message: isActive ? 'Atividade ativada.' : 'Atividade inativada.', activity },
        };
    } catch (error) {
        console.error('Erro no setActivityStatus service:', error);
        return { success: false, status: 500, message: 'Erro ao alterar o status da atividade.' };
    }
}
