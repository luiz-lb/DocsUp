import { api } from '../../../utils/api.js';
import { toErrorResult } from '../../../utils/apiError.js';

// ─────────────────────────────────────────────
// Auth do Fornecedor
// ─────────────────────────────────────────────

/**
 * Valida o CNPJ na API pública via backend.
 * POST /supplier/auth/validate-cnpj
 * Retorna { valid, alreadyRegistered, razaoSocial, nomeFantasia, situacao }
 */
export async function validateCnpj(cnpj) {
  try {
    const result = await api.post('/supplier/auth/validate-cnpj', { cnpj });
    return result.data.body;
  } catch (error) {
    console.error('validateCnpj error:', error);
    return { valid: false, razaoSocial: null, situacao: null };
  }
}

/**
 * Registra um novo fornecedor.
 * POST /supplier/auth/register
 *
 * @param {{ cnpj, razaoSocial, nomeFantasia?, owner: { name, email },
 *           operator: { name, email }, password }} payload
 */
export async function registerSupplier(payload) {
  try {
    const result = await api.post('/supplier/auth/register', payload);
    return result.data;
  } catch (error) {
    console.error('registerSupplier error:', error);
    return toErrorResult(error, 'Erro ao cadastrar fornecedor.');
  }
}

/**
 * Fase 1 do login: e-mail do usuário (Responsável ou Operador) + senha → backend envia o código.
 * POST /supplier/auth/login
 * Retorna { success: true, body: { requiresMfa: true, devOtp? } }
 */
export async function loginSupplier(email, password) {
  try {
    const result = await api.post('/supplier/auth/login', { email, password });
    return result.data;
  } catch (error) {
    console.error('loginSupplier error:', error);
    return toErrorResult(error, 'Erro ao fazer login.');
  }
}

/**
 * Fase 2 do login: envia o OTP para validação.
 * POST /supplier/auth/verify-mfa
 * Retorna { success, body: { supplier } } e seta o cookie supplier_token.
 */
export async function verifyMfaCode(otp) {
  try {
    const result = await api.post('/supplier/auth/verify-mfa', { otp });
    return result.data;
  } catch (error) {
    console.error('verifyMfaCode error:', error);
    return toErrorResult(error, 'Erro ao verificar código.');
  }
}

/**
 * Logout do fornecedor — limpa o cookie supplier_token.
 * POST /supplier/auth/logout
 */
export async function logoutSupplier() {
  try {
    await api.post('/supplier/auth/logout');
  } catch (error) {
    console.error('logoutSupplier error:', error);
  }
}

/**
 * Retorna os dados do fornecedor autenticado.
 * GET /supplier/auth/me
 */
export async function meSupplier() {
  try {
    const result = await api.get('/supplier/auth/me');
    return result.data;
  } catch {
    return { success: false };
  }
}

/**
 * Perfil do fornecedor autenticado: { supplier, users, currentUserId }.
 * GET /supplier/auth/profile
 */
export async function getSupplierProfile() {
  try {
    const result = await api.get('/supplier/auth/profile');
    if (!result.data.success) return null;
    return result.data.body;
  } catch (error) {
    console.error('getSupplierProfile error:', error);
    return null;
  }
}

/**
 * Dados da empresa (nome fantasia; só o Responsável).
 * PUT /supplier/auth/profile  Body: { nomeFantasia }
 */
export async function updateSupplierCompany(payload) {
  try {
    const result = await api.put('/supplier/auth/profile', payload);
    return result.data;
  } catch (error) {
    console.error('updateSupplierCompany error:', error);
    return toErrorResult(error, 'Erro ao atualizar os dados da empresa.');
  }
}

/**
 * Nome e e-mail de um usuário do fornecedor (o próprio; o Responsável também edita o
 * Operador e pode definir uma nova senha para ele).
 * PUT /supplier/auth/users/:id  Body: { name, email, password? }
 */
export async function updateSupplierUser(userId, payload) {
  try {
    const result = await api.put(`/supplier/auth/users/${userId}`, payload);
    return result.data;
  } catch (error) {
    console.error('updateSupplierUser error:', error);
    return toErrorResult(error, 'Erro ao atualizar o usuário.');
  }
}

/**
 * Cadastra o usuário que falta (Responsável ou Operador) de um fornecedor antigo.
 * POST /supplier/auth/users  Body: { role, name, email, password }
 */
export async function createSupplierUser(payload) {
  try {
    const result = await api.post('/supplier/auth/users', payload);
    return result.data;
  } catch (error) {
    console.error('createSupplierUser error:', error);
    return toErrorResult(error, 'Erro ao cadastrar o usuário.');
  }
}

/**
 * Troca a senha do usuário logado.
 * PUT /supplier/auth/password  Body: { currentPassword, newPassword }
 */
export async function changeSupplierPassword(currentPassword, newPassword) {
  try {
    const result = await api.put('/supplier/auth/password', { currentPassword, newPassword });
    return result.data;
  } catch (error) {
    console.error('changeSupplierPassword error:', error);
    return toErrorResult(error, 'Erro ao trocar a senha.');
  }
}

// ─────────────────────────────────────────────
// Painel interno — base de fornecedores (dados reais)
// ─────────────────────────────────────────────

/**
 * Lista fornecedores cadastrados (painel interno).
 * GET /suppliers?search=&status=
 */
export async function listSuppliers(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status !== undefined && filters.status !== '') params.append('status', filters.status);
    const result = await api.get(`/suppliers?${params.toString()}`);
    if (!result.data.success) return [];
    return result.data.body?.suppliers ?? [];
  } catch (error) {
    console.error('listSuppliers error:', error);
    return [];
  }
}

/**
 * Detalhe completo de um fornecedor (painel interno).
 * GET /suppliers/:id
 * @returns {{ supplier, users } | null}
 */
export async function getSupplierDetail(id) {
  try {
    const result = await api.get(`/suppliers/${id}`);
    if (!result.data.success) return null;
    return result.data.body;
  } catch (error) {
    console.error('getSupplierDetail error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────
// Cotações do fornecedor (portal)
// ─────────────────────────────────────────────

/**
 * Lista as cotações do fornecedor autenticado (pendentes, enviadas, aprovadas).
 * GET /quotations/supplier/my-quotations
 * Exige cookie supplier_token.
 */
export async function getMyQuotations() {
  try {
    const result = await api.get('/quotations/supplier/my-quotations');
    return result.data.body?.quotations ?? [];
  } catch (error) {
    console.error('getMyQuotations error:', error);
    return [];
  }
}
