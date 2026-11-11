import crypto from 'crypto';

/**
 * Criptografia simétrica (AES-256-GCM) para dados sensíveis que passam pela fila de eventos
 * (ex.: o código de acesso do login). A chave é MAIL_SECRET_KEY: 32 bytes em base64 (ou
 * qualquer texto, que vira 32 bytes por SHA-256). Backend e notifier usam a mesma chave.
 *
 * Formato: "v1.<iv>.<tag>.<dados>" (base64url).
 */

function key() {
    const raw = (process.env.MAIL_SECRET_KEY ?? '').trim();
    if (!raw) return null;
    const decoded = Buffer.from(raw, 'base64');
    return decoded.length === 32 ? decoded : crypto.createHash('sha256').update(raw).digest();
}

export function hasSecretKey() {
    return key() !== null;
}

export function seal(text) {
    const secret = key();
    if (!secret) throw new Error('MAIL_SECRET_KEY não configurada.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
    const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function open(sealed) {
    const secret = key();
    if (!secret) throw new Error('MAIL_SECRET_KEY não configurada.');
    const [version, iv, tag, data] = String(sealed ?? '').split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Dado criptografado inválido.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
