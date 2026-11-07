import { DEPARTMENTS } from './departments.js';

// Quem acessa cada área (o Admin acessa todas). Use com requireRole(...ACCESS.X).
// Espelhado no frontend em src/constants/access.js (lá é só experiência de uso).
export const ACCESS = Object.freeze({
    // Documentos enviados pelos fornecedores: listar, mudar status, fila de revisão
    SUPPLIER_DOCUMENTS: [DEPARTMENTS.RH, DEPARTMENTS.SEGURANCA_TRABALHO],
    // Colaboradores enviados pelos fornecedores
    EMPLOYEES: [DEPARTMENTS.RH, DEPARTMENTS.SEGURANCA_TRABALHO, DEPARTMENTS.OBRA],
    // Aprovar solicitação e definir os documentos exigidos do fornecedor
    REQUIRED_DOCUMENTS: [DEPARTMENTS.SEGURANCA_TRABALHO],
    // Base de fornecedores (lista e detalhe)
    SUPPLIERS: [DEPARTMENTS.SUPRIMENTOS],
    // Indicar o fornecedor de uma solicitação (e-mail e prazo), reenviar o convite, mudar o
    // prazo e trocar o fornecedor
    SUPPLIER_ASSIGNMENT: [DEPARTMENTS.SUPRIMENTOS],
    // Concluir o contrato (encerra a cobrança dos documentos mensais)
    CONCLUDE_CONTRACT: [DEPARTMENTS.RH, DEPARTMENTS.SUPRIMENTOS],
});
