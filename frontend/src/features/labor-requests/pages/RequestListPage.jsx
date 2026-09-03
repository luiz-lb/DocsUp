import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuPlus, LuSearch } from 'react-icons/lu';
import { PageHeader, DataTable, Pagination, StatusBadge, Button } from '../../../components/ui/index.js';
import { LABOR_REQUEST_STATUS, URGENCY } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import { formatDate } from '../../../utils/formatters.js';
import { findActivityType } from '../../../mocks/catalog.js';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { useLaborRequests } from '../hooks/useLaborRequests.js';
import styles from './RequestListPage.module.css';

const COLUMNS = [
  {
    key: 'title',
    header: 'Solicitacão',
    render: (row) => (
      <div>
        <strong>{row.title}</strong>
        <div className={styles.location}>{row.location}</div>
      </div>
    ),
  },
  { key: 'activity', header: 'Atividade', render: (row) => row.activity_name},
  { key: 'urgency', header: 'Urgencia', render: (row) => <StatusBadge enumMap={URGENCY} value={row.urgency} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={LABOR_REQUEST_STATUS} value={row.status} /> },
  { key: 'createdAt', header: 'Criada em', render: (row) => formatDate(row.created_at) },
];

export default function RequestListPage() {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [urgency, setUrgency] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const search = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    setPage(1);
  }, [search, status, urgency]);

  const { data: response, isLoading } = useLaborRequests({
    page,
    limit,
    search,
    status: status === '' ? undefined : Number(status),
    urgency: urgency === '' ? undefined : Number(urgency),
  });

  const requests = response?.body ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  return (
    <div>
      <PageHeader
        eyebrow="Suprimentos & RH"
        title="Solicitacoes de Serviço"
        description="Acompanhe pedidos abertos para obra, aprovacões de RH/Seguranca e status de cotacão."
        actions={
          <Button icon={LuPlus} onClick={() => navigate(ROUTES.laborRequests.new)}>
            Nova solicitacao
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <LuSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por titulo, local, solicitante ou atividade..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <div className={styles.filters}>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            {Object.entries(LABOR_REQUEST_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select value={urgency} onChange={(event) => setUrgency(event.target.value)} aria-label="Filtrar por urgencia">
            <option value="">Todas as urgencias</option>
            {Object.entries(URGENCY).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={requests ?? []}
        isLoading={isLoading}
        onRowClick={(row) => navigate(ROUTES.laborRequests.detail(row.id))}
        emptyTitle="Nenhuma solicitacão aberta"
        emptyDescription="Quando abrirem uma solicitacão, ela aparece aqui."
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
    </div>
  );
}
