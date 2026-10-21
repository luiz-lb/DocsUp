import { AUDIT_ACTOR_TYPE, DEPARTMENT, DOCUMENT_CATEGORY, DOCUMENT_STATUS, EMPLOYEE_STATUS, RISK_LEVEL } from '../../constants/enums.js';

// Nome dos campos gravados em old_values / new_values
const FIELD_LABELS = {
  name: 'Nome',
  email: 'E-mail',
  department: 'Departamento',
  is_active: 'Ativo',
  sessions_ended: 'Sessões encerradas',
  description: 'Descrição',
  category: 'Categoria',
  has_expiration: 'Tem validade',
  validity_days: 'Prazo padrão (dias)',
  code: 'Código',
  risk_level: 'Risco',
  document_type_ids: 'Documentos sugeridos',
  file_name: 'Arquivo',
  document_type: 'Tipo de documento',
  supplier: 'Fornecedor',
  employee: 'Colaborador',
  document_ids: 'Documentos baixados',
  missing_document_ids: 'Não encontrados no servidor',
  zip_name: 'Arquivo ZIP',
  status: 'Status',
  observation: 'Observação',
  integration_at: 'Integração',
};

// Campos com lista de ids, mostrados como '#1, #2'
const ID_LIST_FIELDS = new Set(['document_type_ids', 'document_ids', 'missing_document_ids']);

// Campos sim/não: podem vir como boolean ou como 1/0 (BIT do banco)
const BOOLEAN_FIELDS = new Set(['is_active', 'has_expiration']);

/** Quem fez a ação: { title, subtitle }. */
export function describeActor(row) {
  if (row.actor_type === 2) return { title: AUDIT_ACTOR_TYPE[2].label, subtitle: null };
  if (row.actor_name) return { title: row.actor_name, subtitle: row.actor_email };
  const type = AUDIT_ACTOR_TYPE[row.actor_type]?.label ?? 'Desconhecido';
  return { title: row.actor_id ? `${type} #${row.actor_id}` : type, subtitle: null };
}

/** Sobre o que foi a ação: { title, subtitle }. */
export function describeTarget(row) {
  if (row.entity_type === 'user') {
    if (row.target_name) return { title: row.target_name, subtitle: row.target_email };
    return { title: `Usuário #${row.entity_id}`, subtitle: null };
  }
  if (row.entity_type === 'document_type') {
    return { title: row.target_name ?? `Tipo de documento #${row.entity_id}`, subtitle: 'Tipo de documento' };
  }
  if (row.entity_type === 'activity') {
    return { title: row.target_name ?? `Atividade #${row.entity_id}`, subtitle: 'Atividade' };
  }
  if (row.entity_type === 'employee') {
    return { title: row.target_name ?? `Colaborador #${row.entity_id}`, subtitle: 'Colaborador' };
  }
  if (row.entity_type === 'document') {
    // ZIP: um registro só, com a lista de documentos (sem entity_id)
    if (!row.entity_id) {
      const count = parseJson(row.new_values)?.document_ids?.length ?? 0;
      return { title: `${count} documento${count === 1 ? '' : 's'}`, subtitle: 'Download em ZIP' };
    }
    return { title: row.target_name ?? `Documento #${row.entity_id}`, subtitle: 'Documento' };
  }
  return { title: `${row.entity_type} #${row.entity_id ?? '-'}`, subtitle: null };
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatValue(field, value, entityType) {
  if (value === undefined || value === null) return '—';
  // status: situação do colaborador ou status do documento, conforme a entidade
  if (field === 'status' && entityType === 'employee') return EMPLOYEE_STATUS[value]?.label ?? String(value);
  // 'AAAA-MM-DDTHH:mm' (gravado sem fuso) → 'DD/MM/AAAA HH:mm'
  if (field === 'integration_at') return String(value).replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}).*$/, '$3/$2/$1 $4');
  if (field === 'department') return DEPARTMENT[value]?.label ?? String(value);
  if (field === 'category') return DOCUMENT_CATEGORY[value]?.label ?? String(value);
  if (field === 'status') return DOCUMENT_STATUS[value]?.label ?? String(value);
  if (field === 'risk_level') return RISK_LEVEL[value]?.label ?? String(value);
  if (ID_LIST_FIELDS.has(field) && Array.isArray(value)) {
    return value.length > 0 ? value.map((id) => `#${id}`).join(', ') : 'Nenhum';
  }
  if (BOOLEAN_FIELDS.has(field) && (value === 0 || value === 1)) return value ? 'Sim' : 'Não';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Linhas "campo / antes / depois" a partir de old_values e new_values (JSON).
 * Retorna [{ field, label, before, after }].
 */
export function buildChanges(row) {
  const before = parseJson(row.old_values) ?? {};
  const after = parseJson(row.new_values) ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return fields.map((field) => ({
    field,
    label: FIELD_LABELS[field] ?? field,
    before: field in before ? formatValue(field, before[field], row.entity_type) : '—',
    after: field in after ? formatValue(field, after[field], row.entity_type) : '—',
  }));
}
