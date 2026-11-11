import * as deliveryModel from '../models/notificationDeliveryModel.js';
import { DELIVERY_STATUSES } from '../models/notificationDeliveryModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { collaboratorAuditEntry } from '../utils/audit.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { EVENT_DEFINITIONS } from '../events/catalog.js';
import { isMailEnabled } from './mailService.js';

/** Últimos envios das notificações (Parâmetros → Notificações), para o Admin acompanhar. */

const PAGE_SIZE_MAX = 100;
const VALID_STATUSES = Object.values(DELIVERY_STATUSES);

function parseStatusList(value) {
    if (value === undefined || value === null || value === '') return { value: null };
    const list = String(value).split(',').map((item) => Number(item.trim()));
    if (list.some((item) => !VALID_STATUSES.includes(item))) return { error: 'Filtro de status inválido.' };
    return { value: list };
}

export async function listDeliveries(query = {}) {
    const status = parseStatusList(query.status);
    if (status.error) return { success: false, status: 400, message: status.error };
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(query.pageSize, 10) || 25));

    try {
        const [list, counts] = await Promise.all([
            deliveryModel.listDeliveries({ status: status.value, limit: pageSize, offset: (page - 1) * pageSize }),
            deliveryModel.countByStatus(),
        ]);
        return {
            success: true,
            body: {
                mailEnabled: isMailEnabled(),
                page,
                pageSize,
                total: list.total,
                counts,
                deliveries: list.rows.map((row) => ({
                    id: Number(row.id),
                    eventType: row.event_type,
                    eventLabel: EVENT_DEFINITIONS[row.event_type]?.label ?? row.event_type,
                    recipient: row.recipient,
                    subject: row.subject,
                    status: row.status,
                    attempts: row.attempts,
                    lastError: row.last_error,
                    nextAttemptAt: row.next_attempt_at,
                    createdAt: row.created_at,
                    sentAt: row.sent_at,
                })),
            },
        };
    } catch (error) {
        console.error('listDeliveries error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os envios.' };
    }
}

/** Reenviar um envio que falhou / foi para a fila de erro / não foi enviado (e-mail desligado). */
export async function retryDelivery(id, context = {}) {
    try {
        let ok = false;
        await trasaction.executarEmTransacao(async (transaction) => {
            ok = await deliveryModel.resetForRetry(id, transaction);
            if (!ok) return;
            await auditModel.insertAuditLog(transaction, collaboratorAuditEntry(
                context, AUDIT_ACTIONS.NOTIFICATION_RETRY, AUDIT_ENTITIES.NOTIFICATION, id, null, { retry: true },
            ));
        });
        if (!ok) {
            return { success: false, status: 400, message: 'Só dá para reenviar um envio que falhou, está na fila de erro ou não foi enviado.' };
        }
        return { success: true, body: { message: 'Reenvio pedido. O serviço de notificações tenta de novo em instantes.' } };
    } catch (error) {
        console.error('retryDelivery error:', error);
        return { success: false, status: 500, message: 'Erro ao pedir o reenvio.' };
    }
}
