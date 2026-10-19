import { DEPARTMENT_ID } from './enums.js';

// Quem acessa cada área (o Admin acessa todas). Espelha o backend
// (backend/src/constants/access.js), que é quem garante a permissão de verdade.
export const ACCESS = {
  // Documentos enviados pelos fornecedores
  supplierDocuments: [DEPARTMENT_ID.RH, DEPARTMENT_ID.SEGURANCA_TRABALHO],
  // Colaboradores enviados pelos fornecedores
  employees: [DEPARTMENT_ID.RH, DEPARTMENT_ID.SEGURANCA_TRABALHO, DEPARTMENT_ID.OBRA],
  // Base de fornecedores
  suppliers: [DEPARTMENT_ID.SUPRIMENTOS],
  // Administração (usuários, parâmetros e auditoria): só Admin
  admin: [],
};

export function canAccess(department, allowed) {
  return department === DEPARTMENT_ID.ADMIN || allowed.includes(department);
}
