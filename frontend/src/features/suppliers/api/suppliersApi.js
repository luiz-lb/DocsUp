import { mockDelay } from '../../../hooks/useMockApi.js';
import { isValidCnpj } from '../../../utils/validators.js';

let seq = 4;
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

/** Simula a validacao do CNPJ contra uma API publica durante o cadastro. */
export function validateCnpj(cnpj) {
  const valid = isValidCnpj(cnpj);
  return mockDelay(
    valid
      ? { valid: true, razaoSocial: 'Empresa Validada Automaticamente LTDA', situacao: 'ATIVA' }
      : { valid: false, razaoSocial: null, situacao: null },
    600,
  );
}

/** CNPJ + senha -> sempre exige MFA (contatos legal/operacional recebem o codigo). */
export function loginSupplier(cnpj) {
  const supplier = suppliers.find((item) => item.cnpj === cnpj);
  return mockDelay({ requiresMfa: true, supplierId: supplier?.id ?? null }, 500);
}

/** Codigo demo fixo: 123456. */
export function verifyMfaCode(code) {
  return mockDelay({ success: code === '123456' }, 500);
}

export function registerSupplier(payload) {
  seq += 1;
  const record = { id: seq, status: 0, overallScore: 0, ...payload };
  suppliers.push(record);
  return mockDelay(record, 600);
}
