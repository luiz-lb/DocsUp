import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuPlus, LuSearch } from 'react-icons/lu';
import { PageHeader, DataTable, Pagination, StatusBadge, Button } from '../../../components/ui/index.js';
import { LABOR_REQUEST_STATUS, URGENCY } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import { formatDate } from '../../../utils/formatters.js';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { useLaborRequests } from '../hooks/useLaborRequests.js';
import styles from './RequestListPage.module.css';

// Filtro combinado usado no atalho do painel "Solicitações em aberto":
// Em Cotação (3) + Em Contratação (5).
const EM_ANDAMENTO_STATUS = '3,5';

const COLUMNS = [
  {
    key: 'title',
    header: 'Solicitação',
    render: (row) => (
      <div>
        <strong>{row.title}</strong>
        <div className={styles.location}>{row.location}</div>
      </div>
    ),
  },
  { key: 'activity', header: 'Atividade', render: (row) => row.activity_name},
  { key: 'urgency', header: 'Urgência', render: (row) => <StatusBadge enumMap={URGENCY} value={row.urgency} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={LABOR_REQUEST_STATUS} value={row.status} /> },
  { key: 'createdAt', header: 'Criada em', render: (row) => formatDate(row.created_at) },
];

export default function RequestListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Permite deep-link com filtro de status já aplicado (ex.: ?status=0 vindo do painel)
  const initialStatus = searchParams.get('status') ?? '';

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState(initialStatus);
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
    // status pode ser "" (todos), um único valor ("0") ou combinado ("3,5")
    status: status === '' ? undefined : status,
    urgency: urgency === '' ? undefined : Number(urgency),
  });

  const requests = response?.body ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  return (
    <div>
      <PageHeader
        eyebrow="Suprimentos & RH"
        title="Solicitações de Serviço"
        description="Acompanhe pedidos abertos para obra, aprovações de RH/Segurança e status de cotação."
        actions={
          <Button icon={LuPlus} onClick={() => navigate(ROUTES.laborRequests.new)}>
            Nova solicitação
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <LuSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por título, local, solicitante ou atividade..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <div className={styles.filters}>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value={EM_ANDAMENTO_STATUS}>Em cotação / Em contratação</option>
            {Object.entries(LABOR_REQUEST_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select value={urgency} onChange={(event) => setUrgency(event.target.value)} aria-label="Filtrar por urgência">
            <option value="">Todas as urgências</option>
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
        emptyTitle="Nenhuma solicitação aberta"
        emptyDescription="Quando abrirem uma solicitação, ela aparece aqui."
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
