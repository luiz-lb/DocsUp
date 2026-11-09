import { enqueueEvent } from './outbox.js';
import { EVENT_TYPES } from './catalog.js';
import * as recipientModel from '../models/notificationRecipientModel.js';
import { toBrDate, toBrDateTime, toMonthName } from '../utils/dates.js';

/**
 * Eventos de notificação gerados pelas ações do sistema. Cada função monta os dados do
 * e-mail e os destinatários e grava na outbox, na transação da ação (o envio é do notifier).
 */

export function contractUrl(token) {
    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
    return token ? `${base}/fase2/${token}` : `${base}/fornecedor/painel`;
}

function requestData(request) {
    return {
        requestId: request.id,
        requestTitle: request.title,
        contractNumber: request.contract_number ?? null,
        location: request.location ?? null,
    };
}

/**
 * Fornecedor indicado (ou convite reenviado / fornecedor trocado): convite com o link.
 * kind: 'new' | 'resent' | 'replaced'
 */
export function supplierInvited(transaction, { email, request, inviteUrl, deadlineAt, kind = 'new' }) {
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.SUPPLIER_INVITED,
        recipients: [email],
        key: `labor_request:${request.id}`,
        data: { ...requestData(request), inviteUrl, deadlineText: toBrDateTime(deadlineAt), kind },
    });
}

/** Compras mudou o prazo dos documentos iniciais. */
export async function supplierDeadlineChanged(transaction, { assignment, request, deadlineAt }) {
    const recipients = await recipientModel.assignmentRecipients(transaction, {
        supplierId: assignment.supplier_id, inviteEmail: assignment.invite_email,
    });
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.SUPPLIER_DEADLINE_CHANGED,
        recipients,
        key: `labor_request:${request.id}`,
        data: {
            ...requestData(request),
            contractUrl: contractUrl(assignment.invite_token),
            previousDeadlineText: toBrDateTime(assignment.deadline_at),
            deadlineText: toBrDateTime(deadlineAt),
        },
    });
}

/** Fornecedor trocado: o anterior perde o acesso ao contrato (sem o motivo, que é interno). */
export async function supplierAccessRemoved(transaction, { previous, request }) {
    const recipients = await recipientModel.assignmentRecipients(transaction, {
        supplierId: previous.supplier_id, inviteEmail: previous.invite_email,
    });
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.SUPPLIER_ACCESS_REMOVED,
        recipients,
        key: `labor_request:${request.id}`,
        data: { ...requestData(request), portalUrl: contractUrl(null) },
    });
}

const RETURNED_LABELS = { 3: 'Reprovado', 4: 'Reenvio necessário' };

/** RH reprovou ou pediu o reenvio de um documento (inicial ou mensal). */
export async function supplierDocumentReturned(transaction, { documentId, status, observation }) {
    const notice = await recipientModel.documentNotice(transaction, documentId);
    if (!notice || !notice.labor_request_id) return null;
    const recipients = await recipientModel.assignmentRecipients(transaction, {
        supplierId: notice.supplier_id, inviteEmail: notice.invite_email,
    });
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.SUPPLIER_DOCUMENT_RETURNED,
        recipients,
        key: `labor_request:${notice.labor_request_id}`,
        data: {
            requestId: notice.labor_request_id,
            requestTitle: notice.labor_request_title,
            contractNumber: notice.contract_number ?? null,
            documentTypeName: notice.document_type_name,
            employeeName: notice.employee_name ?? null,
            competence: notice.reference_month ? toMonthName(notice.reference_month) : null,
            statusLabel: RETURNED_LABELS[status] ?? 'Devolvido',
            observation: observation ?? null,
            contractUrl: contractUrl(notice.invite_token),
        },
    });
}

/** RH aprovou todos os documentos iniciais: Serviço em andamento. */
export async function supplierDocumentationApproved(transaction, { assignment }) {
    const recipients = await recipientModel.assignmentRecipients(transaction, {
        supplierId: assignment.supplier_id, inviteEmail: assignment.invite_email,
    });
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.SUPPLIER_DOCUMENTATION_APPROVED,
        recipients,
        key: `labor_request:${assignment.labor_request_id}`,
        data: {
            requestId: assignment.labor_request_id,
            requestTitle: assignment.labor_request_title,
            contractNumber: assignment.contract_number ?? null,
            location: assignment.labor_request_location ?? null,
            contractUrl: contractUrl(assignment.invite_token),
        },
    });
}

/** RH ou Compras concluíram o contrato. */
export async function supplierContractConcluded(transaction, { laborRequestId, concludedAt = new Date() }) {
    const assignment = await recipientModel.openAssignment(transaction, laborRequestId);
    if (!assignment) return null;
    const recipients = await recipientModel.assignmentRecipients(transaction, {
        supplierId: assignment.supplier_id, inviteEmail: assignment.invite_email,
    });
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.SUPPLIER_CONTRACT_CONCLUDED,
        recipients,
        key: `labor_request:${laborRequestId}`,
        data: {
            requestId: laborRequestId,
            requestTitle: assignment.labor_request_title,
            contractNumber: assignment.contract_number ?? null,
            concludedText: toBrDate(concludedAt),
            lastCompetence: toMonthName(concludedAt),
            contractUrl: contractUrl(assignment.invite_token),
        },
    });
}

/** Fornecedor declarou não ter documento da empresa: Compras (e quem indicou) decide. */
export function purchasingContractBlocked(transaction, { assignment, missingDocuments, declaredBy }) {
    return enqueueEvent(transaction, {
        type: EVENT_TYPES.PURCHASING_CONTRACT_BLOCKED,
        recipients: [process.env.SUPRIMENTOS_EMAIL, assignment.created_by_email],
        key: `labor_request:${assignment.labor_request_id}`,
        data: {
            requestId: assignment.labor_request_id,
            requestTitle: assignment.labor_request_title,
            contractNumber: assignment.contract_number ?? null,
            supplierName: assignment.supplier_name ?? assignment.invite_email,
            inviteEmail: assignment.invite_email,
            declaredBy: declaredBy ?? null,
            missingDocuments: missingDocuments.map((item) => item.name),
        },
    });
}
