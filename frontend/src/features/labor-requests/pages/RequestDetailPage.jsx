import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuCircleCheckBig, LuFileText, LuShieldCheck } from 'react-icons/lu';
import {
  Card,
  PageHeader,
  StatusBadge,
  EmptyState,
  Banner,
  Button,
  ConfirmDialog,
} from '../../../components/ui/index.js';
import { ACCESS, canAccess } from '../../../constants/access.js';
import { concludeLaborRequest } from '../api/laborRequestsApi.js';
import {
  LABOR_REQUEST_STATUS,
  LABOR_REQUEST_STATUS_ID,
  CONCLUDABLE_STATUS_IDS,
  URGENCY,
  DOCUMENT_CATEGORY,
  DOCUMENT_CATEGORY_ID,
} from '../../../constants/enums.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useLaborRequest, useLaborRequestApprovals } from '../hooks/useLaborRequests.js';
import { formatDate, formatDateTime } from '../../../utils/formatters.js';
import ApprovalTimeline from '../components/ApprovalTimeline.jsx';
import ApprovePanel from '../components/ApprovePanel.jsx';
import SupplierAssignmentCard from '../components/SupplierAssignmentCard/index.js';
import styles from './RequestDetailPage.module.css';

// Solicitações com fornecedor (aguardando indicação, bloqueada, pendente de documentação,
// serviço em andamento, concluída)
const SUPPLIER_STATUSES = [
  LABOR_REQUEST_STATUS_ID.AGUARDANDO_FORNECEDOR,
  LABOR_REQUEST_STATUS_ID.BLOQUEADA,
  LABOR_REQUEST_STATUS_ID.PENDENTE_DOCUMENTACAO,
  LABOR_REQUEST_STATUS_ID.EM_ANDAMENTO,
  LABOR_REQUEST_STATUS_ID.CONCLUIDA,
];

// Ordem dos grupos de documentos exigidos (as NRs têm card próprio)
const REQUIRED_DOC_CATEGORIES = [
  DOCUMENT_CATEGORY_ID.EMPRESA,
  DOCUMENT_CATEGORY_ID.BASICO,
  DOCUMENT_CATEGORY_ID.OUTRO,
];

/**
 * Página de detalhe de uma solicitação de mão-de-obra.
 *
 * - Qualquer colaborador autenticado visualiza os detalhes.
 * - Segurança do Trabalho (department === 1) vê o painel de aprovação
 *   enquanto a solicitação estiver pendente (status === 0).
 * - Depois de aprovada: card do fornecedor (Compras indica pelo e-mail, reenvia, muda o
 *   prazo e troca; os demais acompanham).
 */
