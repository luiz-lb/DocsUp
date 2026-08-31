import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuCheck, LuX } from 'react-icons/lu';
import { Card, PageHeader, StatusBadge, Button, EmptyState } from '../../../components/ui/index.js';
import { LABOR_REQUEST_STATUS, URGENCY } from '../../../constants/enums.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useLaborRequest } from '../hooks/useLaborRequests.js';
import { decideApproval } from '../api/laborRequestsApi.js';
import { formatDate } from '../../../utils/formatters.js';
import ApprovalTimeline from '../components/ApprovalTimeline.jsx';
import styles from './RequestDetailPage.module.css';

const DEPARTMENT_BY_CODE = { 0: 'RH', 1: 'Seguranca' };

export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: response, isLoading, reload } = useLaborRequest(id);
  const [isDeciding, setIsDeciding] = useState(false);

  if (isLoading) return "Carregando...";

  const request = response.body.result;
  const approvals = request?.approvals ?? [];

  const myDepartment = DEPARTMENT_BY_CODE[user.department];
  const myApproval = approvals.find((approval) => approval.department === myDepartment);
  const canDecide = Boolean(myApproval) && myApproval.decision === 0;

  const handleDecision = async (decision) => {
    setIsDeciding(true);
    await decideApproval(request.id, myDepartment, decision, decision === 1 ? 'Reprovado na revisão.' : 'Aprovado.');
    setIsDeciding(false);
    reload();
  };

  if (!request) {
    return <EmptyState title="Solicitação não encontrada" description="Verifique se o link esta correto." />;
  }


  return (
    <div>
      <PageHeader
        eyebrow={`Solicitacao #${request.request_number}`}
        title={request.title}
        description={request.location}
        actions={<StatusBadge enumMap={LABOR_REQUEST_STATUS} value={request.status} />}
      />

      <div className={styles.layout}>
        <Card>
          <Card.Body>
            <dl className={styles.infoGrid}>
              <dt>Atividade</dt>
              <dd>{request.activity_type_name ?? '—'}</dd>
              <dt>Urgencia</dt>
              <dd><StatusBadge enumMap={URGENCY} value={request.urgency} /></dd>
              <dt>Solicitante</dt>
              <dd>{request.requester_name}</dd>
              <dt>Data prevista para inicio</dt>
              <dd>{formatDate(request.start_date)}</dd>
            </dl>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <h3 className={styles.sectionTitle}>Aprovacoes </h3>
            <ApprovalTimeline approvals={approvals} />

            {canDecide && (
              <div className={styles.decisionActions}>
                <Button variant="danger" icon={LuX} onClick={() => handleDecision(1)} isLoading={isDeciding}>
                  Reprovar
                </Button>
                <Button icon={LuCheck} onClick={() => handleDecision(2)} isLoading={isDeciding}>
                  Aprovar como {myDepartment}
                </Button>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
