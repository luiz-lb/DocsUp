import { api } from '../../../utils/api.js';
import { toErrorResult } from '../../../utils/apiError.js';

// ─────────────────────────────────────────────
// Auth do Fornecedor
// ─────────────────────────────────────────────

/**
 * Valida o CNPJ na API pública via backend.
 * POST /supplier/auth/validate-cnpj
 * Retorna { valid, razaoSocial, nomeFantasia, situacao, municipio, uf }
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
 * @param {{ cnpj, razaoSocial, nomeFantasia?, password, employeeCount?,
 *           city?, state?, contacts, categoryIds?, regionIds? }} payload
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
 * Fase 1 do login: CNPJ OU e-mail operacional + senha → backend envia OTP.
 * POST /supplier/auth/login
 * @param {string} identifier  — CNPJ ou e-mail operacional
 * @param {string} password
 * @param {'cnpj'|'email'} mode
 * Retorna { success: true, body: { requiresMfa: true, devOtp? } }
 */
export async function loginSupplier(identifier, password, mode = 'cnpj') {
  try {
    const payload = mode === 'email'
      ? { email: identifier, password }
      : { cnpj: identifier, password };
    const result = await api.post('/supplier/auth/login', payload);
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
 * Busca o perfil completo do fornecedor autenticado (dados, contatos, regiões).
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
 * Atualiza o perfil do fornecedor autenticado.
 * PUT /supplier/auth/profile
 */
export async function updateSupplierProfile(payload) {
  try {
    const result = await api.put('/supplier/auth/profile', payload);
    return result.data;
  } catch (error) {
    console.error('updateSupplierProfile error:', error);
    return toErrorResult(error, 'Erro ao atualizar perfil.');
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
 * @returns {{ supplier, contacts, regions, categories } | null}
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
// Dados de referência públicos (portal do fornecedor)
// ─────────────────────────────────────────────

/**
 * Busca activity_types sem autenticação interna.
 * GET /docRequired/public/activity_types
 */
export async function getActivityTypesPublic() {
  try {
    const result = await api.get('/docRequired/public/activity_types');
    return result.data.body?.result ?? [];
  } catch (error) {
    console.error('getActivityTypesPublic error:', error);
    return [];
  }
}

/**
 * Busca regiões com filtro de cidade e/ou estado (autocomplete).
 * GET /docRequired/public/regions?state=SP&city=Camp
 * @returns {{ id, city, state }[]}
 */
export async function searchRegions({ state, city } = {}) {
  try {
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (city)  params.append('city',  city);
    const result = await api.get(`/docRequired/public/regions?${params.toString()}`);
    return result.data.body?.result ?? [];
  } catch (error) {
    console.error('searchRegions error:', error);
    return [];
  }
}

/**
 * Busca todos os IDs de regiões de um estado inteiro.
 * GET /docRequired/public/regions/state/:state
 * @returns {number[]} array de IDs
 */
export async function getRegionIdsByState(state) {
  try {
    const result = await api.get(`/docRequired/public/regions/state/${state}`);
    return result.data.body?.ids ?? [];
  } catch (error) {
    console.error('getRegionIdsByState error:', error);
    return [];
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
