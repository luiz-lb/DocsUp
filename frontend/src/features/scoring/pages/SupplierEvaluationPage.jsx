import { useParams } from 'react-router-dom';
import { Card, PageHeader, EmptyState } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { getScoreBreakdown, submitEvaluation } from '../api/scoringApi.js';
import ScoreBreakdownCard from '../components/ScoreBreakdownCard/index.js';
import EvaluationForm from '../components/EvaluationForm/index.js';
import styles from './SupplierEvaluationPage.module.css';

const ROLE_BY_DEPARTMENT = { 0: { code: 0, label: 'RH' }, 2: { code: 1, label: 'Suprimentos' }, 5: { code: 2, label: 'Chefe de Obra' } };
const DEMO_SUPPLIER_ID = 1;

export default function SupplierEvaluationPage() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const { data, isLoading, reload } = useAsyncData(() => getScoreBreakdown(DEMO_SUPPLIER_ID, requestId), [requestId]);
  const evaluatorRole = ROLE_BY_DEPARTMENT[user.department] ?? { code: 0, label: 'RH' };

  if (isLoading) return null;
  if (!data?.score) return <EmptyState title="Nenhum score encontrado para esta solicitacao" />;

  const handleSubmit = async (score, comments) => {
    await submitEvaluation(DEMO_SUPPLIER_ID, requestId, evaluatorRole.code, score, comments);
    reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Solicitacao #${requestId}`}
        title={`Avaliacao — ${data.score.supplierName}`}
        description="A media ponderada final considera prazo de cotacao (peso 1), documentacao/retrabalho (peso 3) e avaliacao dos times (peso 5)."
      />

      <div className={styles.layout}>
        <Card>
          <Card.Body>
            <ScoreBreakdownCard score={data.score} />
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <EvaluationForm roleLabel={evaluatorRole.label} onSubmit={handleSubmit} />
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
