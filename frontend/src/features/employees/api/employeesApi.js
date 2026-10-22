import { api } from '../../../utils/api.js';
import { getApiErrorMessage, toErrorResult } from '../../../utils/apiError.js';
import { blobErrorMessage, fileNameFromDisposition, saveBlob } from '../../../utils/download.js';

// ─────────────────────────────────────────────
// Phase 2 — Portal do Fornecedor
// ─────────────────────────────────────────────

/**
 * Busca dados da Fase 2 pelo token do link.
 * GET /phase2/:token  (exige cookie supplier_token; 403 se o link for de outro fornecedor)
 * Retorna { success: true, body: { deadline, employees, documents, requiredDocuments,
 *   employeeDocumentTypes, companyDocumentTypes } } ou { success: false, message }.
 */
export async function getPhase2ByToken(token) {
  try {
    const result = await api.get(`/phase2/${token}`);
    if (!result.data.success) {
      return { success: false, message: result.data.body?.message ?? 'O link da Fase 2 é inválido.' };
    }
    return { success: true, body: result.data.body };
  } catch (error) {
    console.error('getPhase2ByToken error:', error);
    return {
      success: false,
      message: getApiErrorMessage(error, 'O link da Fase 2 é inválido, expirado ou já foi utilizado.'),
    };
  }
}

/**
 * Solicitações em que o fornecedor logado tem link da Fase 2, com o prazo e o resumo dos documentos.
 * GET /phase2/supplier/requests  (exige cookie supplier_token)
 */
export async function listMyPhase2Requests() {
  try {
    const result = await api.get('/phase2/supplier/requests');
    return { success: true, body: result.data.body?.result ?? [] };
  } catch (error) {
    console.error('listMyPhase2Requests error:', error);
    return { success: false, body: [], message: getApiErrorMessage(error, 'Erro ao buscar as solicitações da Fase 2.') };
  }
}

/**
 * O fornecedor baixa um arquivo que ele enviou nesta solicitação (atual ou do histórico).
 * GET /phase2/:token/documents/:documentId/download  (exige cookie supplier_token)
 * @returns {Promise<{ success: true, fileName } | { success: false, body: { message } }>}
 */
export async function downloadPhase2Document(token, documentId) {
  try {
    const result = await api.get(`/phase2/${token}/documents/${documentId}/download`, { responseType: 'blob' });
    const fileName = fileNameFromDisposition(result.headers['content-disposition'], 'documento');
    saveBlob(result.data, fileName);
    return { success: true, fileName };
  } catch (error) {
    console.error('downloadPhase2Document error:', error);
    return { success: false, body: { message: await blobErrorMessage(error, 'Erro ao baixar o arquivo.') } };
  }
}

/**
 * Cadastra/atualiza um colaborador com UM documento (um arquivo).
 * POST /phase2/:token/employee  (exige cookie supplier_token)
 *
 * Modelo "um documento por vez": cada envio associa o colaborador a um tipo de
 * documento (ASO, NR, Ficha de EPI...) e ao arquivo daquele documento.
 *
 * @param {string}   token
 * @param {{ fullName, cpf, rg?, roleFunction?, documentTypeId, expiresAt? }} employeeData
 *   expiresAt: 'AAAA-MM-DD' (obrigatório quando o tipo tem validade)
 * @param {File}     file  — o arquivo deste documento
 */
export async function addEmployee(token, employeeData, file) {
  try {
    const formData = new FormData();
    formData.append('fullName', employeeData.fullName);
    formData.append('cpf', employeeData.cpf);
    if (employeeData.rg) formData.append('rg', employeeData.rg);
    if (employeeData.roleFunction) formData.append('roleFunction', employeeData.roleFunction);
    if (employeeData.documentTypeId) formData.append('documentTypeId', String(employeeData.documentTypeId));
    if (employeeData.expiresAt) formData.append('expiresAt', employeeData.expiresAt);

    // Um único arquivo — o documento selecionado
    if (file) formData.append('files', file);

    const result = await api.post(`/phase2/${token}/employee`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return result.data;
  } catch (error) {
    console.error('addEmployee error:', error);
    return toErrorResult(error, 'Erro ao enviar o documento do colaborador.');
  }
}

/**
 * Envia documentos da EMPRESA na Fase 2.
 * POST /phase2/:token/company-documents  (exige cookie supplier_token)
 *
 * @param {string}          token
 * @param {File[]}          files            — arquivos do FileDropzone
 * @param {number[]}        documentTypeIds  — tipo de cada arquivo, paralelo a files
 * @param {(string|null)[]} expiresAt        — validade 'AAAA-MM-DD' de cada arquivo (null sem validade), paralelo a files
 */
export async function uploadCompanyDocuments(token, files = [], documentTypeIds = [], expiresAt = []) {
  try {
    const formData = new FormData();
    formData.append('documentTypeIds', JSON.stringify(documentTypeIds ?? []));
    formData.append('expiresAt', JSON.stringify(expiresAt ?? []));

    for (const file of files) {
      formData.append('files', file);
    }

    const result = await api.post(`/phase2/${token}/company-documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return result.data;
  } catch (error) {
    console.error('uploadCompanyDocuments error:', error);
    return toErrorResult(error, 'Erro ao enviar documentos da empresa.');
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
