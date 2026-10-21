import * as employeeSituationModel from '../models/employeeSituationModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.js';
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_IDS } from '../constants/employeeStatus.js';
import { collaboratorAuditEntry } from '../utils/audit.js';
import { toInteger } from '../utils/parse.js';

// 'YYYY-MM-DDTHH:mm' (input datetime-local), opcionalmente com segundos
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * 'YYYY-MM-DDTHH:mm' → Date no horário LOCAL (o pool usa useUTC = false), ou null se for
 * inválida (inclusive datas que o Date "corrige", como 31/02).
 */
function parseLocalDateTime(value) {
    if (typeof value !== 'string') return null;
    const match = LOCAL_DATETIME_PATTERN.exec(value.trim());
    if (!match) return null;

    const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
        || date.getHours() !== hour || date.getMinutes() !== minute) {
        return null;
    }
    return date;
}

/** Data/hora para a auditoria, sem fuso: 'YYYY-MM-DDTHH:mm' (como o RH digitou). */
function toLocalDateTimeText(date) {
    if (!date) return null;
    const value = new Date(date);
    const pad = (number) => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

// ─────────────────────────────────────────────
// Casos de uso
// ─────────────────────────────────────────────

export async function listEmployeeSituations({ search = '', status } = {}) {
    try {
        const result = await employeeSituationModel.listEmployeeSituations({ search, status });
        return { success: true, body: { result } };
    } catch (error) {
        console.error('Erro no listEmployeeSituations service:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os colaboradores.' };
    }
}

/**
 * RH / Segurança muda a situação do colaborador. Integração agendada (2) exige a data e a
 * hora da integração, no futuro. Grava na auditoria (antes / depois) na mesma transação.
 */
export async function setEmployeeSituation(employeeId, payload = {}, context = {}) {
    const status = toInteger(payload.status);
    if (!EMPLOYEE_STATUS_IDS.includes(status)) {
        return { success: false, status: 400, message: 'Situação inválida.' };
    }

    let integrationAt = null;
    if (status === EMPLOYEE_STATUSES.INTEGRATION_SCHEDULED) {
        integrationAt = parseLocalDateTime(payload.integrationAt);
        if (!integrationAt) {
            return { success: false, status: 400, message: 'Informe a data e a hora da integração.' };
        }
        // Agendamento: só data e hora futuras
        if (integrationAt <= new Date()) {
            return { success: false, status: 400, message: 'A integração tem que ser agendada para uma data e hora futuras.' };
        }
    }

    try {
        const before = await employeeSituationModel.getEmployeeSituation(employeeId);
        if (!before) return { success: false, status: 404, message: 'Colaborador não encontrado.' };

        const oldValues = { status: before.status, integration_at: toLocalDateTimeText(before.integration_at) };
        const newValues = {
            status,
            integration_at: integrationAt ? toLocalDateTimeText(integrationAt) : oldValues.integration_at,
        };
        if (oldValues.status === newValues.status && oldValues.integration_at === newValues.integration_at) {
            return { success: true, body: { message: 'Nenhuma alteração para salvar.' } };
        }

        await trasaction.executarEmTransacao(async (transaction) => {
            await employeeSituationModel.updateEmployeeSituation(transaction, employeeId, { status, integrationAt });
            await auditModel.insertAuditLog(transaction, collaboratorAuditEntry(
                context, AUDIT_ACTIONS.EMPLOYEE_STATUS_CHANGE, AUDIT_ENTITIES.EMPLOYEE, employeeId, oldValues, newValues,
            ));
        });

        return { success: true, body: { message: 'Situação do colaborador atualizada.' } };
    } catch (error) {
        console.error('Erro no setEmployeeSituation service:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar a situação do colaborador.' };
    }
}

// ─────────────────────────────────────────────
// Rotina diária (00:01)
// ─────────────────────────────────────────────

/**
 * Vence documentos e atualiza a situação dos colaboradores (ver runDailyDocumentCheck).
 * É idempotente: rodar de novo no mesmo dia não muda nada.
 */
export async function runDailyDocumentCheck(now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const soon = new Date(today);
    soon.setMonth(soon.getMonth() + 1);

    return trasaction.executarEmTransacao((transaction) =>
        employeeSituationModel.runDailyDocumentCheck(transaction, { today, soon }));
}

/** Milissegundos até a próxima 00:01 no horário local do servidor (TZ=America/Sao_Paulo). */
function msUntilNextRun(now = new Date()) {
    const next = new Date(now);
    next.setHours(0, 1, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
}

/**
 * Agenda a rotina para todo dia às 00:01 (sem biblioteca: recalcula o horário a cada execução)
 * e roda uma vez na subida, para não perder o dia se o backend estava fora às 00:01.
 */
export function scheduleDailyDocumentCheck() {
    const run = async (when) => {
        try {
            const { expiredDocuments, employees } = await runDailyDocumentCheck();
            if (expiredDocuments > 0 || employees > 0) {
                console.log(`[Rotina diária] ${when}: ${expiredDocuments} documento(s) vencido(s), ${employees} colaborador(es) com a situação atualizada.`);
            }
        } catch (error) {
            console.error('[Rotina diária] Erro:', error.message);
        }
    };

    const scheduleNext = () => {
        setTimeout(async () => {
            await run('00:01');
            scheduleNext();
        }, msUntilNextRun());
    };

    // Na subida, espera o banco ficar disponível
    setTimeout(() => run('subida do servidor'), 30 * 1000);
    scheduleNext();
}
