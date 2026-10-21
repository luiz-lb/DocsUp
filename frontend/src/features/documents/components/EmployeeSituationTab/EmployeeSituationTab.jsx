import { useMemo, useState } from 'react';
import { LuPencil, LuSearch } from 'react-icons/lu';
import { DataTable, StatusBadge, Button, Banner, FormField, SearchSelect } from '../../../../components/ui/index.js';
import { EMPLOYEE_STATUS } from '../../../../constants/enums.js';
import { useAsyncData } from '../../../../hooks/useAsyncData.js';
import { formatDateOnly, formatDateTime } from '../../../../utils/formatters.js';
import { listEmployeeSituations } from '../../api/documentsRealApi.js';
import EmployeeSituationModal from '../EmployeeSituationModal/index.js';
import { EMPTY_EMPLOYEE_FILTERS } from './employeeFilters.js';
import styles from './EmployeeSituationTab.module.css';

// Integração agendada e Retido por pendência mostram um detalhe embaixo da etiqueta
const INTEGRATION_SCHEDULED = 2;
const RETAINED = 6;


/** Texto sem acentos e em minúsculas, para a busca. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Resumo dos documentos atuais do colaborador: '5 enviados · 3 aprovados · 1 devolvido · 1 vencido'. */
function documentsSummary(row) {
  if (!row.documents_total) return 'Nenhum documento enviado';
  const parts = [`${row.documents_total} enviado${row.documents_total === 1 ? '' : 's'}`];
  if (row.documents_approved) parts.push(`${row.documents_approved} aprovado${row.documents_approved === 1 ? '' : 's'}`);
  if (row.documents_pending) parts.push(`${row.documents_pending} em análise`);
  if (row.documents_returned) parts.push(`${row.documents_returned} devolvido${row.documents_returned === 1 ? '' : 's'}`);
  if (row.documents_expired) parts.push(`${row.documents_expired} vencido${row.documents_expired === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/**
 * Aba Colaboradores de Docs de Fornecedores: situação de cada colaborador (Pendente de
 * documentos → Documentação OK → Integração agendada → Liberado), com o resumo dos documentos.
 * RH e Segurança mudam a situação; "a vencer" e "retido" também vêm da rotina diária.
 *
 * Os filtros ficam na página (props), para continuarem valendo ao trocar de aba; saindo da
 * tela, eles voltam ao padrão. A lista vem inteira e é filtrada aqui.
 *
 * Props:
 *  - filters         : { search, status, supplierId }
 *  - onFiltersChange : (filters) => void
 */
export default function EmployeeSituationTab({ filters = EMPTY_EMPLOYEE_FILTERS, onFiltersChange }) {
  const { data: response, isLoading, reload } = useAsyncData(() => listEmployeeSituations(), []);
  const allEmployees = useMemo(() => response?.body ?? [], [response]);
  const loadError = response && !response.success ? response.message : null;

  const [target, setTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const setFilter = (field) => (event) => onFiltersChange({ ...filters, [field]: event.target.value });

  // Fornecedores da lista, para o filtro com busca
  const supplierOptions = useMemo(() => {
    const byId = new Map(allEmployees.map((row) => [String(row.supplier_id), row.supplier_name]));
    return [...byId.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'))
      .map(([value, label]) => ({ value, label }));
  }, [allEmployees]);

  const employees = useMemo(() => {
    const term = normalize(filters.search.trim());
    return allEmployees.filter((row) => {
      if (filters.supplierId !== '' && String(row.supplier_id) !== filters.supplierId) return false;
      if (filters.status !== '' && String(row.status) !== filters.status) return false;
      if (term && !normalize(`${row.full_name} ${row.cpf ?? ''} ${row.supplier_name}`).includes(term)) return false;
      return true;
    });
  }, [allEmployees, filters]);

  const hasFilters = filters.search !== '' || filters.status !== '' || filters.supplierId !== '';

  const handleSuccess = (employee, message) => {
    setTarget(null);
    setFeedback({
      tone: 'success',
      message: message === 'Nenhuma alteração para salvar.' ? message : `Situação de ${employee.full_name} atualizada.`,
    });
    reload();
  };

  const columns = [
    {
      key: 'employee',
      header: 'Colaborador',
      render: (row) => (
        <div className={styles.cell}>
          <strong>{row.full_name}</strong>
          <span className={styles.meta}>
            {row.cpf ?? 'Sem CPF'}
            {row.role_function ? ` · ${row.role_function}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'origin',
      header: 'Fornecedor · Solicitação',
      render: (row) => (
        <div className={styles.cell}>
          <span>{row.supplier_name}</span>
          <span className={styles.meta}>{row.labor_request_title ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'documents',
      header: 'Documentos',
      render: (row) => (
        <div className={styles.cell}>
          <span>{documentsSummary(row)}</span>
          {row.next_expiry && <span className={styles.meta}>Próximo vencimento: {formatDateOnly(row.next_expiry)}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      render: (row) => (
        <div className={styles.statusCell}>
          <StatusBadge enumMap={EMPLOYEE_STATUS} value={row.status} />
          {row.status === INTEGRATION_SCHEDULED && row.integration_at && (
            <span className={styles.meta}>Integração: {formatDateTime(row.integration_at)}</span>
          )}
          {row.status === RETAINED && row.retained_by && (
            <span className={styles.retained}>Pendência: {row.retained_by}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="ghost" icon={LuPencil} onClick={() => setTarget(row)}>
          Alterar situação
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <LuSearch className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou fornecedor..."
            value={filters.search}
            onChange={setFilter('search')}
          />
        </label>
        {/* Fornecedor: com busca (SearchSelect usa o estilo de campo do FormField); o X limpa */}
        <FormField className={styles.supplierField}>
          <SearchSelect
            options={supplierOptions}
            value={filters.supplierId}
            onChange={(supplierId) => onFiltersChange({ ...filters, supplierId })}
            placeholder="Todos os fornecedores"
            emptyMessage="Nenhum fornecedor encontrado."
          />
        </FormField>
        <select className={styles.filter} value={filters.status} onChange={setFilter('status')} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          {Object.entries(EMPLOYEE_STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={() => onFiltersChange(EMPTY_EMPLOYEE_FILTERS)}>
            Limpar filtros
          </Button>
        )}
      </div>

      {loadError && <Banner tone="danger" description={loadError} />}
      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      <DataTable
        columns={columns}
        rows={employees}
        isLoading={isLoading}
        emptyTitle="Nenhum colaborador encontrado"
        emptyDescription={hasFilters ? 'Ajuste a busca ou os filtros.' : 'Ainda não há colaboradores enviados pelos fornecedores.'}
        stackOnMobile
      />

      <EmployeeSituationModal
        open={Boolean(target)}
        employee={target}
        onClose={() => setTarget(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
