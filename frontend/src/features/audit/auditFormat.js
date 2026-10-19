import { AUDIT_ACTOR_TYPE, DEPARTMENT } from '../../constants/enums.js';

// Nome dos campos gravados em old_values / new_values
const FIELD_LABELS = {
  name: 'Nome',
  email: 'E-mail',
  department: 'Departamento',
  is_active: 'Ativo',
  sessions_ended: 'Sessões encerradas',
};

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

function formatValue(field, value) {
  if (value === undefined || value === null) return '—';
  if (field === 'department') return DEPARTMENT[value]?.label ?? String(value);
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
    before: field in before ? formatValue(field, before[field]) : '—',
    after: field in after ? formatValue(field, after[field]) : '—',
  }));
}
