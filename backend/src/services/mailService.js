/**
 * Envio de e-mail pelo Microsoft Graph, pela caixa GRAPH_SENDER (aplicativo do Azure com a
 * permissão de aplicativo Mail.Send). Variáveis: GRAPH_TENANT_ID, GRAPH_CLIENT_ID,
 * GRAPH_CLIENT_SECRET e GRAPH_SENDER. Sem as quatro, o envio fica desligado: os envios ficam
 * como "não enviado" em Parâmetros → Notificações.
 *
 * Quem envia é só o serviço notifier (a partir dos eventos do Kafka); a API nunca envia.
 *
 * MAIL_REDIRECT_TO (opcional, para testes): todos os e-mails vão para esse endereço, com uma
 * faixa no topo dizendo para quem iriam. Vazio = desligado.
 */

const GRAPH_VARS = ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_CLIENT_SECRET', 'GRAPH_SENDER'];
const REQUEST_TIMEOUT_MS = 30000;

// Endereços do Microsoft (trocados só nos testes, por um Graph falso)
const authBase = () => (process.env.GRAPH_AUTH_URL || 'https://login.microsoftonline.com').replace(/\/+$/, '');
const apiBase = () => (process.env.GRAPH_API_URL || 'https://graph.microsoft.com/v1.0').replace(/\/+$/, '');

export function isMailEnabled() {
    return GRAPH_VARS.every((name) => (process.env[name] ?? '').trim() !== '');
}

// ── Token de aplicativo (client credentials), reaproveitado até perto de vencer ──
let cachedToken = null;

async function getToken({ force = false } = {}) {
    if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
    const response = await fetch(`${authBase()}/${encodeURIComponent(process.env.GRAPH_TENANT_ID.trim())}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GRAPH_CLIENT_ID.trim(),
            client_secret: process.env.GRAPH_CLIENT_SECRET.trim(),
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
        cachedToken = null;
        const description = String(data.error_description ?? '').split(/\r?\n/)[0];
        throw Object.assign(new Error(`Token do Microsoft recusado (${response.status} ${data.error ?? ''} ${description})`.trim()), {
            // credencial errada / app sem consentimento não se resolve tentando de novo
            permanent: response.status === 400 || response.status === 401,
        });
    }
    cachedToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
    return cachedToken.value;
}

/** Limpa o token guardado (testes). */
export function resetMailToken() {
    cachedToken = null;
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

/** Espera pedida pelo Microsoft (cabeçalho Retry-After, em segundos), em ms. */
function retryAfterMs(response) {
    const seconds = Number(response.headers.get('retry-after'));
    return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 3600000) : null;
}

async function postSendMail(token, message) {
    return fetch(`${apiBase()}/users/${encodeURIComponent(process.env.GRAPH_SENDER.trim())}/sendMail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

/**
 * Envia um e-mail e diz o que aconteceu.
 *
 * @param {{ to: string|string[], subject: string, html: string }} message
 * @returns {Promise<{ status: 'sent'|'skipped'|'failed', error?: string, retryAfterMs?: number,
 *                     permanent?: boolean, redirectedTo?: string }>}
 *   skipped   = envio desligado (variáveis GRAPH_* vazias) ou sem destinatário;
 *   failed    = vai tentar de novo (retryAfterMs: espera pedida pelo Microsoft);
 *   permanent = não adianta tentar de novo (ex.: destinatário inválido): vai para a fila de erro.
 */
export async function deliverMail({ to, subject, html }) {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (recipients.length === 0) return { status: 'skipped', error: 'Sem destinatário.' };

    if (!isMailEnabled()) {
        console.log(`[E-MAIL DESLIGADO] Não enviado → para: ${recipients.join(', ')} | assunto: ${subject}`);
        return { status: 'skipped', error: 'Envio de e-mail desligado (variáveis GRAPH_* não preenchidas).' };
    }

    const redirect = redirectTarget();
    const finalTo = redirect ? [redirect] : recipients;
    const finalHtml = redirect ? html.replace(/<body([^>]*)>/i, (match) => `${match}${redirectBanner(recipients)}`) : html;
    const message = {
        message: {
            subject: redirect ? `[TESTE] ${subject}` : subject,
            body: { contentType: 'HTML', content: finalHtml },
            toRecipients: finalTo.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: false,
    };

    try {
        let response = await postSendMail(await getToken(), message);
        if (response.status === 401) {
            // Token vencido ou revogado: pede outro uma vez
            response = await postSendMail(await getToken({ force: true }), message);
        }
        if (response.status === 202 || response.ok) {
            return { status: 'sent', ...(redirect ? { redirectedTo: redirect } : {}) };
        }
        const data = await response.json().catch(() => ({}));
        const error = `Graph ${response.status}: ${data.error?.code ?? ''} ${data.error?.message ?? ''}`.trim().slice(0, 900);
        const transient = response.status === 429 || response.status >= 500;
        return { status: 'failed', error, retryAfterMs: retryAfterMs(response), permanent: !transient };
    } catch (error) {
        // Rede / tempo esgotado: tenta de novo; credencial recusada: fila de erro
        return { status: 'failed', error: error.message, permanent: Boolean(error.permanent) };
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
