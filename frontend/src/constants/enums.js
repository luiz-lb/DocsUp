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

// supplier_users.role: os dois usuários que entram no portal do fornecedor
export const SUPPLIER_USER_ROLE = {
  0: { label: 'Responsável', tone: 'indigo' },
  1: { label: 'Operador', tone: 'info' },
};

// Ids do SUPPLIER_USER_ROLE por nome (mesmos valores do backend)
export const SUPPLIER_USER_ROLE_ID = {
  RESPONSAVEL: 0,
  OPERADOR: 1,
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
  4: { label: 'Trabalhistas mensais', tone: 'teal' },
};

// Ids do DOCUMENT_CATEGORY por nome (mesmos valores do backend)
export const DOCUMENT_CATEGORY_ID = {
  EMPRESA: 0,
  BASICO: 1,
  NR: 2,
  OUTRO: 3,
  MENSAL: 4,
};

// Situação de um documento mensal esperado (calculada no backend)
export const MONTHLY_SITUATION = {
  pending: { label: 'A enviar', tone: 'info' },
  late: { label: 'Atrasado', tone: 'danger' },
  sent: { label: 'Enviado (em análise)', tone: 'warning' },
  approved: { label: 'Aprovado', tone: 'success' },
  returned: { label: 'Devolvido pelo RH', tone: 'danger' },
};

export const VALIDATION_METHOD = {
  0: { label: 'API Pública', tone: 'success' },
  1: { label: 'IA (N8N)', tone: 'indigo' },
  2: { label: 'Manual', tone: 'neutral' },
  3: { label: 'Híbrida', tone: 'warning' },
};

export const URGENCY = {
  0: { label: 'Baixa', tone: 'neutral' },
  1: { label: 'Normal', tone: 'info' },
  2: { label: 'Alta', tone: 'warning' },
  3: { label: 'Urgente', tone: 'danger' },
};

// labor_requests.status. 1 não é mais usado; 4 = fornecedor declarou não ter documento da empresa.
export const LABOR_REQUEST_STATUS = {
  0: { label: 'Pendente de Aprovação', tone: 'warning' },
  1: { label: 'Aprovado RH', tone: 'info' },
  2: { label: 'Reprovado', tone: 'danger' },
  3: { label: 'Aguardando fornecedor', tone: 'indigo' },
  4: { label: 'Bloqueada (fornecedor sem documento)', tone: 'danger' },
  5: { label: 'Em Contratação', tone: 'teal' },
  6: { label: 'Concluído', tone: 'success' },
  7: { label: 'Cancelado', tone: 'danger' },
};

// Ids do LABOR_REQUEST_STATUS por nome (mesmos valores do backend)
export const LABOR_REQUEST_STATUS_ID = {
  PENDENTE: 0,
  REPROVADA: 2,
  AGUARDANDO_FORNECEDOR: 3,
  BLOQUEADA: 4,
  EM_CONTRATACAO: 5,
  CONCLUIDA: 6,
  CANCELADA: 7,
};

// labor_request_suppliers.status: o fornecedor indicado na solicitação
export const ASSIGNMENT_STATUS = {
  0: { label: 'Aguardando o fornecedor', tone: 'warning' },
  1: { label: 'Enviando documentos', tone: 'success' },
  2: { label: 'Bloqueado: falta documento da empresa', tone: 'danger' },
  3: { label: 'Encerrado', tone: 'neutral' },
};

export const ASSIGNMENT_STATUS_ID = {
  AGUARDANDO: 0,
  ATIVO: 1,
  BLOQUEADO: 2,
  ENCERRADO: 3,
};

// labor_request_suppliers.end_reason
export const ASSIGNMENT_END_REASON = {
  0: { label: 'Convite reenviado', tone: 'neutral' },
  1: { label: 'Fornecedor trocado', tone: 'warning' },
};

export const APPROVAL_DECISION = {
  0: { label: 'Pendente', tone: 'warning' },
  1: { label: 'Reprovado', tone: 'danger' },
  2: { label: 'Aprovado', tone: 'success' },
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

// employees.status: situação do colaborador (Fase 8). 4 e 6 vêm da rotina diária (00:01).
export const EMPLOYEE_STATUS = {
  0: { label: 'Pendente de documentos', tone: 'warning' },
  1: { label: 'Documentação OK', tone: 'info' },
  2: { label: 'Integração agendada', tone: 'indigo' },
  3: { label: 'Liberado', tone: 'success' },
  4: { label: 'Documento a vencer', tone: 'warning' },
  5: { label: 'Desligado', tone: 'neutral' },
  6: { label: 'Retido por pendência', tone: 'danger' },
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
  'document.status_change': { label: 'Status de documento alterado', tone: 'info' },
  'document.expired': { label: 'Documento vencido (rotina diária)', tone: 'danger' },
  'employee.status_change': { label: 'Situação do colaborador alterada', tone: 'info' },
  'supplier_user.create': { label: 'Usuário do fornecedor cadastrado', tone: 'success' },
  'supplier_user.update': { label: 'Usuário do fornecedor editado', tone: 'info' },
  'supplier_user.password_change': { label: 'Senha do fornecedor alterada', tone: 'warning' },
  'supplier_assignment.create': { label: 'Fornecedor indicado', tone: 'success' },
  'supplier_assignment.resend': { label: 'Convite do fornecedor reenviado', tone: 'info' },
  'supplier_assignment.deadline_change': { label: 'Prazo dos documentos alterado', tone: 'info' },
  'supplier_assignment.replace': { label: 'Fornecedor trocado', tone: 'warning' },
  'supplier_assignment.declare': { label: 'Declaração do fornecedor assinada', tone: 'info' },
  'labor_request.conclude': { label: 'Contrato concluído', tone: 'success' },
};

/** Helper genérico: resolve { label, tone } de um enum, com fallback seguro. */
export function resolveEnum(enumMap, value) {
  return enumMap[value] ?? { label: 'Desconhecido', tone: 'neutral' };
}
