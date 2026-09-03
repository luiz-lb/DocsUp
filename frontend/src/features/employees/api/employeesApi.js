import { api } from '../../../utils/api.js';

// ─────────────────────────────────────────────
// Phase 2 — Portal do Fornecedor
// ─────────────────────────────────────────────

/**
 * Busca dados da Fase 2 pelo token do link.
 * GET /phase2/:token  (público)
 * Retorna { deadline, employees, documents, requiredDocuments }
 */
export async function getPhase2ByToken(token) {
  try {
    const result = await api.get(`/phase2/${token}`);
    if (!result.data.success) return null;
    return result.data.body;
  } catch (error) {
    console.error('getPhase2ByToken error:', error);
    return null;
  }
}

/**
 * Cadastra um funcionário com documentos na Fase 2.
 * POST /phase2/:token/employee  (exige cookie supplier_token)
 *
 * @param {string}   token
 * @param {{ fullName, cpf, rg?, roleFunction, nrTypeIds[] }} employeeData
 * @param {File[]}   files  — arquivos do FileDropzone
 */
export async function addEmployee(token, employeeData, files = []) {
  try {
    const formData = new FormData();
    formData.append('fullName', employeeData.fullName);
    formData.append('cpf', employeeData.cpf);
    if (employeeData.rg) formData.append('rg', employeeData.rg);
    if (employeeData.roleFunction) formData.append('roleFunction', employeeData.roleFunction);
    formData.append('nrTypeIds', JSON.stringify(employeeData.nrTypeIds ?? []));

    for (const file of files) {
      formData.append('files', file);
    }

    const result = await api.post(`/phase2/${token}/employee`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return result.data;
  } catch (error) {
    console.error('addEmployee error:', error);
    return { success: false, body: { message: 'Erro ao cadastrar funcionário.' } };
  }
}

// ─────────────────────────────────────────────
// Painel interno (colaboradores)
// ─────────────────────────────────────────────

/**
 * Lista todos os funcionários enviados pelos fornecedores.
 * GET /phase2/employees/list  (exige JWT colaborador)
 */
export async function listEmployees() {
  try {
    const result = await api.get('/phase2/employees/list');
    if (!result.data.success) return [];
    return result.data.body.employees;
  } catch (error) {
    console.error('listEmployees error:', error);
    return [];
  }
}
