import { useEffect, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { PageHeader, DataTable, Pagination, StatusBadge, Banner } from '../../../components/ui/index.js';
import { AUDIT_ACTION } from '../../../constants/enums.js';
import { formatDateTime } from '../../../utils/formatters.js';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { useAuditLogs } from '../hooks/useAuditLogs.js';
import { describeActor, describeTarget } from '../auditFormat.js';
import AuditDetailModal from '../components/AuditDetailModal/index.js';
import styles from './AuditLogPage.module.css';

function TwoLines({ title, subtitle }) {
  return (
    <div>
      <strong>{title}</strong>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}

const COLUMNS = [
  { key: 'createdAt', header: 'Quando', render: (row) => formatDateTime(row.created_at) },
  { key: 'actor', header: 'Quem fez', render: (row) => <TwoLines {...describeActor(row)} /> },
  { key: 'action', header: 'Ação', render: (row) => <StatusBadge enumMap={AUDIT_ACTION} value={row.action} /> },
  { key: 'target', header: 'Alvo', render: (row) => <TwoLines {...describeTarget(row)} /> },
  { key: 'ip', header: 'IP', render: (row) => row.ip_address ?? '—' },
];

export default function AuditLogPage() {
  const [searchInput, setSearchInput] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState(null);

  const search = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    setPage(1);
  }, [search, action, from, to]);

  const { data: response, isLoading } = useAuditLogs({
    page,
    limit,
    search,
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const entries = response?.body ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };
  const loadError = response && !response.success ? response.message : null;

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Auditoria"
        description="Registro das ações administrativas: quem fez, o quê, quando e de onde. Clique numa linha para ver o antes e depois."
      />

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <LuSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail de quem fez ou do alvo..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <div className={styles.filters}>
          <select value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filtrar por ação">
            <option value="">Todas as ações</option>
            {Object.entries(AUDIT_ACTION).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className={styles.dateFilter}>
            De
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className={styles.dateFilter}>
            Até
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>

      {loadError && <Banner tone="danger" description={loadError} />}

      <DataTable
        columns={COLUMNS}
        rows={entries}
        isLoading={isLoading}
        onRowClick={setSelected}
        emptyTitle="Nenhum registro de auditoria"
        emptyDescription="As ações feitas na tela de Usuários aparecem aqui."
      />

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      <AuditDetailModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