export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const { data: requestResponse, isLoading: isLoadingRequest, reload: reloadRequest } = useLaborRequest(id);
  const { data: approvalsResponse, isLoading: isLoadingApprovals, reload: reloadApprovals } = useLaborRequestApprovals(id);

  const [approvalDone, setApprovalDone] = useState(false);
  // Concluir contrato: confirmação, envio e o aviso do resultado
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (isLoadingRequest && !requestResponse) return <p>Carregando solicitação...</p>;

  const request = requestResponse?.body?.result;

  if (!request) {
    return <EmptyState title="Solicitação não encontrada" description="Verifique se o link está correto." />;
  }

  const approvals = approvalsResponse?.body?.approvals ?? [];

  // Departamento necessário para aprovar enquanto pendente (status=0)
  const necessaryAprove = user.department === Number(approvals[0]?.department);
  const isPending = request.status === LABOR_REQUEST_STATUS_ID.PENDENTE;
  const hasSupplierStage = SUPPLIER_STATUSES.includes(request.status);

  const canApprove = necessaryAprove && isPending && !approvalDone;
  // RH e Compras concluem o contrato (Pendente de documentação ou Serviço em andamento)
  const canConclude = CONCLUDABLE_STATUS_IDS.includes(request.status)
    && canAccess(user.department, ACCESS.concludeContract);

  const handleApprovalSuccess = () => {
    setApprovalDone(true);
    reloadRequest();
    reloadApprovals();
  };

  const handleConclude = async () => {
    setIsConcluding(true);
    const result = await concludeLaborRequest(request.id);
    setIsConcluding(false);
    setConcludeOpen(false);
    setFeedback(result.success
      ? { tone: 'success', message: result.body?.message ?? 'Contrato concluído.' }
      : { tone: 'danger', message: result.body?.message ?? 'Erro ao concluir o contrato.' });
    if (result.success) reloadRequest();
  };

  // IDs sugeridos de document_types pela atividade (empresa e outros do colaborador)
  const suggestedDocIds = request.activity_doc_type_id
    ? String(request.activity_doc_type_id).split(',').map(Number).filter(Boolean)
    : [];

  // Documentos exigidos agrupados por categoria (empresa, básicos, outros); NRs ficam no card próprio
  const requiredDocGroups = REQUIRED_DOC_CATEGORIES.map((category) => ({
    category,
    label: DOCUMENT_CATEGORY[category].label,
    items: (request.requiredDocuments ?? []).filter((doc) => doc.category === category),
  })).filter((group) => group.items.length > 0);

  // IDs sugeridos de nr_types pela atividade
  const suggestedNrIds = request.activity_nr_type_id
    ? String(request.activity_nr_type_id).split(',').map(Number).filter(Boolean)
    : [];

  return (
    <div>
      <PageHeader
        eyebrow={`Solicitação #${request.request_number}`}
        title={request.title}
        description={request.location}
        actions={
          <>
            <StatusBadge enumMap={LABOR_REQUEST_STATUS} value={request.status} />
            {canConclude && (
              <Button size="sm" variant="secondary" icon={LuCircleCheckBig} onClick={() => setConcludeOpen(true)}>
                Concluir contrato
              </Button>
            )}
          </>
        }
      />

      {feedback && (
        <div className={styles.bannerWrapper}>
          <Banner tone={feedback.tone} description={feedback.message} />
        </div>
      )}

      {approvalDone && (
        <div className={styles.bannerWrapper}>
          <Banner
            tone="success"
            title="Decisão registrada com sucesso."
            description="A solicitação foi atualizada."
          />
        </div>
      )}

      <div className={`${styles.layout} ${canApprove ? styles.singleColumn : ''}`}>
        {/* ── Coluna esquerda: detalhes ── */}
        <div className={styles.leftCol}>
          <Card>
            <Card.Body>
              <dl className={styles.infoGrid}>
                <dt>Nº do contrato</dt>
                <dd>{request.contract_number ?? (isPending ? 'Definido na aprovação da Segurança do Trabalho' : '—')}</dd>

                {request.concluded_at && (
                  <>
                    <dt>Contrato concluído</dt>
                    <dd>
                      {formatDateTime(request.concluded_at)}
                      {request.concluded_by_name ? ` · ${request.concluded_by_name}` : ''}
                    </dd>
                  </>
                )}

                <dt>Atividade</dt>
                <dd>{request.activity_type_name ?? '—'}</dd>

                <dt>Urgência</dt>
                <dd><StatusBadge enumMap={URGENCY} value={request.urgency} /></dd>

                <dt>Solicitante</dt>
                <dd>{request.requester_name}</dd>

                <dt>Localização</dt>
                <dd>{request.location}</dd>

                <dt>Data prevista de início</dt>
                <dd>{formatDate(request.start_date)}</dd>

                {request.end_date && (
                  <>
                    <dt>Data prevista de fim</dt>
                    <dd>{formatDate(request.end_date)}</dd>
                  </>
                )}

                {request.description && (
                  <>
                    <dt>Descrição</dt>
                    <dd>{request.description}</dd>
                  </>
                )}
              </dl>
            </Card.Body>
          </Card>

          {/* Documentos obrigatórios definidos pela Segurança do Trabalho, por categoria */}
          {requiredDocGroups.length > 0 && (
            <Card>
              <Card.Body>
                <h3 className={styles.sectionTitle}>
                  <LuFileText aria-hidden="true" />
                  Documentos obrigatórios
                </h3>
                {requiredDocGroups.map((group) => (
                  <div key={group.category} className={styles.reqGroup}>
                    <p className={styles.reqGroupTitle}>{group.label}</p>
                    <ul className={styles.reqList}>
                      {group.items.map((doc) => (
                        <li key={doc.id} className={styles.reqItem}>
                          <span className={styles.reqName}>{doc.document_type_name}</span>
                          {doc.has_expiration && <span className={styles.reqMeta}>tem validade</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {/* NRs obrigatórias definidas pela Segurança do Trabalho */}
          {request.requiredNrTypes && request.requiredNrTypes.length > 0 && (
            
            <Card>
              <Card.Body>
                <h3 className={styles.sectionTitle}>
                  <LuShieldCheck aria-hidden="true" />
                  NRs obrigatórias para os colaboradores
                </h3>
                <ul className={styles.reqList}>
                  {request.requiredNrTypes.sort((a, b) => a.nr_type_id - b.nr_type_id).map((nr) => (
                    <li key={nr.id} className={styles.reqItem}>
                      <span className={styles.reqCode}>{nr.nr_code}</span>
                      <span className={styles.reqName}>{nr.nr_name}</span>
                    </li>
                  ))}
                </ul>
              </Card.Body>
            </Card>
          )}
        </div>

        {/* ── Coluna direita: fornecedor e aprovações (em baixo quando necessita de aprovação) ── */}
        <div className={styles.rightCol}>
          {hasSupplierStage && (
            <SupplierAssignmentCard
              laborRequestId={request.id}
              requestStatus={request.status}
              onChanged={reloadRequest}
            />
          )}

          <Card>
            <Card.Body>
              <h3 className={styles.sectionTitle}>Aprovações</h3>

              {isLoadingApprovals ? (
                <p>Carregando aprovações...</p>
              ) : (
                <ApprovalTimeline approvals={approvals} />
              )}

              {/* Painel de aprovação — apenas para Segurança do Trabalho com solicitação pendente */}
              {canApprove && (
                <>
                  <hr className={styles.divider} />
                  <h4 className={styles.subTitle}>Registrar documentos necessários</h4>
                  <ApprovePanel
                    laborRequestId={request.id}
                    activityDocTypeIds={suggestedDocIds}
                    activityNrTypeIds={suggestedNrIds}
                    onSuccess={handleApprovalSuccess}
                  />
                </>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={concludeOpen}
        onClose={() => setConcludeOpen(false)}
        onConfirm={handleConclude}
        title="Concluir contrato"
        description="O contrato termina neste mês: os documentos mensais deixam de ser cobrados a partir do próximo mês. O fornecedor ainda vê o contrato e pode enviar o que ficou pendente. Não dá para desfazer pela tela."
        confirmLabel="Concluir contrato"
        isLoading={isConcluding}
      />
    </div>
  );
}
