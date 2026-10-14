/**
 * Extrai a mensagem de erro vinda do backend de forma consistente.
 *
 * O backend responde com o formato: { success: false, body: { message } }.
 * Esta função tenta, em ordem:
 *   1. error.response.data.body.message   (padrão do backend)
 *   2. error.response.data.message         (fallback)
 *   3. error.message                       (erro de rede/axios)
 *   4. fallback informado                  (mensagem genérica)
 *
 * @param {unknown} error     — erro capturado no catch (normalmente do axios)
 * @param {string}  fallback  — mensagem padrão caso nada seja encontrado
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = 'Ocorreu um erro inesperado. Tente novamente.') {
  const data = error?.response?.data;
  const message = data?.body?.message ?? data?.message;

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  // Sem resposta do servidor => provável falha de rede/timeout
  if (error?.response === undefined && error?.message) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
  }

  return fallback;
}

/**
 * Normaliza a resposta de erro de uma chamada de API em um objeto padrão
 * `{ success: false, body: { message } }`, reaproveitando a mensagem do backend.
 */
export function toErrorResult(error, fallback) {
  return { success: false, body: { message: getApiErrorMessage(error, fallback) } };
}
