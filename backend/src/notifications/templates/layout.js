import { escapeHtml } from '../../services/mailService.js';

/**
 * Modelo único dos e-mails do DocsUp: tabelas com estilo embutido (funciona no Outlook, no
 * Gmail e no celular), cores da marca, cabeçalho, título, blocos de conteúdo, botão e rodapé.
 * Todo texto que vem de pessoas passa por esc().
 */

export const esc = escapeHtml;

const C = Object.freeze({
    teal: '#004643',
    tealDark: '#082720',
    cream: '#faf0ca',
    creamText: '#fffae4',
    page: '#eef1ee',
    text: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    soft: '#f6f7f6',
});

export const TONES = Object.freeze({
    success: { fg: '#1e7a34', bg: '#e8f7ec', border: '#b7e4c2' },
    warning: { fg: '#8a5300', bg: '#fef3dd', border: '#f6d38f' },
    danger: { fg: '#b42318', bg: '#fbe9e9', border: '#f3b8b8' },
    info: { fg: '#1d4ed8', bg: '#e8f1fe', border: '#bcd3fb' },
    neutral: { fg: '#374151', bg: '#eef0f2', border: '#d1d5db' },
    brand: { fg: C.teal, bg: '#e6efee', border: '#b9d3d0' },
});

const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function tone(name) {
    return TONES[name] ?? TONES.brand;
}

