import * as monthlyModel from '../models/monthlyModel.js';
import * as settingsService from './settingsService.js';
import * as documentTypeModel from '../models/documentTypeModel.js';
import * as deliveryModel from '../models/deliveryModel.js';
import * as trasaction from '../models/trasaction.js';
import { loadActiveAssignment, persistFile, removeSavedFiles, resolveExpiration } from './phase2Service.js';
import { parseMonth, toMonthKey } from '../utils/dates.js';
import { toInteger, isBlank } from '../utils/parse.js';
import { DOCUMENT_CATEGORIES } from '../constants/documentCategories.js';

// Dia limite (do mês seguinte) para enviar os documentos de uma competência: em Parâmetros
// (calendário dos mensais, settingsService)

const APPROVED = 2;
const RETURNED_STATUSES = [3, 4]; // Reprovado, Reenvio necessário

// Situação de um documento mensal esperado
export const MONTHLY_SITUATIONS = Object.freeze({
    PENDING: 'pending',     // não enviado, ainda dentro do prazo
    LATE: 'late',           // não enviado, prazo vencido
    SENT: 'sent',           // enviado, aguardando o RH
    APPROVED: 'approved',   // aprovado pelo RH
    RETURNED: 'returned',   // reprovado / reenvio necessário
});

// ─────────────────────────────────────────────
// Regras de competência
// ─────────────────────────────────────────────

