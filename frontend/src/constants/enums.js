// Espelha os enums TINYINT do banco (ver header do schema SQL).
// Cada grupo mapeia value -> { label, tone }. `tone` referencia uma chave
// de cor semantica consumida pelo componente <StatusBadge tone="..." />.

export const DEPARTMENT = {
  0: { label: 'RH', tone: 'info' },
  1: { label: 'Segurança do Trabalho', tone: 'warning' },
  2: { label: 'Suprimentos', tone: 'indigo' },
  3: { label: 'Fiscal', tone: 'neutral' },
  4: { label: 'Financeiro', tone: 'success' },
  5: { label: 'Obra', tone: 'teal' },
  6: { label: 'Admin', tone: 'danger' },
};

// Ids do DEPARTMENT por nome, para regras de acesso (mesmos valores do backend)
export const DEPARTMENT_ID = {
  RH: 0,
  SEGURANCA_TRABALHO: 1,
  SUPRIMENTOS: 2,
  FISCAL: 3,
  FINANCEIRO: 4,
  OBRA: 5,
  ADMIN: 6,
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
  1: { label: 'Médio', tone: 'warning' },
  2: { label: 'Alto', tone: 'danger' },
  3: { label: 'Crítico', tone: 'danger' },
};

export const DOCUMENT_SCOPE = {
  0: { label: 'Empresa', tone: 'indigo' },
  1: { label: 'Colaborador', tone: 'info' },
};

// document_types.category (o scope é derivado dela: 0 = empresa; 1, 2 e 3 = colaborador)
export const DOCUMENT_CATEGORY = {
  0: { label: 'Documentos da empresa', tone: 'indigo' },
  1: { label: 'Básicos do colaborador', tone: 'info' },
  2: { label: 'NRs do colaborador', tone: 'warning' },
  3: { label: 'Outros do colaborador', tone: 'neutral' },
};

// Ids do DOCUMENT_CATEGORY por nome (mesmos valores do backend)
export const DOCUMENT_CATEGORY_ID = {
  EMPRESA: 0,
  BASICO: 1,
  NR: 2,
  OUTRO: 3,
};

export const VALIDATION_METHOD = {
  0: { label: 'API Pública', tone: 'success' },
  1: { label: 'IA', tone: 'indigo' },
  2: { label: 'Manual', tone: 'neutral' },
  3: { label: 'Híbrida', tone: 'warning' },
};

export const URGENCY = {
  0: { label: 'Baixa', tone: 'neutral' },
  1: { label: 'Normal', tone: 'info' },
  2: { label: 'Alta', tone: 'warning' },
  3: { label: 'Urgente', tone: 'danger' },
};

export const LABOR_REQUEST_STATUS = {
  0: { label: 'Pendente de Aprovação', tone: 'warning' },
  1: { label: 'Aprovado RH', tone: 'info' },
  2: { label: 'Reprovado', tone: 'danger' },
  3: { label: 'Em Cotação', tone: 'indigo' },
  4: { label: 'Cotação Encerrada', tone: 'neutral' },
  5: { label: 'Em Contratação', tone: 'teal' },
  6: { label: 'Concluído', tone: 'success' },
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
  4: { label: 'Reenvio Necessário', tone: 'warning' },
  5: { label: 'Expirado', tone: 'danger' },
};

export const VALIDATION_TYPE = {
  0: { label: 'API', tone: 'success' },
  1: { label: 'IA', tone: 'indigo' },
  2: { label: 'Manual', tone: 'neutral' },
};

export const FINAL_VALIDATION_STATUS = {
  0: { label: 'Pendente de Revisão', tone: 'warning' },
  1: { label: 'Aprovado', tone: 'success' },
  2: { label: 'Reprovado', tone: 'danger' },
};

export const RECEIPT_TYPE = {
  0: { label: 'Cotação', tone: 'indigo' },
  1: { label: 'Documentação', tone: 'info' },
  2: { label: 'Fase 2', tone: 'teal' },
};

export const EMPLOYEE_STATUS = {
  0: { label: 'Pendente de Docs', tone: 'warning' },
  1: { label: 'Docs em Validação', tone: 'info' },
  2: { label: 'Aprovado', tone: 'success' },
  3: { label: 'Reprovado', tone: 'danger' },
  4: { label: 'Ativo', tone: 'success' },
  5: { label: 'Desligado', tone: 'neutral' },
};

export const PHASE2_STATUS = {
  0: { label: 'Em Andamento', tone: 'info' },
  1: { label: 'Concluído', tone: 'success' },
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
  3: { label: 'Lançada no Fiscal', tone: 'teal' },
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
  1: { label: 'Concluído', tone: 'success' },
  2: { label: 'Expirado', tone: 'danger' },
};

// audit_log.actor_type
export const AUDIT_ACTOR_TYPE = {
  0: { label: 'Colaborador', tone: 'info' },
  1: { label: 'Fornecedor', tone: 'indigo' },
  2: { label: 'Sistema', tone: 'neutral' },
};

// audit_log.action (texto, não TINYINT)
export const AUDIT_ACTION = {
  'user.create': { label: 'Usuário criado', tone: 'success' },
  'user.update': { label: 'Usuário editado', tone: 'info' },
  'user.activate': { label: 'Usuário reativado', tone: 'success' },
  'user.inactivate': { label: 'Usuário inativado', tone: 'danger' },
  'user.password_reset': { label: 'Senha redefinida', tone: 'warning' },
  'document_type.create': { label: 'Tipo de documento criado', tone: 'success' },
  'document_type.update': { label: 'Tipo de documento editado', tone: 'info' },
  'document_type.activate': { label: 'Tipo de documento reativado', tone: 'success' },
  'document_type.inactivate': { label: 'Tipo de documento inativado', tone: 'danger' },
  'activity.create': { label: 'Atividade criada', tone: 'success' },
  'activity.update': { label: 'Atividade editada', tone: 'info' },
  'activity.activate': { label: 'Atividade reativada', tone: 'success' },
  'activity.inactivate': { label: 'Atividade inativada', tone: 'danger' },
  'document.download': { label: 'Documento baixado', tone: 'neutral' },
  'document.download_zip': { label: 'Documentos baixados (ZIP)', tone: 'neutral' },
};

/** Helper genérico: resolve { label, tone } de um enum, com fallback seguro. */
export function resolveEnum(enumMap, value) {
  return enumMap[value] ?? { label: 'Desconhecido', tone: 'neutral' };
}