/** Endereço do sistema (links dos botões). */
export function appUrl(path = '/') {
    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Selo pequeno colorido. */
export function badge(text, toneName = 'brand') {
    const t = tone(toneName);
    return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${t.bg};color:${t.fg};border:1px solid ${t.border};${FONT}font-size:12px;font-weight:700;line-height:18px;white-space:nowrap;">${esc(text)}</span>`;
}

/** Título de seção dentro do corpo. */
export function sectionTitle(text) {
    return `<p style="margin:24px 0 8px;${FONT}font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};">${esc(text)}</p>`;
}

/** Parágrafo comum (html já pronto: use esc() no que vier de pessoas). */
export function paragraph(html) {
    return `<p style="margin:0 0 12px;${FONT}font-size:15px;line-height:23px;color:${C.text};">${html}</p>`;
}

/** Quadro de dados: [{ label, value (texto), html? (pronto) }]. */
export function infoRows(rows) {
    const items = rows.filter((row) => row && (row.html || (row.value !== null && row.value !== undefined && row.value !== '')));
    if (items.length === 0) return '';
    const body = items.map((row, index) => `
        <tr>
          <td style="padding:10px 14px;${index > 0 ? `border-top:1px solid ${C.border};` : ''}${FONT}font-size:13px;color:${C.muted};width:38%;vertical-align:top;">${esc(row.label)}</td>
          <td style="padding:10px 14px;${index > 0 ? `border-top:1px solid ${C.border};` : ''}${FONT}font-size:14px;color:${C.text};font-weight:600;vertical-align:top;">${row.html ?? esc(row.value)}</td>
        </tr>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${C.border};border-radius:10px;background:${C.soft};margin:8px 0 16px;">${body}</table>`;
}

/** Caixa de destaque (aviso, prazo, motivo). */
export function callout(html, toneName = 'info', title = null) {
    const t = tone(toneName);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
      <tr><td style="background:${t.bg};border:1px solid ${t.border};border-left:4px solid ${t.fg};border-radius:8px;padding:12px 16px;${FONT}font-size:14px;line-height:21px;color:${t.fg};">
        ${title ? `<strong style="display:block;margin-bottom:4px;">${esc(title)}</strong>` : ''}${html}
      </td></tr></table>`;
}

/** Lista simples de itens (texto). */
export function bulletList(items, toneName = null) {
    if (!items || items.length === 0) return '';
    const color = toneName ? tone(toneName).fg : C.text;
    return `<ul style="margin:4px 0 16px;padding-left:20px;${FONT}font-size:14px;line-height:22px;color:${color};">${items.map((item) => `<li style="margin:2px 0;">${esc(item)}</li>`).join('')}</ul>`;
}

/** Linha de números em destaque: [{ label, value, tone }]. Até 4 por linha. */
export function statCards(stats) {
    if (!stats || stats.length === 0) return '';
    const width = Math.floor(100 / stats.length);
    const cells = stats.map((stat) => {
        const t = tone(stat.tone ?? 'brand');
        return `<td width="${width}%" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${t.bg};border:1px solid ${t.border};border-radius:10px;padding:14px 10px;text-align:center;">
              <div style="${FONT}font-size:26px;line-height:30px;font-weight:800;color:${t.fg};">${esc(stat.value)}</div>
              <div style="${FONT}font-size:12px;line-height:16px;color:${C.muted};margin-top:2px;">${esc(stat.label)}</div>
            </td></tr></table>
        </td>`;
    }).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;"><tr>${cells}</tr></table>`;
}

/** Tabela de dados: columns [{ label, width? }], rows [[célula html]] (use esc() nas células). */
export function dataTable(columns, rows) {
    if (!rows || rows.length === 0) return '';
    const head = columns.map((column) => `<th align="left" style="padding:8px 10px;background:${C.teal};color:${C.creamText};${FONT}font-size:12px;font-weight:700;${column.width ? `width:${column.width};` : ''}">${esc(column.label)}</th>`).join('');
    const body = rows.map((cells, index) => `<tr>${cells.map((cell) => `<td style="padding:8px 10px;border-top:1px solid ${C.border};background:${index % 2 ? C.soft : '#ffffff'};${FONT}font-size:13px;line-height:19px;color:${C.text};vertical-align:top;">${cell}</td>`).join('')}</tr>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin:6px 0 16px;"><tr>${head}</tr>${body}</table>`;
}

/** Botão (link) no estilo da marca. */
export function button(label, url) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr>
      <td bgcolor="${C.teal}" style="border-radius:8px;background:${C.teal};">
        <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:13px 26px;${FONT}font-size:15px;font-weight:700;color:${C.creamText};text-decoration:none;border-radius:8px;">${esc(label)}</a>
      </td></tr></table>
      <p style="margin:6px 0 0;${FONT}font-size:12px;line-height:18px;color:${C.muted};">Se o botão não abrir, copie o endereço: <a href="${esc(url)}" style="color:${C.teal};word-break:break-all;">${esc(url)}</a></p>`;
}

/**
 * E-mail completo.
 *
 * @param {{ preheader?: string, eyebrow?: string, eyebrowTone?: string, title: string,
 *           intro?: string (html), body?: string (html), cta?: { label, url }, note?: string (html) }} options
 */
export function layout({ preheader = '', eyebrow = '', eyebrowTone = 'brand', title, intro = '', body = '', cta = null, note = '' }) {
    const company = (process.env.MAIL_COMPANY_NAME ?? '').trim();
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader || title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dfe5e2;">
      <tr>
        <td bgcolor="${C.teal}" style="background:${C.teal};padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="${FONT}font-size:22px;font-weight:800;color:${C.creamText};letter-spacing:.01em;">Docs<span style="color:${C.cream};font-weight:400;">Up</span></td>
            <td align="right" style="${FONT}font-size:12px;color:${C.cream};opacity:.85;">Documentação de fornecedores</td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="height:4px;background:${C.cream};line-height:4px;font-size:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:28px 28px 8px;">
          ${eyebrow ? `<div style="margin:0 0 10px;">${badge(eyebrow, eyebrowTone)}</div>` : ''}
          <h1 style="margin:0 0 12px;${FONT}font-size:22px;line-height:29px;font-weight:800;color:${C.text};">${esc(title)}</h1>
          ${intro ? `<p style="margin:0 0 16px;${FONT}font-size:15px;line-height:23px;color:#374151;">${intro}</p>` : ''}
          ${body}
          ${cta ? button(cta.label, cta.url) : ''}
          ${note ? `<p style="margin:18px 0 0;${FONT}font-size:13px;line-height:20px;color:${C.muted};">${note}</p>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="border-top:1px solid ${C.border};padding-top:14px;${FONT}font-size:12px;line-height:18px;color:${C.muted};">
              Mensagem automática do DocsUp${company ? ` · ${esc(company)}` : ''}. Não responda este e-mail.
            </td>
          </tr></table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Versão em texto simples (clientes sem HTML): título, linhas e link. */
export function plainText({ title, lines = [], url = null }) {
    return [title, '', ...lines.filter(Boolean), ...(url ? ['', url] : []), '', '— Mensagem automática do DocsUp. Não responda este e-mail.'].join('\n');
}
