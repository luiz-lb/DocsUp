import { getApiErrorMessage } from './apiError.js';

/**
 * Nome do arquivo do cabeçalho Content-Disposition. Prefere o filename* (UTF-8, com
 * acentos) ao filename simples. O backend precisa expor o cabeçalho no CORS.
 */
export function fileNameFromDisposition(header, fallback) {
  if (typeof header !== 'string') return fallback;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // segue para o filename simples
    }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/** Salva um Blob como arquivo no computador (dispara o download do navegador). */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo de o navegador começar o download antes de liberar a memória
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Mensagem de erro de uma requisição feita com responseType 'blob': o corpo do erro
 * ({ success, body: { message } }) também chega como Blob e precisa ser lido.
 */
export async function blobErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      const message = parsed?.body?.message ?? parsed?.message;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      // corpo não era JSON
    }
    return fallback;
  }
  return getApiErrorMessage(error, fallback);
}
