import nodemailer from 'nodemailer';

/**
 * Envio de e-mail num lugar só. Fica DESLIGADO enquanto SMTP_ENABLED não for 'true' no .env:
 * nesse caso só registra no log que o e-mail não foi enviado. Ligado, usa SMTP_HOST /
 * SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS (e SMTP_FROM, se o remetente for outro).
 *
 * MAIL_REDIRECT_TO (opcional, para testes): todos os e-mails vão para esse endereço, com uma
 * faixa no topo dizendo para quem iriam. Vazio = desligado.
 *
 * Quem envia: o serviço notifier (notificações, a partir dos eventos) e o login do fornecedor
 * (código de acesso, direto: é um código de segurança que não deve ficar em fila nem em log).
 */
export function isMailEnabled() {
    return process.env.SMTP_ENABLED === 'true';
}

let transporter = null;
function getTransporter() {
    if (!transporter) {
        const hasAuth = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            ...(hasAuth ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : {}),
            // Conexões reaproveitadas (vários avisos de uma vez não abrem uma conexão cada).
            // SMTP_POOL=false volta para uma conexão por e-mail.
            pool: process.env.SMTP_POOL !== 'false',
            maxConnections: 3,
            maxMessages: 50,
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
        });
    }
    return transporter;
}

/** Remetente padrão: '"DocsUp" <SMTP_FROM ou SMTP_USER>'. */
export function defaultFrom(name = 'DocsUp') {
    return `"${name}" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'docsup@localhost'}>`;
}

function redirectTarget() {
    const target = (process.env.MAIL_REDIRECT_TO ?? '').trim();
    return target || null;
}

/** Faixa no topo do e-mail redirecionado (teste). */
function redirectBanner(originalRecipients) {
    return `<div style="background:#fef3dd;border:1px solid #f5a524;color:#7a4b00;padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;margin:0 0 12px;">`
        + `<strong>E-mail de teste redirecionado.</strong> Iria para: ${escapeHtml(originalRecipients.join(', '))}</div>`;
}

/**
 * Envia um e-mail e diz o que aconteceu.
 *
 * @param {{ to: string|string[], subject: string, html: string, text?: string, from?: string }} message
 * @returns {Promise<{ status: 'sent'|'skipped'|'failed', error?: string, messageId?: string, redirectedTo?: string }>}
 *          skipped = envio de e-mail desligado (SMTP_ENABLED) ou sem destinatário
 */
export async function deliverMail({ to, subject, html, text, from }) {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (recipients.length === 0) return { status: 'skipped', error: 'Sem destinatário.' };

    if (!isMailEnabled()) {
        console.log(`[SMTP DESATIVADO] E-mail não enviado → para: ${recipients.join(', ')} | assunto: ${subject}`);
        return { status: 'skipped', error: 'Envio de e-mail desligado (SMTP_ENABLED).' };
    }

    const redirect = redirectTarget();
    const finalTo = redirect ? [redirect] : recipients;
    const finalHtml = redirect ? html.replace(/<body([^>]*)>/i, (match) => `${match}${redirectBanner(recipients)}`) : html;
    const finalSubject = redirect ? `[TESTE] ${subject}` : subject;
    const finalText = text && redirect ? `[Teste: iria para ${recipients.join(', ')}]\n\n${text}` : text;

    try {
        const info = await getTransporter().sendMail({
            from: from ?? defaultFrom(),
            to: finalTo.join(', '),
            subject: finalSubject,
            html: finalHtml,
            ...(finalText ? { text: finalText } : {}),
        });
        return { status: 'sent', messageId: info?.messageId, ...(redirect ? { redirectedTo: redirect } : {}) };
    } catch (error) {
        return { status: 'failed', error: error.message };
    }
}

/**
 * Envia um e-mail. Retorna true se foi enviado; false se o envio está desligado ou falhou
 * (a falha fica no log: e-mail nunca derruba o fluxo que o chamou).
 *
 * @param {{ to: string|string[], subject: string, html: string, from?: string }} message
 */
export async function sendMail(message) {
    const result = await deliverMail(message);
    if (result.status === 'failed') console.error(`Erro ao enviar e-mail (${message.subject}):`, result.error);
    return result.status === 'sent';
}

/** Texto seguro dentro do HTML do e-mail (nomes, títulos e motivos digitados por pessoas). */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
