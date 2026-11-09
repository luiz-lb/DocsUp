import { registerJob } from '../scheduler.js';
import * as recipientModel from '../../models/notificationRecipientModel.js';
import { enqueueEvent, hasDedupeKey } from '../../events/outbox.js';
import { EVENT_TYPES } from '../../events/catalog.js';
import { contractUrl } from '../../events/producers.js';
import { getSnapshot } from '../../services/settingsService.js';
import { contractsForMonth, dueDateFor } from '../../services/monthlyService.js';
import { toBrDate, toMonthKey, toMonthName } from '../../utils/dates.js';

/**
 * Calendário dos documentos mensais (Parâmetros): os documentos de um mês são enviados no
 * mês seguinte. No horário dos avisos (padrão 8 h):
 *  - dia de abertura (1): "competência aberta", para todos os fornecedores que devem o mês;
 *  - dia do lembrete (19) e último dia (21): para quem ainda tem documento a enviar;
 *  - dia seguinte ao prazo (22): "atrasado", para quem não enviou (o envio continua aceito).
 * Um e-mail por fornecedor e aviso, com todos os contratos dele. Só no dia do aviso: se o
 * notifier ficar fora do ar o dia todo, aquele aviso não sai atrasado.
 */

const MILESTONES = Object.freeze({
    opened: EVENT_TYPES.SUPPLIER_MONTHLY_OPENED,
    reminder: EVENT_TYPES.SUPPLIER_MONTHLY_REMINDER,
    last_day: EVENT_TYPES.SUPPLIER_MONTHLY_LAST_DAY,
    overdue: EVENT_TYPES.SUPPLIER_MONTHLY_OVERDUE,
});

// Itens listados por contrato no e-mail (o resto vira "e mais N")
const ITEMS_PER_CONTRACT = 15;

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Avisos de hoje: [{ kind, month }]. */
export function milestonesFor(now, { openDay, reminderDay, dueDay }) {
    const result = [];
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const day = now.getDate();
    if (day === openDay) result.push({ kind: 'opened', month: previous });
    if (day === reminderDay) result.push({ kind: 'reminder', month: previous });
    if (day === dueDay) result.push({ kind: 'last_day', month: previous });
    // Atrasado: dia seguinte ao prazo (pode cair no mês seguinte, ex.: prazo dia 28 de fevereiro)
    for (const monthsBack of [1, 2]) {
        const month = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
        const due = dueDateFor(month, dueDay);
        const after = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
        if (sameDay(now, after)) result.push({ kind: 'overdue', month });
    }
    return result;
}

function needsAction(summary) {
    return summary.pending + summary.late + summary.returned > 0;
}

const ITEM_ACTION = new Set(['pending', 'late', 'returned']);

function contractData(entry, kind) {
    const { contract, items, summary } = entry;
    const todo = items.filter((item) => ITEM_ACTION.has(item.situation));
    const listed = kind === 'opened' ? items : todo;
    return {
        requestTitle: contract.labor_request_title,
        contractNumber: contract.contract_number ?? null,
        location: contract.labor_request_location ?? null,
        contractUrl: contractUrl(contract.invite_token),
        total: items.length,
        todoCount: todo.length,
        returnedCount: summary.returned,
        items: listed.slice(0, ITEMS_PER_CONTRACT).map((item) => ({
            name: item.documentTypeName,
            employee: item.employeeName ?? null,
            situation: item.situation,
        })),
        moreItems: Math.max(0, listed.length - ITEMS_PER_CONTRACT),
    };
}

async function notifyMilestone({ kind, month }, now, calendar) {
    const { contracts, dueDate } = await contractsForMonth(month, { now, calendar });
    const bySupplier = new Map();
    for (const entry of contracts) {
        if (entry.items.length === 0) continue;
        if (kind !== 'opened' && !needsAction(entry.summary)) continue;
        const key = entry.contract.supplier_id;
        if (!bySupplier.has(key)) bySupplier.set(key, []);
        bySupplier.get(key).push(entry);
    }

    let count = 0;
    for (const [supplierId, entries] of bySupplier) {
        const dedupeKey = `monthly-${kind}:${supplierId}:${toMonthKey(month)}`;
        if (await hasDedupeKey(dedupeKey)) continue;
        const recipients = await recipientModel.assignmentRecipients(null, {
            supplierId, inviteEmail: entries[0].contract.invite_email,
        });
        const id = await enqueueEvent(null, {
            type: MILESTONES[kind],
            recipients,
            key: `supplier:${supplierId}`,
            dedupeKey,
            data: {
                kind,
                competence: toMonthName(month),
                competenceKey: toMonthKey(month),
                dueDateText: toBrDate(dueDate),
                supplierName: entries[0].contract.supplier_name,
                contracts: entries.map((entry) => contractData(entry, kind)),
            },
        });
        if (id) count += 1;
    }
    return count;
}

registerJob({
    name: 'calendário dos mensais',
    async run(now) {
        const settings = await getSnapshot();
        if (now.getHours() < settings.scheduledHour) return 0;
        const calendar = { openDay: settings.monthlyOpenDay, reminderDay: settings.monthlyReminderDay, dueDay: settings.monthlyDueDay };
        let count = 0;
        for (const milestone of milestonesFor(now, calendar)) {
            count += await notifyMilestone(milestone, now, calendar);
        }
        return count;
    },
});
