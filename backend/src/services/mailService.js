import nodemailer from 'nodemailer';

/**
 * Envio de e-mail num lugar só. Fica DESLIGADO enquanto SMTP_ENABLED não for 'true' no .env
 * (o SMTP do Gmail recusava as credenciais): nesse caso só registra no log que o e-mail não
 * foi enviado. Ligado, usa SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS.
 *
 * Enquanto estiver desligado, quem depende do e-mail mostra o link na tela (convite do
 * fornecedor) ou, fora de produção, devolve o código na resposta (login do fornecedor).
 */
export function isMailEnabled() {
    return process.env.SMTP_ENABLED === 'true';
}

let transporter = null;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
    }
    return transporter;
}

/** Remetente padrão: '"DocsUp" <SMTP_USER>'. */
export function defaultFrom(name = 'DocsUp') {
    return `"${name}" <${process.env.SMTP_USER ?? ''}>`;
}

/**
 * Envia um e-mail. Retorna true se foi enviado; false se o envio está desligado ou falhou
 * (a falha fica no log: e-mail nunca derruba o fluxo que o chamou).
 *
 * @param {{ to: string|string[], subject: string, html: string, from?: string }} message
 */
export async function sendMail({ to, subject, html, from }) {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (recipients.length === 0) return false;

    if (!isMailEnabled()) {
        console.log(`[SMTP DESATIVADO] E-mail não enviado → para: ${recipients.join(', ')} | assunto: ${subject}`);
        return false;
    }

    try {
        await getTransporter().sendMail({ from: from ?? defaultFrom(), to: recipients.join(', '), subject, html });
        return true;
    } catch (error) {
        console.error(`Erro ao enviar e-mail (${subject}):`, error.message);
        return false;
    }
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
