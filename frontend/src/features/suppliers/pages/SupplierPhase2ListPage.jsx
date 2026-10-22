import { useNavigate } from 'react-router-dom';
import { LuFolderOpen } from 'react-icons/lu';
import { Button, Banner, EmptyState, StatusBadge } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { formatDateTime } from '../../../utils/formatters.js';
import { cn } from '../../../utils/cn.js';
import { ROUTES } from '../../../constants/routes.js';
import { listMyPhase2Requests } from '../../employees/api/employeesApi.js';
import SupplierLayout from '../components/SupplierLayout/index.js';
import SupplierPageHeader from '../components/SupplierPageHeader/index.js';
import styles from './SupplierPortalPage.module.css';

/** Situação resumida da solicitação: o que o fornecedor precisa fazer primeiro. */
function requestSituation(row) {
  if (row.documents_returned > 0) return { label: 'Reenviar documentos', tone: 'danger' };
  if (row.documents_expired > 0) return { label: 'Documento vencido', tone: 'danger' };
  if (row.documents_total === 0) return { label: 'Nada enviado ainda', tone: 'warning' };
  if (row.documents_pending > 0) return { label: 'Em análise', tone: 'info' };
  return { label: 'Documentos aprovados', tone: 'success' };
}

/** '3 colaboradores · 8 documentos · 2 para reenviar' */
function requestSummary(row) {
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const parts = [plural(row.employees, 'colaborador', 'colaboradores'), plural(row.documents_total, 'documento', 'documentos')];
  if (row.documents_returned) parts.push(`${row.documents_returned} para reenviar`);
  if (row.documents_expired) parts.push(plural(row.documents_expired, 'vencido', 'vencidos'));
  return parts.join(' · ');
}

/**
 * Portal do fornecedor — "Documentos (Fase 2)": as solicitações em que ele precisa enviar ou
 * reenviar documentos, com o prazo e o resumo. Cada uma abre a tela da Fase 2.
 */
export default function SupplierPhase2ListPage() {
  const navigate = useNavigate();
  const { data: response, isLoading } = useAsyncData(listMyPhase2Requests, []);
  const requests = response?.body ?? [];
  const loadError = response && !response.success ? response.message : null;
  const toResend = requests.filter((row) => row.documents_returned > 0).length;

  return (
    <SupplierLayout>
      <SupplierPageHeader
        title="Documentos (Fase 2)"
        subtitle="Solicitações em que você envia a documentação da empresa e dos colaboradores."
      />

      {loadError && <Banner tone="danger" description={loadError} />}
      {toResend > 0 && (
        <Banner
          tone="warning"
          title={`${toResend} ${toResend === 1 ? 'solicitação' : 'solicitações'} com documentos para reenviar`}
          description="O RH reprovou ou pediu o reenvio de documentos. Abra a solicitação para ver o motivo."
        />
      )}

      {isLoading ? (
        <p className={styles.loading}>Carregando solicitações…</p>
      ) : requests.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação na Fase 2"
          description="Quando você vencer uma cotação, a solicitação aparece aqui para o envio dos documentos."
        />
      ) : (
        <div className={styles.sectionBody}>
          {requests.map((row) => {
            const situation = requestSituation(row);
            return (
              <div key={row.link_token} className={cn(styles.item, row.isExpired && row.documents_returned === 0 && styles.itemExpired)}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{row.labor_request_title}</span>
                  <span className={styles.itemMeta}>
                    {row.labor_request_location ?? '—'} ·{' '}
                    {row.isExpired ? 'Prazo encerrado' : `Prazo até ${formatDateTime(row.expires_at)}`}
                  </span>
                  <span className={styles.itemMeta}>{requestSummary(row)}</span>
                </div>
                <StatusBadge label={situation.label} tone={situation.tone} />
                <Button size="sm" icon={LuFolderOpen} onClick={() => navigate(ROUTES.employees.phase2(row.link_token))}>
                  Abrir
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </SupplierLayout>
  );
}
