// Datas digitadas na tela, sem fuso: viram Date no horário LOCAL do servidor (o pool do
// banco usa useUTC = false e o servidor roda em TZ=America/Sao_Paulo). Passar a string
// direto ou usar Date.parse (meia-noite UTC = 21h do dia anterior aqui) gravaria errado.

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** 'YYYY-MM-DD' → Date à meia-noite local, ou null (inclusive datas que o Date "corrige", como 30/02). */
export function parseLocalDate(value) {
    if (typeof value !== 'string') return null;
    const match = ISO_DATE_PATTERN.exec(value.trim());
    if (!match) return null;

    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
    }
    return date;
}

/** 'YYYY-MM-DDTHH:mm' (input datetime-local, segundos opcionais) → Date local, ou null. */
export function parseLocalDateTime(value) {
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

/** 'YYYY-MM' → Date no dia 1 do mês (meia-noite local), ou null. */
export function parseMonth(value) {
    if (typeof value !== 'string') return null;
    const match = MONTH_PATTERN.exec(value.trim());
    if (!match) return null;
    const [year, month] = match.slice(1).map(Number);
    if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
    return new Date(year, month - 1, 1);
}

/** Date (ou texto de data) → 'YYYY-MM' no horário local. */
export function toMonthKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Date → 'YYYY-MM-DDTHH:mm' no horário local (auditoria, sem fuso). */
export function toLocalDateTimeText(value) {
    if (!value) return null;
    const date = new Date(value);
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Hoje à meia-noite, no horário local. */
export function startOfToday(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const pad2 = (number) => String(number).padStart(2, '0');

/** Date → 'DD/MM/AAAA' no horário local (textos de e-mail). */
export function toBrDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Date → 'DD/MM/AAAA às HH:mm' no horário local (textos de e-mail). */
export function toBrDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return `${toBrDate(date)} às ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Date (qualquer dia do mês) → 'outubro/2026'. */
export function toMonthName(value) {
    const date = new Date(value);
    return `${MONTH_NAMES[date.getMonth()]}/${date.getFullYear()}`;
}
