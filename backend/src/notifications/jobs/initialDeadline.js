import { registerJob } from '../scheduler.js';
import * as recipientModel from '../../models/notificationRecipientModel.js';
import * as contractProgressModel from '../../models/contractProgressModel.js';
import { enqueueEvent, hasDedupeKey } from '../../events/outbox.js';
import { EVENT_TYPES } from '../../events/catalog.js';
import { contractUrl } from '../../events/producers.js';
import { getSnapshot } from '../../services/settingsService.js';
import { toBrDateTime, toLocalDateTimeText } from '../../utils/dates.js';

/**
 * Prazo dos documentos iniciais (definido por Compras ao indicar o fornecedor):
 *  - lembrete X horas antes (Parâmetros), se o fornecedor ainda não enviou tudo;
 *  - aviso de prazo vencido ao fornecedor e a Compras, se não enviou tudo (só prazos vencidos
 *    nas últimas 24 h: prazo antigo não vira aviso de repente).
 * A dedupe_key leva o prazo: se Compras mudar o prazo, o lembrete do prazo novo também sai.
 */

const EXPIRED_WINDOW_HOURS = 24;

/** O que falta enviar (declaração ainda não assinada conta como tudo). */
async function missingFor(row) {
    if (row.status === 0 || !row.supplier_id) {
        return { declared: false, company: [], employee: [], basics: [] };
    }
    const missing = await contractProgressModel.getInitialDocumentationMissing(null, {
        assignmentId: row.id, laborRequestId: row.labor_request_id, supplierId: row.supplier_id,
    });
    return { declared: true, ...missing };
}

function hasMissing(missing) {
    return !missing.declared || missing.company.length > 0 || missing.employee.length > 0 || missing.basics.length > 0;
}

function baseData(row, missing) {
    return {
        requestId: row.labor_request_id,
        requestTitle: row.labor_request_title,
        contractNumber: row.contract_number ?? null,
        location: row.labor_request_location ?? null,
        deadlineText: toBrDateTime(row.deadline_at),
        contractUrl: contractUrl(row.invite_token),
        missing,
    };
}

async function remind(row, now) {
    const dedupeKey = `initial-reminder:${row.id}:${toLocalDateTimeText(row.deadline_at)}`;
    if (await hasDedupeKey(dedupeKey)) return 0;
    const missing = await missingFor(row);
    if (!hasMissing(missing)) return 0;
    const recipients = await recipientModel.assignmentRecipients(null, { supplierId: row.supplier_id, inviteEmail: row.invite_email });
    const hoursLeft = Math.max(1, Math.round((new Date(row.deadline_at) - now) / 3600000));
    const id = await enqueueEvent(null, {
        type: EVENT_TYPES.SUPPLIER_INITIAL_DEADLINE_REMINDER,
        recipients,
        key: `labor_request:${row.labor_request_id}`,
        dedupeKey,
        data: { ...baseData(row, missing), hoursLeft },
    });
    return id ? 1 : 0;
}

async function expired(row) {
    const deadlineKey = toLocalDateTimeText(row.deadline_at);
    const supplierKey = `initial-expired:${row.id}:${deadlineKey}`;
    const purchasingKey = `initial-expired-purchasing:${row.id}:${deadlineKey}`;
    const [supplierDone, purchasingDone] = await Promise.all([hasDedupeKey(supplierKey), hasDedupeKey(purchasingKey)]);
    if (supplierDone && purchasingDone) return 0;
    const missing = await missingFor(row);
    if (!hasMissing(missing)) return 0;

    let count = 0;
    const data = baseData(row, missing);
    if (!supplierDone) {
        const recipients = await recipientModel.assignmentRecipients(null, { supplierId: row.supplier_id, inviteEmail: row.invite_email });
        if (await enqueueEvent(null, {
            type: EVENT_TYPES.SUPPLIER_INITIAL_DEADLINE_EXPIRED, recipients, key: `labor_request:${row.labor_request_id}`, dedupeKey: supplierKey, data,
        })) count += 1;
    }
    if (!purchasingDone) {
        if (await enqueueEvent(null, {
            type: EVENT_TYPES.PURCHASING_INITIAL_DEADLINE_EXPIRED,
            recipients: [process.env.SUPRIMENTOS_EMAIL, row.created_by_email],
            key: `labor_request:${row.labor_request_id}`,
            dedupeKey: purchasingKey,
            data: { ...data, supplierName: row.supplier_name ?? row.invite_email, inviteEmail: row.invite_email },
        })) count += 1;
    }
    return count;
}

registerJob({
    name: 'prazo dos documentos iniciais',
    async run(now) {
        const settings = await getSnapshot();
        let count = 0;
        for (const row of await recipientModel.assignmentsNearDeadline(settings.initialDeadlineReminderHours)) {
            count += await remind(row, now);
        }
        for (const row of await recipientModel.assignmentsRecentlyExpired(EXPIRED_WINDOW_HOURS)) {
            count += await expired(row);
        }
        return count;
    },
});
