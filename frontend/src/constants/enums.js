// Espelha os enums TINYINT do banco (ver header do schema SQL).
// Cada grupo mapeia value -> { label, tone }. `tone` referencia uma chave
// de cor semantica consumida pelo componente <StatusBadge tone="..." />.

export const DEPARTMENT = {
  0: { label: 'RH', tone: 'info' },
  1: { label: 'Seguranca do Trabalho', tone: 'warning' },
  2: { label: 'Suprimentos', tone: 'indigo' },
  3: { label: 'Fiscal', tone: 'neutral' },
  4: { label: 'Financeiro', tone: 'success' },
  5: { label: 'Obra', tone: 'teal' },
  6: { label: 'Admin', tone: 'danger' },
};

export const CONTACT_TYPE = {
  0: { label: 'Legal', tone: 'indigo' },
  1: { label: 'Operacional', tone: 'info' },
  2: { label: 'Financeiro', tone: 'success' },
};

export const SUPPLIER_STATUS = {
  0: { label: 'Pendente de Cadastro', tone: 'warning' },
  1: { label: 'Ativo', tone: 'success' },
  2: { label: 'Inativo', tone: 'neutral' },
  3: { label: 'Bloqueado', tone: 'danger' },
};

export const RISK_LEVEL = {
  0: { label: 'Baixo', tone: 'success' },
  1: { label: 'Medio', tone: 'warning' },
  2: { label: 'Alto', tone: 'danger' },
  3: { label: 'Critico', tone: 'danger' },
};

export const DOCUMENT_SCOPE = {
  0: { label: 'Empresa', tone: 'indigo' },
  1: { label: 'Colaborador', tone: 'info' },
};

export const VALIDATION_METHOD = {
  0: { label: 'API Publica', tone: 'success' },
  1: { label: 'IA', tone: 'indigo' },
  2: { label: 'Manual', tone: 'neutral' },
  3: { label: 'Hibrida', tone: 'warning' },
};

export const URGENCY = {
  0: { label: 'Baixa', tone: 'neutral' },
  1: { label: 'Normal', tone: 'info' },
  2: { label: 'Alta', tone: 'warning' },
  3: { label: 'Urgente', tone: 'danger' },
};

export const LABOR_REQUEST_STATUS = {
  0: { label: 'Pendente de Aprovacao', tone: 'warning' },
  1: { label: 'Aprovado RH', tone: 'info' },
  2: { label: 'Reprovado', tone: 'danger' },
  3: { label: 'Em Cotacao', tone: 'indigo' },
  4: { label: 'Cotacao Encerrada', tone: 'neutral' },
  5: { label: 'Em Contratacao', tone: 'teal' },
  6: { label: 'Concluido', tone: 'success' },
  7: { label: 'Cancelado', tone: 'danger' },
};

export const APPROVAL_DECISION = {
  0: { label: 'Pendente', tone: 'warning' },
  1: { label: 'Reprovado', tone: 'danger' },
  2: { label: 'Aprovado', tone: 'success' },
};

export const QUOTATION_ROUND_STATUS = {
  0: { label: 'Aberta', tone: 'success' },
  1: { label: 'Encerrada', tone: 'neutral' },
  2: { label: 'Cancelada', tone: 'danger' },
};

export const QUOTATION_INVITE_STATUS = {
  0: { label: 'Enviado', tone: 'info' },
  1: { label: 'Visualizado', tone: 'indigo' },
  2: { label: 'Respondido', tone: 'success' },
  3: { label: 'Expirado', tone: 'danger' },
};

export const QUOTATION_STATUS = {
  0: { label: 'Rascunho', tone: 'neutral' },
  1: { label: 'Submetida', tone: 'info' },
  2: { label: 'Vencedora', tone: 'success' },
  3: { label: 'Perdedora', tone: 'neutral' },
  4: { label: 'Desclassificada', tone: 'danger' },
  5: { label: 'Desclassificada por Doc.', tone: 'danger' },
};

