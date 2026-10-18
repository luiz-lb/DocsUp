import { api } from '../../../utils/api.js';
import { getApiErrorMessage, toErrorResult } from '../../../utils/apiError.js';

// ---------------------------------------------------------------------------
// Usuários internos (só Admin): /users
// ---------------------------------------------------------------------------

/**
 * Lista usuários com busca, filtros e paginação.
 * @param {{page?: number, limit?: number, search?: string, department?: number, status?: '1'|'0'}} params
 *   status: '1' = ativos, '0' = inativos, sem valor = todos.
 */
export async function listUsers(params = {}) {
  try {
    const result = await api.get('/users', { params });
    return { success: true, body: result.data.body.result, pagination: result.data.body.pagination };
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return {
      success: false,
      body: [],
      pagination: null,
      message: getApiErrorMessage(error, 'Erro ao buscar usuários.'),
    };
  }
}

/** POST /users — { name, email, department, password } */
export async function createUser(payload) {
  try {
    const result = await api.post('/users', payload);
    return result.data;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return toErrorResult(error, 'Erro ao criar usuário.');
  }
}

/** PUT /users/:id — { name, email, department } */
export async function updateUser(id, payload) {
  try {
    const result = await api.put(`/users/${id}`, payload);
    return result.data;
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return toErrorResult(error, 'Erro ao atualizar usuário.');
  }
}

/** PUT /users/:id/status — ativa (true) ou inativa (false) */
export async function setUserStatus(id, isActive) {
  try {
    const result = await api.put(`/users/${id}/status`, { isActive });
    return result.data;
  } catch (error) {
    console.error('Erro ao alterar status do usuário:', error);
    return toErrorResult(error, 'Erro ao alterar o status do usuário.');
  }
}

/** PUT /users/:id/password — { password } */
export async function resetUserPassword(id, password) {
  try {
    const result = await api.put(`/users/${id}/password`, { password });
    return result.data;
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return toErrorResult(error, 'Erro ao redefinir a senha.');
  }
}
