import { registerJob } from '../scheduler.js';
import * as digestModel from '../../models/digestModel.js';
import * as settingsModel from '../../models/settingsModel.js';
import * as trasaction from '../../models/trasaction.js';
import { enqueueEvent } from '../../events/outbox.js';
import { EVENT_TYPES } from '../../events/catalog.js';
import { getSnapshot } from '../../services/settingsService.js';
import { toBrDate, toBrDateTime, toLocalDateTimeText, toMonthName } from '../../utils/dates.js';

/**
 * Resumo do RH: a cada X horas (Parâmetros), um e-mail para todos os usuários ativos do RH
 * com o que chegou no período: documentos enviados e reenviados (por fornecedor e contrato),
 * declarações assinadas (e os bloqueios por "não tenho") e prazos dos iniciais que venceram.
 * Sem novidade no período, nenhum e-mail sai.
 *
 * O período vai do fim do último resumo (rh_digest_cursor, em hora cheia) até a hora cheia
 * atual. Na primeira vez o cursor só é marcado: o histórico antigo não vira resumo.
 */

export const CURSOR_KEY = 'rh_digest_cursor';
const MAX_DOCUMENTS = 300;

const DOCUMENT_STATUS_LABELS = {
    0: 'Pendente', 1: 'Validando', 2: 'Aprovado', 3: 'Reprovado', 4: 'Reenvio necessário', 5: 'Vencido',
};

function floorToHour(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
}

function parseCursor(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text ?? '');
    if (!match) return null;
    const [, y, m, d, h, mi] = match.map(Number);
    return new Date(y, m - 1, d, h, mi);
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function periodText(from, to) {
    const end = toBrDateTime(to);
    return sameDay(from, to)
        ? `${toBrDate(from)}, das ${toBrDateTime(from).slice(-5)} às ${end.slice(-5)}`
        : `${toBrDateTime(from)} até ${end}`;
}

/** Monta os dados do resumo (ou null se não houve nada no período). */
export async function buildDigest(from, to) {
    const [documents, declarations, expired] = await Promise.all([
        digestModel.documentsReceived(from, to),
        digestModel.declarationsSigned(from, to),
        digestModel.deadlinesExpired(from, to),
    ]);
    if (documents.length === 0 && declarations.length === 0 && expired.length === 0) return null;

    const listed = documents.slice(0, MAX_DOCUMENTS);
    const suppliers = new Map();
    for (const doc of listed) {
        if (!suppliers.has(doc.supplier_id)) suppliers.set(doc.supplier_id, { name: doc.supplier_name, contracts: new Map() });
        const supplier = suppliers.get(doc.supplier_id);
        const contractKey = doc.labor_request_id ?? 0;
        if (!supplier.contracts.has(contractKey)) {
            supplier.contracts.set(contractKey, {
                requestId: doc.labor_request_id,
                title: doc.labor_request_title ?? 'Sem solicitação',
                contractNumber: doc.contract_number ?? null,
                documents: [],
            });
        }
        supplier.contracts.get(contractKey).documents.push({
            name: doc.document_type_name,
            employee: doc.employee_name ?? null,
            competence: doc.reference_month ? toMonthName(doc.reference_month) : null,
            resent: (doc.version ?? 1) > 1,
            statusLabel: DOCUMENT_STATUS_LABELS[doc.status] ?? 'Pendente',
            status: doc.status,
        });
    }

    return {
        periodText: periodText(from, to),
        from: toLocalDateTimeText(from),
        to: toLocalDateTimeText(to),
        totals: {
            documents: documents.length,
            resent: documents.filter((doc) => (doc.version ?? 1) > 1).length,
            suppliers: new Set(documents.map((doc) => doc.supplier_id)).size,
            declarations: declarations.length,
            blocked: declarations.filter((item) => item.status === 2).length,
            expired: expired.length,
        },
        moreDocuments: documents.length - listed.length,
        suppliers: [...suppliers.values()].map((supplier) => ({ name: supplier.name, contracts: [...supplier.contracts.values()] })),
        declarations: declarations.map((item) => ({
            supplierName: item.supplier_name ?? '—',
            title: item.labor_request_title,
            contractNumber: item.contract_number ?? null,
            blocked: item.status === 2,
            at: toBrDateTime(item.declared_at),
        })),
        expired: expired.map((item) => ({
            supplierName: item.supplier_name ?? item.invite_email,
            title: item.labor_request_title,
            contractNumber: item.contract_number ?? null,
            deadlineText: toBrDateTime(item.deadline_at),
        })),
        intervalHours: null,
    };
}

registerJob({
    name: 'resumo do RH',
    async run(now) {
        const settings = await getSnapshot();
        const end = floorToHour(now);
        const all = await settingsModel.getAllSettings();
        const start = parseCursor(all.get(CURSOR_KEY));

        if (!start) {
            await trasaction.executarEmTransacao((transaction) => settingsModel.setSetting(transaction, CURSOR_KEY, toLocalDateTimeText(end), null));
            return 0;
        }
        if (end - start < settings.rhDigestIntervalHours * 3600000) return 0;

        const digest = await buildDigest(start, end);
        const recipients = digest ? await digestModel.rhEmails() : [];
        let enqueued = null;
        await trasaction.executarEmTransacao(async (transaction) => {
            // Primeiro o evento, depois o cursor: o enqueueEvent lê os parâmetros (app_settings)
            // por outra conexão; com o cursor já gravado nesta transação, essa leitura esperaria
            // o bloqueio da própria transação.
            if (digest && recipients.length > 0) {
                enqueued = await enqueueEvent(transaction, {
                    type: EVENT_TYPES.RH_DIGEST,
                    recipients,
                    key: 'rh-digest',
                    dedupeKey: `rh-digest:${toLocalDateTimeText(end)}`,
                    data: { ...digest, intervalHours: settings.rhDigestIntervalHours },
                });
            }
            await settingsModel.setSetting(transaction, CURSOR_KEY, toLocalDateTimeText(end), null);
        });
        return enqueued ? 1 : 0;
    },
});
