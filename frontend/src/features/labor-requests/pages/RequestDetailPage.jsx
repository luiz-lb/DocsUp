import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuFileText, LuShieldCheck, LuPlus, LuClipboardList } from 'react-icons/lu';
import {
  Card,
  PageHeader,
  StatusBadge,
  EmptyState,
  Banner,
  Button,
} from '../../../components/ui/index.js';
import { LABOR_REQUEST_STATUS, URGENCY, DOCUMENT_SCOPE } from '../../../constants/enums.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useLaborRequest, useLaborRequestApprovals } from '../hooks/useLaborRequests.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { formatDate } from '../../../utils/formatters.js';
import ApprovalTimeline from '../components/ApprovalTimeline.jsx';
import ApprovePanel from '../components/ApprovePanel.jsx';
import CreateRoundModal from '../../quotations/components/CreateRoundModal/index.js';
import { getLatestRoundByLaborRequest } from '../../quotations/api/quotationsApi.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import { ROUTES } from '../../../constants/routes.js';
import styles from './RequestDetailPage.module.css';

/**
 * Página de detalhe de uma solicitação de mão-de-obra.
 *
 * - Qualquer colaborador autenticado visualiza os detalhes.
 * - Segurança do Trabalho (department === 1) vê o painel de aprovação
 *   enquanto a solicitação estiver pendente (status === 0).
 */
export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: requestResponse, isLoading: isLoadingRequest, reload: reloadRequest } = useLaborRequest(id);
  const { data: approvalsResponse, isLoading: isLoadingApprovals, reload: reloadApprovals } = useLaborRequestApprovals(id);

  const [approvalDone, setApprovalDone] = useState(false);
  const createRoundModal = useDisclosure(false);

  // Busca o round mais recente para saber se existe rodada de cotação ativa
  const { data: latestRound } = useAsyncData(
    () => getLatestRoundByLaborRequest(id),
    [id],
  );

  if (isLoadingRequest) return <p>Carregando solicitação...</p>;

  const request = requestResponse?.body?.result;

  if (!request) {
    return <EmptyState title="Solicitação não encontrada" description="Verifique se o link está correto." />;
  }

  const approvals = approvalsResponse?.body?.approvals ?? [];

  // Departamento necessário para aprovar enquanto pendente (status=0)
  const necessaryAprove = user.department === Number(approvals[0]?.department);
  const isSuprimentos = user.department === 2;
  const isPending = request.status === 0;
  const isEmCotacao = request.status === 3;

  const canApprove = necessaryAprove && isPending && !approvalDone;
  const canCreateRound = isSuprimentos && isEmCotacao;

  const handleApprovalSuccess = () => {
    setApprovalDone(true);
    reloadRequest();
    reloadApprovals();
  };

  const handleRoundCreated = (roundId) => {
    reloadRequest();
    navigate(ROUTES.quotations.round(roundId));
  };

  // IDs sugeridos de document_types pela atividade (campo document_type_id de activity_types)
  const suggestedDocIds = request.activity_doc_type_id
    ? String(request.activity_doc_type_id).split(',').map(Number).filter(Boolean)
    : [];

  // IDs sugeridos de nr_types pela atividade (campo nr_type_id de activity_types)
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
            {/* Suprimentos: navega para o round mais recente quando existir */}
            {isSuprimentos && latestRound && (
              <Button
                variant="secondary"
                icon={LuClipboardList}
                size="sm"
                onClick={() => navigate(ROUTES.quotations.round(latestRound.id))}
              >
                Ver cotações
              </Button>
            )}
            {/* Suprimentos: cria rodada apenas quando Em Cotação E ainda não existe round */}
            {canCreateRound && !latestRound && (
              <Button icon={LuPlus} size="sm" onClick={createRoundModal.open}>
                Iniciar cotação
              </Button>
            )}
          </>
        }
      />

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

          {/* Documentos obrigatórios definidos pela Segurança do Trabalho */}
          {request.requiredDocuments && request.requiredDocuments.length > 0 && (
            <Card>
              <Card.Body>
                <h3 className={styles.sectionTitle}>
                  <LuFileText aria-hidden="true" />
                  Documentos obrigatórios
                </h3>
                <ul className={styles.reqList}>
                  {request.requiredDocuments.map((doc) => (
                    <li key={doc.id} className={styles.reqItem}>
                      <span className={styles.reqName}>{doc.document_type_name}</span>
                      <span className={styles.reqMeta}>
                        {DOCUMENT_SCOPE[doc.scope]?.label ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
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

        {/* ── Coluna direita: aprovações (fica em baixo quando necessita de aprovação) ── */}
        <div className={styles.rightCol}>
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

      {/* Modal de criação de rodada — disponível para Suprimentos quando Em Cotação */}
      <CreateRoundModal
        open={createRoundModal.isOpen}
        onClose={createRoundModal.close}
        laborRequestId={request.id}
        onSuccess={handleRoundCreated}
      />
    </div>
  );
}
