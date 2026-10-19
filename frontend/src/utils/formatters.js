export function formatCurrency(value, currency = 'BRL') {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function formatDate(value, options = { dateStyle: 'short' }) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Data sem hora ('AAAA-MM-DD', ou o início de um ISO) como 'DD/MM/AAAA', sem conversão
 * de fuso: uma validade 2026-12-31 não pode virar 30/12 no horário de Brasília.
 */
export function formatDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

/** Data no horário local no formato do <input type="date"> ('AAAA-MM-DD'). */
export function toDateInputValue(date = new Date()) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Hoje + N dias, no formato do <input type="date">. */
export function addDaysToToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days));
  return toDateInputValue(date);
}

export function formatCnpj(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, '0')).join(':');
}
