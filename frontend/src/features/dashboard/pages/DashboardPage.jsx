import { useNavigate } from 'react-router-dom';
import {
  LuClipboardList,
  LuFolderCheck,
  LuTruck,
  LuTriangleAlert,
  LuGavel,
  LuArrowRight,
} from 'react-icons/lu';
import { Card, PageHeader, StatusBadge, EmptyState } from '../../../components/ui/index.js';
import {
  LABOR_REQUEST_STATUS,
  URGENCY,
  DOCUMENT_STATUS,
} from '../../../constants/enums.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { formatDate } from '../../../utils/formatters.js';
import { useDashboardSummary } from '../hooks/useDashboardSummary.js';
import styles from './DashboardPage.module.css';

// Departamento responsável pela aprovação (Segurança do Trabalho)
const SEGURANCA_DEPARTMENT = 1;
const PENDING_APPROVAL_STATUS = 0;
const EM_COTACAO_STATUS = 3;
// Filtro combinado: Em Cotação (3) + Em Contratação (5)
const EM_ANDAMENTO_STATUS = '3,5';

export default function DashboardPage() {
  const { user, departmentLabel } = useAuth();
  const { data, isLoading } = useDashboardSummary();
  const navigate = useNavigate();

  if (isLoading || !data) return null;

  const isSeguranca = user.department === SEGURANCA_DEPARTMENT;

  const listWithStatus = (status) => `${ROUTES.laborRequests.list}?status=${status}`;

  const metrics = [
    {
      key: 'requests',
      icon: LuClipboardList,
      // "Em andamento": solicitações em cotação + em contratação
      label: 'Em cotação / contratação',
      value: data.emCotacao.length + data.emContratacao.length,
      to: listWithStatus(EM_ANDAMENTO_STATUS),
      tone: 'indigo',
    },
    {
      key: 'approvals',
      icon: LuTriangleAlert,
      label: isSeguranca ? 'Aguardando sua aprovação' : 'Aguardando aprovação de Segurança do Trabalho',
      value: data.pendingApprovals.length,
      to: listWithStatus(PENDING_APPROVAL_STATUS),
      tone: 'warning',
    },
    {
      key: 'quotation',
      icon: LuGavel,
      label: 'Em cotação',
      value: data.emCotacao.length,
      to: listWithStatus(EM_COTACAO_STATUS),
      tone: 'info',
    },
    {
      key: 'docs',
      icon: LuFolderCheck,
      label: 'Documentos aguardando análise',
      value: data.docsNeedingAttention,
      to: ROUTES.documents.supplierDocs,
      tone: 'danger',
    },
    {
      key: 'suppliers',
      icon: LuTruck,
      label: 'Fornecedores ativos',
      value: data.activeSuppliers,
      to: ROUTES.suppliers.list,
      tone: 'teal',
    },
  ];

  // Séries de distribuição (status e urgência) resolvidas com labels/tons dos enums
  const statusSeries = buildSeries(data.statusDistribution, LABOR_REQUEST_STATUS);
  const urgencySeries = buildSeries(data.urgencyDistribution, URGENCY);
  const docSeries = buildSeries(data.docStatusDistribution, DOCUMENT_STATUS);

  return (
    <div>
      <PageHeader
        eyebrow={`Ola, ${user.name}`}
        title="Painel"
        description={`Visão geral do fluxo de contratação de mão de obra para o departamento de ${departmentLabel}.`}
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

      <div className={styles.chartsGrid}>
        {/* Distribuição de solicitações por status */}
        <Card>
          <Card.Body>
            <h3 className={styles.cardTitle}>Solicitações por status</h3>
            {statusSeries.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhuma solicitação cadastrada.</p>
            ) : (
              <DistributionList series={statusSeries} />
            )}
          </Card.Body>
        </Card>

        {/* Distribuição por urgência */}
        <Card>
          <Card.Body>
            <h3 className={styles.cardTitle}>Solicitações por urgência</h3>
            {urgencySeries.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhuma solicitação cadastrada.</p>
            ) : (
              <DistributionList series={urgencySeries} />
            )}
          </Card.Body>
        </Card>
      </div>

      <div className={styles.chartsGrid}>
        {/* Documentos por status */}
        <Card>
          <Card.Body>
            <h3 className={styles.cardTitle}>
              Documentos dos fornecedores
              <span className={styles.cardSub}>{data.totalDocuments} no total</span>
            </h3>
            {docSeries.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhum documento entregue ainda.</p>
            ) : (
              <DistributionList series={docSeries} />
            )}
          </Card.Body>
        </Card>

        {/* Solicitações recentes */}
        <Card>
          <Card.Body>
            <h3 className={styles.cardTitle}>Solicitações recentes</h3>
            {data.recentRequests.length === 0 ? (
              <EmptyState title="Nenhuma solicitação" description="As solicitações mais recentes aparecerão aqui." />
            ) : (
              <ul className={styles.recentList}>
                {data.recentRequests.map((req) => (
                  <li key={req.id}>
                    <button
                      type="button"
                      className={styles.recentItem}
                      onClick={() => navigate(ROUTES.laborRequests.detail(req.id))}
                    >
                      <div className={styles.recentInfo}>
                        <span className={styles.recentTitle}>{req.title}</span>
                        <span className={styles.recentMeta}>
                          {req.activity_name ?? '—'} · {formatDate(req.created_at)}
                        </span>
                      </div>
                      <StatusBadge enumMap={LABOR_REQUEST_STATUS} value={req.status} />
                      <LuArrowRight className={styles.recentArrow} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
/**
 * Constrói a série de distribuição a partir de um mapa { value: count } e um
 * enumMap { value: { label, tone } }. Ordena por contagem desc.
 */
function buildSeries(distribution, enumMap) {
  return Object.entries(distribution ?? {})
    .map(([value, count]) => ({
      value,
      count,
      label: enumMap[value]?.label ?? `#${value}`,
      tone: enumMap[value]?.tone ?? 'neutral',
    }))
    .sort((a, b) => b.count - a.count);
}

/** Lista de barras horizontais proporcionais (sem dependência externa). */
function DistributionList({ series }) {
  const max = Math.max(...series.map((s) => s.count), 1);
  return (
    <div className={styles.dist}>
      {series.map((s) => (
        <div key={s.value} className={styles.distRow}>
          <span className={styles.distLabel}>{s.label}</span>
          <div className={styles.distTrack}>
            <div
              className={styles.distFill}
              data-tone={s.tone}
              style={{ width: `${Math.max((s.count / max) * 100, 4)}%` }}
            />
          </div>
          <span className={styles.distValue}>{s.count}</span>
        </div>
      ))}
    </div>
  );
}
