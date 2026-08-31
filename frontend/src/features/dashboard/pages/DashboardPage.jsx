import { useNavigate } from 'react-router-dom';
import {
  LuClipboardList,
  LuFolderCheck,
  LuUsers,
  LuTriangleAlert,
  LuArrowRight,
} from 'react-icons/lu';
import { Card, PageHeader, Button, CountdownTimer } from '../../../components/ui/index.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { useDashboardSummary } from '../hooks/useDashboardSummary.js';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user, departmentLabel } = useAuth();
  const { data, isLoading } = useDashboardSummary(user.department);
  const navigate = useNavigate();

  if (isLoading || !data) return null;

  const metrics = [
    {
      key: 'requests',
      icon: LuClipboardList,
      label: 'Solicitacoes em aberto',
      value: data.openLaborRequests.length,
      to: ROUTES.laborRequests.list,
      tone: 'indigo',
    },
    {
      key: 'approvals',
      icon: LuTriangleAlert,
      label: 'Aguardando sua aprovacao',
      value: data.pendingApprovals.length,
      to: ROUTES.laborRequests.list,
      tone: 'warning',
    },
    {
      key: 'review',
      icon: LuFolderCheck,
      label: 'Documentos em revisao manual',
      value: data.reviewQueueCount,
      to: ROUTES.documents.review,
      tone: 'info',
    },
    {
      key: 'blocks',
      icon: LuUsers,
      label: 'Pagamentos travados',
      value: data.activePaymentBlocks.length,
      to: ROUTES.purchaseOrders.payments,
      tone: 'danger',
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Ola, ${user.name}`}
        title="Painel"
        description={`Visao geral do fluxo de contratacao de mao de obra para o departamento de ${departmentLabel}.`}
      />

      <div className={styles.metricGrid}>
        {metrics.map(({ key, icon: Icon, label, value, to, tone }) => (
          <button key={key} type="button" className={styles.metricCard} onClick={() => navigate(to)}>
            <Icon className={styles.metricIcon} data-tone={tone} />
            <span className={styles.metricValue}>{value}</span>
            <span className={styles.metricLabel}>{label}</span>
          </button>
        ))}
      </div>

      <Card>
        <Card.Body className={styles.phase2Row}>
          <div>
            <p className={styles.phase2Title}>Fase 2 em andamento</p>
            <p className={styles.phase2Subtitle}>{data.phase2.laborRequestTitle} — {data.phase2.supplierName}</p>
          </div>
          <CountdownTimer deadline={data.phase2.expiresAt} startedAt={data.phase2.startedAt} />
          <Button variant="ghost" icon={LuArrowRight} iconPosition="right" onClick={() => navigate(ROUTES.employees.list)}>
            Ver colaboradores
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
}
