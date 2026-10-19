import { AUDIT_ACTOR_TYPES } from '../constants/audit.js';

// Igualdade para a auditoria: arrays (ex.: ids ordenados) comparam item a item
function sameValue(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((value, index) => value === b[index]);
    }
    return a === b;
}

/**
 * Só os campos que mudaram: { oldValues, newValues }, ou null se nada mudou.
 * Compara as chaves de `after` com as de `before`.
 */
export function changedFields(before, after) {
    const oldValues = {};
    const newValues = {};
    for (const key of Object.keys(after)) {
        if (!sameValue(before[key], after[key])) {
            oldValues[key] = before[key];
            newValues[key] = after[key];
        }
    }
    return Object.keys(newValues).length > 0 ? { oldValues, newValues } : null;
}

/**
 * Monta o registro de auditoria de uma ação de um colaborador (Admin).
 * `context` vem do controller: { actorId, ipAddress, userAgent }.
 */
export function collaboratorAuditEntry(context, action, entityType, entityId, oldValues, newValues) {
    return {
        actorType: AUDIT_ACTOR_TYPES.COLLABORATOR,
        actorId: context.actorId ?? null,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
    };
}
