import * as contractProgressModel from '../models/contractProgressModel.js';
import * as laborRequestModel from '../models/laborRequestModel.js';
import * as auditModel from '../models/auditModel.js';
import { collaboratorAuditEntry } from '../utils/audit.js';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES, AUDIT_ENTITIES } from '../constants/audit.js';
import { LABOR_REQUEST_STATUSES } from '../constants/laborRequest.js';

const APPROVED = 2;

/** Auditoria da mudança automática: quem aprovou o último documento, ou o próprio sistema. */
function progressAuditEntry(context, laborRequestId) {
    const oldValues = { status: LABOR_REQUEST_STATUSES.PENDING_DOCUMENTATION };
    const newValues = { status: LABOR_REQUEST_STATUSES.IN_PROGRESS };
    if (context?.actorId) {
        return collaboratorAuditEntry(
            context, AUDIT_ACTIONS.LABOR_REQUEST_IN_PROGRESS, AUDIT_ENTITIES.LABOR_REQUEST, laborRequestId, oldValues, newValues,
        );
    }
    return {
        actorType: AUDIT_ACTOR_TYPES.SYSTEM,
        actorId: null,
        action: AUDIT_ACTIONS.LABOR_REQUEST_IN_PROGRESS,
        entityType: AUDIT_ENTITIES.LABOR_REQUEST,
        entityId: laborRequestId,
        oldValues,
        newValues,
        ipAddress: null,
        userAgent: null,
    };
}

/**
 * Se o RH já aprovou todos os documentos iniciais do contrato (os da empresa declarados, os
 * de colaborador na quantidade declarada e os básicos de cada colaborador cadastrado), a
 * solicitação passa de Pendente de documentação para Serviço em andamento. Roda na transação
 * de quem aprovou: a aprovação e a mudança de status entram juntas.
 *
 * Depois disso o status não volta sozinho (um documento reprovado mais tarde fica com o RH e
 * o fornecedor); só reenviar o convite ou trocar o fornecedor voltam para Pendente.
 *
 * @returns {Promise<{ advanced: boolean, assignmentId?: number }>}
 */
export async function advanceIfInitialDocumentationApproved(transaction, { laborRequestId, supplierId }, context = null) {
    if (!laborRequestId || !supplierId) return { advanced: false };

    const assignment = await contractProgressModel.getActiveAssignment(transaction, laborRequestId, supplierId);
    if (!assignment || assignment.labor_request_status !== LABOR_REQUEST_STATUSES.PENDING_DOCUMENTATION) {
        return { advanced: false };
    }

    const gaps = await contractProgressModel.getInitialDocumentationGaps(transaction, {
        assignmentId: assignment.id,
        laborRequestId,
        supplierId,
    });
    if (gaps.missingCompany > 0 || gaps.missingEmployeeTypes > 0 || gaps.missingBasics > 0) {
        return { advanced: false };
    }

    const moved = await laborRequestModel.setStatusBySystem(
        transaction, laborRequestId, LABOR_REQUEST_STATUSES.IN_PROGRESS, [LABOR_REQUEST_STATUSES.PENDING_DOCUMENTATION],
    );
    if (!moved) return { advanced: false };

    await auditModel.insertAuditLog(transaction, progressAuditEntry(context, laborRequestId));
    return { advanced: true, assignmentId: assignment.id };
}

/**
 * Depois de mudar o status de um documento: se ele foi aprovado e é um documento inicial de
 * um contrato (não mensal), confere se o contrato ficou com tudo aprovado.
 */
export async function onDocumentStatusChanged(transaction, documentId, status, context = null) {
    if (status !== APPROVED) return { advanced: false };
    const slot = await contractProgressModel.getDocumentSlot(transaction, documentId);
    if (!slot || !slot.labor_request_id || slot.reference_month) return { advanced: false };
    return advanceIfInitialDocumentationApproved(
        transaction, { laborRequestId: slot.labor_request_id, supplierId: slot.supplier_id }, context,
    );
}
