import { useNavigate } from 'react-router-dom';
import { LuFilePen, LuFolderOpen } from 'react-icons/lu';
import { Button, Banner, EmptyState, StatusBadge } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { formatDateTime } from '../../../utils/formatters.js';
import { cn } from '../../../utils/cn.js';
import { ROUTES } from '../../../constants/routes.js';
import { ASSIGNMENT_STATUS_ID } from '../../../constants/enums.js';
import { listMyPhase2Requests } from '../../employees/api/employeesApi.js';
import SupplierLayout from '../components/SupplierLayout/index.js';
import SupplierPageHeader from '../components/SupplierPageHeader/index.js';
import styles from './SupplierPortalPage.module.css';

/** O que o fornecedor precisa fazer primeiro neste contrato. */
function contractSituation(row) {
  if (row.status === ASSIGNMENT_STATUS_ID.AGUARDANDO) return { label: 'Preencher a declaração', tone: 'warning' };
  if (row.status === ASSIGNMENT_STATUS_ID.BLOQUEADO) return { label: 'Convite pausado', tone: 'danger' };
  if (row.documentsReturned > 0) return { label: 'Reenviar documentos', tone: 'danger' };
  if (row.documentsExpired > 0) return { label: 'Documento vencido', tone: 'danger' };
  if (row.documentsTotal === 0) {
    return row.isExpired ? { label: 'Prazo encerrado', tone: 'danger' } : { label: 'Nada enviado ainda', tone: 'warning' };
  }
  if (row.documentsPending > 0) return { label: 'Em análise', tone: 'info' };
  return { label: 'Documentos aprovados', tone: 'success' };
}

/** '3 colaboradores · 8 documentos · 2 para reenviar' */
function contractSummary(row) {
  if (row.status !== ASSIGNMENT_STATUS_ID.ATIVO) return null;
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const parts = [plural(row.employees, 'colaborador', 'colaboradores'), plural(row.documentsTotal, 'documento', 'documentos')];
  if (row.documentsReturned) parts.push(`${row.documentsReturned} para reenviar`);
  if (row.documentsExpired) parts.push(plural(row.documentsExpired, 'vencido', 'vencidos'));
  return parts.join(' · ');
}

/**
 * Portal do fornecedor — "Meus contratos": as solicitações em que a empresa foi indicada por
 * Compras. Cada uma abre a tela do contrato: primeiro a declaração e o termo; depois o envio
 * dos documentos da empresa e dos colaboradores.
 */
export default function SupplierPortalPage() {
  const navigate = useNavigate();
  const { data: response, isLoading } = useAsyncData(listMyPhase2Requests, []);
  const contracts = response?.body ?? [];
  const loadError = response && !response.success ? response.message : null;

  const toDeclare = contracts.filter((row) => row.status === ASSIGNMENT_STATUS_ID.AGUARDANDO).length;
  const toResend = contracts.filter((row) => row.documentsReturned > 0).length;

  return (
    <SupplierLayout>
      <SupplierPageHeader
        title="Meus contratos"
        subtitle="Solicitações em que a sua empresa foi indicada. Declare o que a empresa tem, assine o termo e envie a documentação."
      />

      {loadError && <Banner tone="danger" description={loadError} />}
      {toDeclare > 0 && (
        <Banner
          tone="warning"
          title={`${toDeclare} ${toDeclare === 1 ? 'contrato aguardando' : 'contratos aguardando'} a sua declaração`}
          description="Abra o contrato, informe quais documentos a empresa tem e assine o termo para liberar o envio."
        />
      )}
      {toResend > 0 && (
        <Banner
          tone="warning"
          title={`${toResend} ${toResend === 1 ? 'contrato' : 'contratos'} com documentos para reenviar`}
          description="O RH reprovou ou pediu o reenvio de documentos. Abra o contrato para ver o motivo."
        />
      )}

      {isLoading ? (
        <p className={styles.loading}>Carregando contratos…</p>
      ) : contracts.length === 0 ? (
        <EmptyState
          title="Nenhum contrato por enquanto"
          description="Quando o setor de Compras indicar a sua empresa em uma solicitação, ela aparece aqui."
        />
      ) : (
        <div className={styles.sectionBody}>
          {contracts.map((row) => {
            const situation = contractSituation(row);
            const summaryText = contractSummary(row);
            const isWaiting = row.status === ASSIGNMENT_STATUS_ID.AGUARDANDO;
            return (
              <div
                key={row.token}
                className={cn(styles.item, row.isExpired && row.status === ASSIGNMENT_STATUS_ID.ATIVO && row.documentsReturned === 0 && styles.itemExpired)}
              >
                <div className={styles.itemInfo}>
                  <span className={styles.itemTitle}>{row.laborRequestTitle}</span>
                  <span className={styles.itemMeta}>
                    {row.contractNumber ? `Contrato ${row.contractNumber} · ` : ''}
                    {row.laborRequestLocation ?? '—'}
                  </span>
                  <span className={styles.itemMeta}>
                    {row.status === ASSIGNMENT_STATUS_ID.BLOQUEADO
                      ? 'Aguarde o contato do setor de Compras.'
                      : row.isExpired
                        ? 'Prazo dos documentos encerrado'
                        : `Prazo dos documentos até ${formatDateTime(row.deadlineAt)}`}
                  </span>
                  {summaryText && <span className={styles.itemMeta}>{summaryText}</span>}
                </div>
                <StatusBadge label={situation.label} tone={situation.tone} />
                <Button
                  size="sm"
                  icon={isWaiting ? LuFilePen : LuFolderOpen}
                  onClick={() => navigate(ROUTES.employees.phase2(row.token))}
                >
                  {isWaiting ? 'Declarar' : 'Abrir'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </SupplierLayout>
  );
}
