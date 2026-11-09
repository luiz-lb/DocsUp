import * as settingsModel from '../models/settingsModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { collaboratorAuditEntry } from '../utils/audit.js';
import { toInteger } from '../utils/parse.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { EVENT_DEFINITIONS, EVENT_TYPE_LIST } from '../events/catalog.js';

/**
 * Parâmetros do sistema (Admin, em Parâmetros): calendário dos documentos mensais e as
 * notificações. Ficam em app_settings; a leitura tem cache curto (a API e o notifier são
 * processos separados: uma mudança vale em até CACHE_MS no outro).
 */

// Dia que existe em todos os meses
export const MAX_MONTH_DAY = 28;

const NUMERIC_SETTINGS = Object.freeze({
    monthlyOpenDay: { key: 'monthly_documents_open_day', min: 1, max: MAX_MONTH_DAY, fallback: 1, label: 'dia em que a competência abre' },
    monthlyReminderDay: { key: 'monthly_documents_reminder_day', min: 1, max: MAX_MONTH_DAY, fallback: 19, label: 'dia do lembrete' },
    monthlyDueDay: { key: 'monthly_documents_due_day', min: 1, max: MAX_MONTH_DAY, fallback: 21, label: 'último dia do prazo' },
    rhDigestIntervalHours: { key: 'rh_digest_interval_hours', min: 1, max: 24, fallback: 1, label: 'intervalo do resumo do RH (horas)' },
    initialDeadlineReminderHours: { key: 'initial_deadline_reminder_hours', min: 1, max: 168, fallback: 24, label: 'lembrete antes do prazo dos iniciais (horas)' },
    scheduledHour: { key: 'scheduled_notifications_hour', min: 0, max: 23, fallback: 8, label: 'horário dos avisos agendados' },
});

const TOGGLE_PREFIX = 'notification_enabled.';
const CACHE_MS = Number(process.env.SETTINGS_CACHE_MS || 15000);

let cache = null;
let cacheAt = 0;

function readNumber(map, name) {
    const def = NUMERIC_SETTINGS[name];
    const value = toInteger(map.get(def.key) ?? '');
    return Number.isInteger(value) && value >= def.min && value <= def.max ? value : def.fallback;
}

/**
 * Calendário dos mensais coerente (abertura < lembrete < último dia). Valores antigos fora de
 * ordem (ex.: prazo 15 com o lembrete padrão 19) viram: lembrete 2 dias antes do prazo.
 */
export function normalizeCalendar({ monthlyOpenDay, monthlyReminderDay, monthlyDueDay }) {
    let open = monthlyOpenDay;
    let reminder = monthlyReminderDay;
    let due = monthlyDueDay;
    if (due < 3) due = 21;
    if (open >= due - 1) open = 1;
    if (!(reminder > open && reminder < due)) reminder = due - 2 > open ? due - 2 : open + 1;
    return { monthlyOpenDay: open, monthlyReminderDay: reminder, monthlyDueDay: due };
}

const CALENDAR_FIELDS = ['monthlyOpenDay', 'monthlyReminderDay', 'monthlyDueDay'];

function buildSnapshot(map) {
    const values = {};
    for (const name of Object.keys(NUMERIC_SETTINGS)) values[name] = readNumber(map, name);
    Object.assign(values, normalizeCalendar(values));
    const enabled = {};
    for (const type of EVENT_TYPE_LIST) enabled[type] = map.get(`${TOGGLE_PREFIX}${type}`) !== '0';
    return { ...values, enabled };
}

/** Parâmetros atuais (com cache curto). */
export async function getSnapshot({ fresh = false } = {}) {
    if (!fresh && cache && Date.now() - cacheAt < CACHE_MS) return cache;
    cache = buildSnapshot(await settingsModel.getAllSettings());
    cacheAt = Date.now();
    return cache;
}

export function clearSettingsCache() {
    cache = null;
}

/** Calendário dos mensais: { openDay, reminderDay, dueDay }. */
export async function getMonthlyCalendar() {
    const snapshot = await getSnapshot();
    return { openDay: snapshot.monthlyOpenDay, reminderDay: snapshot.monthlyReminderDay, dueDay: snapshot.monthlyDueDay };
}

/** O aviso deste tipo está ligado? (padrão: ligado) */
export async function isNotificationEnabled(type) {
    const snapshot = await getSnapshot();
    return snapshot.enabled[type] !== false;
}

