import { api } from '../../../utils/api.js';

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
    return { success: false, body: { message: 'Erro ao cadastrar fornecedor.' } };
  }
}

/**
 * Fase 1 do login: CNPJ + senha → backend envia OTP por email.
 * POST /supplier/auth/login
 * Retorna { success: true, body: { requiresMfa: true, devOtp? } }
 */
export async function loginSupplier(cnpj, password) {
  try {
    const result = await api.post('/supplier/auth/login', { cnpj, password });
    return result.data;
  } catch (error) {
    console.error('loginSupplier error:', error);
    return { success: false, body: { message: 'Erro ao fazer login.' } };
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
    return { success: false, body: { message: 'Erro ao verificar código.' } };
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
import { mockDelay } from '../../../hooks/useMockApi.js';

const suppliers = [
  {
    id: 1,
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'Eletro Instala Servicos Eletricos LTDA',
    nomeFantasia: 'Eletro Instala',
    status: 1,
    overallScore: 87.4,
    employeeCount: 42,
    city: 'Sao Paulo',
    state: 'SP',
    categoryIds: [1],
    regionIds: [1, 2],
    contacts: [
      { name: 'Roberto Nunes', email: 'roberto@eletroinstala.com.br', type: 0 },
      { name: 'Patricia Melo', email: 'patricia@eletroinstala.com.br', type: 1 },
    ],
  },
  {
    id: 2,
    cnpj: '98.765.432/0001-10',
    razaoSocial: 'Solda Forte Caldeiraria e Estruturas S.A.',
    nomeFantasia: 'Solda Forte',
    status: 1,
    overallScore: 71.2,
    employeeCount: 28,
    city: 'Barueri',
    state: 'SP',
    categoryIds: [4],
    regionIds: [1],
    contacts: [{ name: 'Igor Tavares', email: 'igor@soldaforte.com.br', type: 0 }],
  },
  {
    id: 3,
    cnpj: '11.222.333/0001-44',
    razaoSocial: 'Limpa Obra Servicos Gerais LTDA',
    nomeFantasia: 'Limpa Obra',
    status: 0,
    overallScore: 0,
    employeeCount: 15,
    city: 'Campinas',
    state: 'SP',
    categoryIds: [3],
    regionIds: [2],
    contacts: [{ name: 'Sueli Cardoso', email: 'sueli@limpaobra.com.br', type: 0 }],
  },
];

export function listSuppliers() {
  return mockDelay([...suppliers]);
}

export function getSupplier(id) {
  return mockDelay(suppliers.find((supplier) => supplier.id === Number(id)) ?? null);
}
