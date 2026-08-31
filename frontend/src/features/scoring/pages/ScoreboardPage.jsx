import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, ScoreGauge } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listScoreboard } from '../api/scoringApi.js';
import { ROUTES } from '../../../constants/routes.js';
import styles from './ScoreboardPage.module.css';

const COLUMNS = [
  { key: 'rank', header: '#', width: 48, render: (_row, index) => index + 1 },
  { key: 'supplierName', header: 'Fornecedor' },
  { key: 'quotationDeliveryScore', header: 'Prazo (peso 1)', render: (row) => row.quotationDeliveryScore.toFixed(1) },
  { key: 'documentationScore', header: 'Docs (peso 3)', render: (row) => row.documentationScore.toFixed(1) },
  { key: 'evaluationScore', header: 'Avaliacao (peso 5)', render: (row) => row.evaluationScore.toFixed(1) },
  { key: 'finalScore', header: 'Score final', render: (row) => <ScoreGauge score={row.finalScore * 10} size={52} /> },
];

export default function ScoreboardPage() {
  const { data: scores, isLoading } = useAsyncData(listScoreboard, []);
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        eyebrow="Qualificacao de fornecedores"
        title="Ranking de fornecedores"
        description="Media ponderada entre entrega de cotacao, documentacao/retrabalho e avaliacao das equipes."
      />
      <DataTable
        columns={COLUMNS}
        rows={scores ?? []}
        isLoading={isLoading}
        onRowClick={(row) => navigate(ROUTES.scoring.evaluate(row.laborRequestId))}
        emptyTitle="Nenhum fornecedor avaliado ainda"
        getRowKey={(row) => row.id}
      />
      <p className={styles.hint}>Clique em um fornecedor para registrar uma nova avaliacao.</p>
    </div>
  );
}