export const DOCUMENT_STATUS = {
  0: { label: 'Pendente', tone: 'warning' },
  1: { label: 'Validando', tone: 'info' },
  2: { label: 'Aprovado', tone: 'success' },
  3: { label: 'Reprovado', tone: 'danger' },
  4: { label: 'Reenvio Necessario', tone: 'warning' },
  5: { label: 'Expirado', tone: 'danger' },
};

export const VALIDATION_TYPE = {
  0: { label: 'API', tone: 'success' },
  1: { label: 'IA', tone: 'indigo' },
  2: { label: 'Manual', tone: 'neutral' },
};

export const FINAL_VALIDATION_STATUS = {
  0: { label: 'Pendente de Revisao', tone: 'warning' },
  1: { label: 'Aprovado', tone: 'success' },
  2: { label: 'Reprovado', tone: 'danger' },
};

export const RECEIPT_TYPE = {
  0: { label: 'Cotacao', tone: 'indigo' },
  1: { label: 'Documentacao', tone: 'info' },
  2: { label: 'Fase 2', tone: 'teal' },
};

export const EMPLOYEE_STATUS = {
  0: { label: 'Pendente de Docs', tone: 'warning' },
  1: { label: 'Docs em Validacao', tone: 'info' },
  2: { label: 'Aprovado', tone: 'success' },
  3: { label: 'Reprovado', tone: 'danger' },
  4: { label: 'Ativo', tone: 'success' },
  5: { label: 'Desligado', tone: 'neutral' },
};

export const PHASE2_STATUS = {
  0: { label: 'Em Andamento', tone: 'info' },
  1: { label: 'Concluido', tone: 'success' },
  2: { label: 'Expirado', tone: 'danger' },
  3: { label: 'Desclassificado por Doc.', tone: 'danger' },
};

export const EVALUATOR_ROLE = {
  0: { label: 'RH', tone: 'info' },
  1: { label: 'Suprimentos', tone: 'indigo' },
  2: { label: 'Chefe de Obra', tone: 'teal' },
};

export const PURCHASE_ORDER_STATUS = {
  0: { label: 'Aberto', tone: 'neutral' },
  1: { label: 'Aprovado', tone: 'info' },
  2: { label: 'Parcial', tone: 'warning' },
  3: { label: 'Faturado', tone: 'indigo' },
  4: { label: 'Pago', tone: 'success' },
  5: { label: 'Cancelado', tone: 'danger' },
};

export const INVOICE_STATUS = {
  0: { label: 'Recebida', tone: 'info' },
  1: { label: 'Validada', tone: 'indigo' },
  2: { label: 'Negada - Docs Pendentes', tone: 'danger' },
  3: { label: 'Lancada no Fiscal', tone: 'teal' },
  4: { label: 'Paga', tone: 'success' },
  5: { label: 'Cancelada', tone: 'neutral' },
};

export const PAYMENT_BLOCK_REASON = {
  0: { label: 'Documentos Pendentes', tone: 'warning' },
  1: { label: 'Documentos Expirados', tone: 'danger' },
  2: { label: 'Documentos Reprovados', tone: 'danger' },
  3: { label: 'Prazo Estourado', tone: 'danger' },
  4: { label: 'Quebra de Contrato', tone: 'danger' },
};

export const PAYMENT_BLOCK_STATUS = {
  0: { label: 'Ativo', tone: 'danger' },
  1: { label: 'Regularizado', tone: 'success' },
  2: { label: 'Cancelamento de Contrato', tone: 'neutral' },
};

export const REFRESH_STATUS = {
  0: { label: 'Pendente', tone: 'warning' },
  1: { label: 'Concluido', tone: 'success' },
  2: { label: 'Expirado', tone: 'danger' },
};

/** Helper generico: resolve { label, tone } de um enum, com fallback seguro. */
export function resolveEnum(enumMap, value) {
  return enumMap[value] ?? { label: 'Desconhecido', tone: 'neutral' };
}
