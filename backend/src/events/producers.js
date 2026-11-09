import { enqueueEvent } from './outbox.js';
import { EVENT_TYPES } from './catalog.js';
import { toBrDateTime } from '../utils/dates.js';

/**
 * Eventos de notificação gerados pelas ações do sistema. Cada função monta os dados do
 * e-mail e os destinatários e grava na outbox, na transação da ação (o envio é do notifier).
 */

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
