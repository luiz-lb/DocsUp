import { useNavigate } from 'react-router-dom';
import { LuPlus } from 'react-icons/lu';
import { PageHeader, DataTable, StatusBadge, Button } from '../../../components/ui/index.js';
import { LABOR_REQUEST_STATUS, URGENCY } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import { formatDate } from '../../../utils/formatters.js';
import { findActivityType } from '../../../mocks/catalog.js';
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
  { key: 'activity', header: 'Atividade', render: (row) => findActivityType(row.activity_type_id)?.name },
  { key: 'urgency', header: 'Urgencia', render: (row) => <StatusBadge enumMap={URGENCY} value={row.urgency} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={LABOR_REQUEST_STATUS} value={row.status} /> },
  { key: 'createdAt', header: 'Criada em', render: (row) => formatDate(row.created_at) },
];

export default function RequestListPage() {
  const { data: response, isLoading } = useLaborRequests();
  const navigate = useNavigate();

  const requests = response?.body ?? [];

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

      <DataTable
        columns={COLUMNS}
        rows={requests ?? []}
        isLoading={isLoading}
        onRowClick={(row) => navigate(ROUTES.laborRequests.detail(row.id))}
        emptyTitle="Nenhuma solicitacão aberta"
        emptyDescription="Quando abrirem uma solicitacão, ela aparece aqui."
      />
    </div>
  );
}