function monthStart(value) {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Último instante do mês (23:59:59.999), no horário local. */
function monthEnd(month) {
    return new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Dia limite do mês seguinte à competência, até o fim do dia. */
export function dueDateFor(month, dueDay) {
    return new Date(month.getFullYear(), month.getMonth() + 1, dueDay, 23, 59, 59);
}

/**
 * Vencimento para a tela: 'YYYY-MM-DD' no horário local. Como Date, o fim do dia 10 (23:59
 * aqui) sairia no JSON como dia 11 em UTC e a tela mostraria o dia seguinte.
 */
export function dueDateText(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Competência mais nova já aberta: os documentos de um mês são enviados no mês seguinte, a
 * partir do dia de abertura (Parâmetros). Ex.: abertura dia 1 → em 9/11 a mais nova é outubro.
 */
export function latestOpenMonth(now = new Date(), openDay = 1) {
    const monthsBack = now.getDate() >= openDay ? 1 : 2;
    return new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
}

/** Dia em que a competência abre (no mês seguinte a ela). */
export function openDateFor(month, openDay = 1) {
    return new Date(month.getFullYear(), month.getMonth() + 1, openDay);
}

/**
 * Competências cobradas de um contrato, da mais antiga para a mais nova: do mês de início
 * da solicitação (mas não antes do mês em que este fornecedor foi indicado) até o mês da
 * conclusão do contrato, só as que já abriram (dia de abertura do mês seguinte).
 */
export function competenceMonths({ startDate, assignmentCreatedAt, concludedAt, now = new Date(), openDay = 1 }) {
    const indicated = monthStart(assignmentCreatedAt ?? now);
    const started = startDate ? monthStart(startDate) : indicated;
    const first = started > indicated ? started : indicated;
    const opened = latestOpenMonth(now, openDay);
    const concluded = concludedAt ? monthStart(concludedAt) : null;
    const last = concluded && concluded < opened ? concluded : opened;

    const months = [];
    for (let month = first; month <= last; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
        months.push(month);
    }
    return months;
}

/** O que esperar num mês: os tipos da empresa (1 cada) e os de colaborador (1 por colaborador). */
function expectedItems({ types, employees, month }) {
    const items = [];
    const lastMoment = monthEnd(month);
    for (const type of types) {
        if (type.scope === 0) {
            items.push({ documentTypeId: type.id, documentTypeName: type.name, hasExpiration: Boolean(type.has_expiration), employeeId: null, employeeName: null });
            continue;
        }
        // Colaborador cadastrado depois do mês não deve aquele mês
        for (const employee of employees) {
            if (new Date(employee.created_at) > lastMoment) continue;
            items.push({
                documentTypeId: type.id,
                documentTypeName: type.name,
                hasExpiration: Boolean(type.has_expiration),
                employeeId: employee.id,
                employeeName: employee.full_name,
            });
        }
    }
    return items;
}

function itemKey(documentTypeId, employeeId, month) {
    return `${documentTypeId}:${employeeId ?? 'empresa'}:${toMonthKey(month)}`;
}

/** Situação do item conforme o documento atual (ou a falta dele) e o prazo. */
function situationOf(document, dueDate, now) {
    if (!document) return now > dueDate ? MONTHLY_SITUATIONS.LATE : MONTHLY_SITUATIONS.PENDING;
    if (document.status === APPROVED) return MONTHLY_SITUATIONS.APPROVED;
    if (RETURNED_STATUSES.includes(document.status)) return MONTHLY_SITUATIONS.RETURNED;
    return MONTHLY_SITUATIONS.SENT;
}

/** Itens do mês com o documento atual e a situação de cada um. */
function itemsWithStatus({ types, employees, month, documentsByKey, dueDate, now }) {
    return expectedItems({ types, employees, month }).map((item) => {
        const document = documentsByKey.get(itemKey(item.documentTypeId, item.employeeId, month)) ?? null;
        return {
            ...item,
            situation: situationOf(document, dueDate, now),
            document: document && {
                id: document.id,
                status: document.status,
                fileName: document.file_name,
                uploadedAt: document.uploaded_at,
                version: document.version,
                observation: document.observation ?? null,
            },
        };
    });
}

function summarize(items) {
    const count = (situation) => items.filter((item) => item.situation === situation).length;
    return {
        total: items.length,
        pending: count(MONTHLY_SITUATIONS.PENDING),
        late: count(MONTHLY_SITUATIONS.LATE),
        sent: count(MONTHLY_SITUATIONS.SENT),
        approved: count(MONTHLY_SITUATIONS.APPROVED),
        returned: count(MONTHLY_SITUATIONS.RETURNED),
    };
}

function indexDocuments(documents) {
    const byKey = new Map();
    for (const document of documents) {
        byKey.set(itemKey(document.document_type_id, document.employee_id, document.reference_month), document);
    }
    return byKey;
}

// ─────────────────────────────────────────────
// Parâmetro: dia limite
// ─────────────────────────────────────────────

/** Último dia do prazo dos mensais (do mês seguinte à competência). */
export async function getDueDay() {
    return (await settingsService.getMonthlyCalendar()).dueDay;
}

/** Calendário dos mensais: { openDay, reminderDay, dueDay }. */
export function getCalendar() {
    return settingsService.getMonthlyCalendar();
}

/** Primeira competência que o contrato deve (início da solicitação, não antes da indicação). */
function firstCompetence(startDate, assignmentCreatedAt, now = new Date()) {
    const indicated = monthStart(assignmentCreatedAt ?? now);
    const started = startDate ? monthStart(startDate) : indicated;
    return started > indicated ? started : indicated;
}

// ─────────────────────────────────────────────
// Portal do fornecedor
// ─────────────────────────────────────────────

/**
 * Documentos mensais do contrato (fornecedor logado): as competências cobradas, com o resumo
 * de cada uma, e os itens do mês escolhido (o mês mais antigo com pendência, se não vier).
 */
export async function getSupplierMonthly(token, supplierId, monthParam) {
    try {
        const loaded = await loadActiveAssignment(token, supplierId);
        if (loaded.error) return { success: false, ...loaded.error };
        const { assignment } = loaded;

        const now = new Date();
        const { openDay, dueDay } = await getCalendar();
        const types = await monthlyModel.getActiveMonthlyTypes();
        const months = competenceMonths({
            startDate: assignment.labor_request_start_date,
            assignmentCreatedAt: assignment.created_at,
            concludedAt: assignment.labor_request_concluded_at,
            now,
            openDay,
        });
        // Próxima competência a abrir (a tela diz quando começa o envio)
        const lastListed = months[months.length - 1];
        const nextMonth = lastListed
            ? new Date(lastListed.getFullYear(), lastListed.getMonth() + 1, 1)
            : firstCompetence(assignment.labor_request_start_date, assignment.created_at, now);
        const concludedMonth = assignment.labor_request_concluded_at ? monthStart(assignment.labor_request_concluded_at) : null;
        const hasNext = !concludedMonth || nextMonth <= concludedMonth;
        const base = {
            dueDay,
            openDay,
            concluded: Boolean(assignment.labor_request_concluded_at),
            hasTypes: types.length > 0,
            nextMonth: hasNext ? toMonthKey(nextMonth) : null,
            nextOpenDate: hasNext ? dueDateText(openDateFor(nextMonth, openDay)) : null,
        };
        if (types.length === 0 || months.length === 0) {
            return { success: true, body: { ...base, months: [], selectedMonth: null, items: [] } };
        }

        const pair = { supplierId: assignment.supplier_id, laborRequestId: assignment.labor_request_id };
        const [employees, documents] = await Promise.all([
            monthlyModel.listEmployeesForMonthly([pair]),
            monthlyModel.listCurrentMonthlyDocuments([pair]),
        ]);
        const documentsByKey = indexDocuments(documents);

        const perMonth = months.map((month) => {
            const dueDate = dueDateFor(month, dueDay);
            const items = itemsWithStatus({ types, employees, month, documentsByKey, dueDate, now });
            return { month, dueDate, items, summary: summarize(items) };
        });

        // Mês aberto na tela: o pedido, ou o mais antigo com algo a fazer, ou o mais novo
        const needsAction = (entry) => entry.summary.late + entry.summary.pending + entry.summary.returned > 0;
        const requested = parseMonth(monthParam ?? '');
        const selected = (requested && perMonth.find((entry) => entry.month.getTime() === requested.getTime()))
            ?? perMonth.find(needsAction)
            ?? perMonth[perMonth.length - 1];

        return {
            success: true,
            body: {
                ...base,
                months: [...perMonth].reverse().map((entry) => ({
                    month: toMonthKey(entry.month),
                    dueDate: dueDateText(entry.dueDate),
                    ...entry.summary,
                })),
                selectedMonth: toMonthKey(selected.month),
                selectedDueDate: dueDateText(selected.dueDate),
                items: selected.items,
            },
        };
    } catch (error) {
        console.error('getSupplierMonthly error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os documentos mensais.' };
    }
}

/**
 * O fornecedor envia um documento mensal: tipo mensal ativo, competência cobrada no contrato,
 * colaborador do contrato (nos tipos por colaborador) e um arquivo. Reenviar troca a entrega
 * do mês (histórico); documento já aprovado pelo RH não é substituído. O prazo dos documentos
 * iniciais não vale para os mensais.
 *
 * @param {{ documentTypeId, referenceMonth: 'YYYY-MM', employeeId?, expiresAt? }} data
 */
export async function uploadMonthlyDocument(token, supplierId, data = {}, files = []) {
    if (!files || files.length !== 1) {
        return { success: false, message: 'Envie exatamente um arquivo.' };
    }

    const loaded = await loadActiveAssignment(token, supplierId);
    if (loaded.error) return { success: false, ...loaded.error };
    const { assignment } = loaded;

    const typeId = toInteger(data.documentTypeId);
    const documentType = Number.isInteger(typeId) && typeId > 0 ? await documentTypeModel.getDocumentTypeById(typeId) : null;
    if (!documentType || !documentType.is_active || documentType.category !== DOCUMENT_CATEGORIES.MONTHLY) {
        return { success: false, message: 'Documento mensal inválido.' };
    }

    const month = parseMonth(data.referenceMonth ?? '');
    const { openDay } = await getCalendar();
    const months = competenceMonths({
        startDate: assignment.labor_request_start_date,
        assignmentCreatedAt: assignment.created_at,
        concludedAt: assignment.labor_request_concluded_at,
        openDay,
    });
    if (!month || !months.some((item) => item.getTime() === month.getTime())) {
        return { success: false, message: 'Mês de referência fora do período do contrato (ou ainda não aberto para envio).' };
    }

    let employeeId = null;
    if (documentType.scope === 1) {
        employeeId = toInteger(data.employeeId);
        const employee = Number.isInteger(employeeId)
            ? await monthlyModel.getContractEmployee(employeeId, assignment.supplier_id, assignment.labor_request_id)
            : null;
        if (!employee) return { success: false, message: 'Escolha um colaborador deste contrato.' };
    } else if (!isBlank(data.employeeId)) {
        return { success: false, message: 'Este documento é da empresa, não de um colaborador.' };
    }

    const expiration = resolveExpiration(documentType, data.expiresAt);
    if (expiration.error) return { success: false, message: expiration.error };

    const currentStatus = await deliveryModel.getCurrentDeliveryStatus({
        supplierId: assignment.supplier_id,
        laborRequestId: assignment.labor_request_id,
        documentTypeId: documentType.id,
        employeeId,
        referenceMonth: month,
    });
    if (currentStatus === APPROVED) {
        return { success: false, message: 'Este documento do mês já foi aprovado pelo RH.' };
    }

    const savedPaths = [];
    try {
        const documentId = await trasaction.executarEmTransacao((transaction) => persistFile(
            transaction,
            'monthly',
            files[0],
            {
                supplierId: assignment.supplier_id,
                supplierName: assignment.supplier_name,
                documentTypeId: documentType.id,
                laborRequestId: assignment.labor_request_id,
                employeeId,
                expiresAt: expiration.value,
                referenceMonth: month,
            },
            savedPaths,
        ));
        return { success: true, body: { documentId, referenceMonth: toMonthKey(month) } };
    } catch (error) {
        removeSavedFiles(savedPaths);
        console.error('uploadMonthlyDocument error:', error);
        return { success: false, message: 'Erro ao enviar o documento mensal.' };
    }
}

// ─────────────────────────────────────────────
// Acompanhamento do RH
// ─────────────────────────────────────────────

/**
 * Situação dos documentos mensais de um mês em todos os contratos com fornecedor ativo:
 * o que já foi enviado (e a análise) e o que falta (no prazo ou atrasado). Sem mês, mostra
 * o mês anterior (a competência que vence neste mês).
 */
/**
 * Contratos ativos que devem a competência `month`, cada um com os itens do mês e a situação
 * de cada item (usado no acompanhamento do RH e nos avisos do calendário dos mensais).
 */
export async function contractsForMonth(month, { now = new Date(), calendar = null } = {}) {
    const { openDay, dueDay } = calendar ?? await getCalendar();
    const dueDate = dueDateFor(month, dueDay);
    const types = await monthlyModel.getActiveMonthlyTypes();
    const contracts = (await monthlyModel.listActiveContracts()).filter((contract) =>
        competenceMonths({
            startDate: contract.start_date,
            assignmentCreatedAt: contract.assignment_created_at,
            concludedAt: contract.concluded_at,
            now,
            openDay,
        }).some((item) => item.getTime() === month.getTime()));

    if (types.length === 0 || contracts.length === 0) return { types, dueDay, dueDate, contracts: [] };

    const pairs = contracts.map((contract) => ({ supplierId: contract.supplier_id, laborRequestId: contract.labor_request_id }));
    const [employees, documents] = await Promise.all([
        monthlyModel.listEmployeesForMonthly(pairs),
        monthlyModel.listCurrentMonthlyDocuments(pairs, month),
    ]);

    return {
        types,
        dueDay,
        dueDate,
        contracts: contracts.map((contract) => {
            const contractEmployees = employees.filter((employee) =>
                employee.supplier_id === contract.supplier_id && employee.labor_request_id === contract.labor_request_id);
            const contractDocuments = documents.filter((document) =>
                document.supplier_id === contract.supplier_id && document.labor_request_id === contract.labor_request_id);
            const items = itemsWithStatus({
                types,
                employees: contractEmployees,
                month,
                documentsByKey: indexDocuments(contractDocuments),
                dueDate,
                now,
            });
            return { contract, items, summary: summarize(items) };
        }),
    };
}

export async function getMonthlyOverview(monthParam) {
    try {
        const now = new Date();
        const calendar = await getCalendar();
        const month = parseMonth(monthParam ?? '') ?? latestOpenMonth(now, calendar.openDay);
        const { types, dueDay, dueDate, contracts } = await contractsForMonth(month, { now, calendar });

        const body = { month: toMonthKey(month), dueDay, dueDate: dueDateText(dueDate), hasTypes: types.length > 0 };
        const rows = contracts.flatMap(({ contract, items }) => items.map((item) => ({
            ...item,
            laborRequestId: contract.labor_request_id,
            laborRequestTitle: contract.labor_request_title,
            contractNumber: contract.contract_number,
            location: contract.labor_request_location,
            supplierId: contract.supplier_id,
            supplierName: contract.supplier_name,
        })));

        return { success: true, body: { ...body, rows, summary: summarize(rows) } };
    } catch (error) {
        console.error('getMonthlyOverview error:', error);
        return { success: false, status: 500, message: 'Erro ao buscar os documentos mensais.' };
    }
}