/** Para a tela de Parâmetros. */
export async function getSettings() {
    try {
        const snapshot = await getSnapshot({ fresh: true });
        return {
            success: true,
            body: {
                monthly: {
                    openDay: snapshot.monthlyOpenDay,
                    reminderDay: snapshot.monthlyReminderDay,
                    dueDay: snapshot.monthlyDueDay,
                    maxDay: MAX_MONTH_DAY,
                },
                notifications: {
                    rhDigestIntervalHours: snapshot.rhDigestIntervalHours,
                    initialDeadlineReminderHours: snapshot.initialDeadlineReminderHours,
                    scheduledHour: snapshot.scheduledHour,
                    types: EVENT_TYPE_LIST.map((type) => ({
                        type,
                        label: EVENT_DEFINITIONS[type].label,
                        description: EVENT_DEFINITIONS[type].description,
                        audience: EVENT_DEFINITIONS[type].audience,
                        enabled: snapshot.enabled[type],
                    })),
                },
                // Compatibilidade com a tela antiga (só o dia limite)
                monthlyDueDay: snapshot.monthlyDueDay,
                maxDueDay: MAX_MONTH_DAY,
            },
        };
    } catch (error) {
        console.error('getSettings error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os parâmetros.' };
    }
}

/**
 * Salva os parâmetros enviados (só os que vierem). Admin; grava na auditoria o antes e o
 * depois do que mudou.
 *
 * @param {{ monthlyOpenDay?, monthlyReminderDay?, monthlyDueDay?, rhDigestIntervalHours?,
 *           initialDeadlineReminderHours?, scheduledHour?, notificationsEnabled?: Object<string, boolean> }} payload
 */
export async function updateSettings(payload = {}, context = {}) {
    const current = await getSnapshot({ fresh: true });
    const next = { ...current, enabled: { ...current.enabled } };

    for (const [name, def] of Object.entries(NUMERIC_SETTINGS)) {
        if (payload[name] === undefined) continue;
        const value = toInteger(payload[name]);
        if (!Number.isInteger(value) || value < def.min || value > def.max) {
            return { success: false, status: 400, message: `O ${def.label} tem que ser de ${def.min} a ${def.max}.` };
        }
        next[name] = value;
    }

    if (payload.notificationsEnabled !== undefined) {
        if (!payload.notificationsEnabled || typeof payload.notificationsEnabled !== 'object' || Array.isArray(payload.notificationsEnabled)) {
            return { success: false, status: 400, message: 'Lista de avisos inválida.' };
        }
        for (const [type, value] of Object.entries(payload.notificationsEnabled)) {
            if (!EVENT_DEFINITIONS[type] || typeof value !== 'boolean') {
                return { success: false, status: 400, message: 'Lista de avisos inválida.' };
            }
            next.enabled[type] = value;
        }
    }

    const calendarChanged = CALENDAR_FIELDS.some((name) => payload[name] !== undefined);
    if (calendarChanged && !(next.monthlyOpenDay < next.monthlyReminderDay && next.monthlyReminderDay < next.monthlyDueDay)) {
        return {
            success: false,
            status: 400,
            message: 'No calendário dos mensais, o dia de abertura vem antes do lembrete, e o lembrete antes do último dia do prazo.',
        };
    }

    const changes = [];
    for (const [name, def] of Object.entries(NUMERIC_SETTINGS)) {
        if (next[name] !== current[name]) changes.push({ key: def.key, name, before: current[name], after: next[name] });
    }
    for (const type of EVENT_TYPE_LIST) {
        if (next.enabled[type] !== current.enabled[type]) {
            changes.push({ key: `${TOGGLE_PREFIX}${type}`, name: type, before: current.enabled[type], after: next.enabled[type] });
        }
    }
    if (changes.length === 0) return { success: true, body: { message: 'Nenhuma alteração para salvar.' } };

    try {
        await trasaction.executarEmTransacao(async (transaction) => {
            for (const change of changes) {
                const value = typeof change.after === 'boolean' ? (change.after ? '1' : '0') : String(change.after);
                await settingsModel.setSetting(transaction, change.key, value, context.actorId);
            }
            await auditModel.insertAuditLog(transaction, collaboratorAuditEntry(
                context, AUDIT_ACTIONS.SETTINGS_UPDATE, AUDIT_ENTITIES.SETTINGS, null,
                Object.fromEntries(changes.map((change) => [change.key, change.before])),
                Object.fromEntries(changes.map((change) => [change.key, change.after])),
            ));
        });
        clearSettingsCache();
        return { success: true, body: { message: 'Parâmetros salvos.' } };
    } catch (error) {
        console.error('updateSettings error:', error);
        return { success: false, status: 500, message: 'Erro ao salvar os parâmetros.' };
    }
}
