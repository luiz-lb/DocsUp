import { PageHeader, DataTable, StatusBadge, ScoreGauge } from '../../../components/ui/index.js';
import { DOCUMENT_STATUS, VALIDATION_TYPE } from '../../../constants/enums.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listDocuments } from '../api/documentsApi.js';

const COLUMNS = [
  { key: 'supplierName', header: 'Fornecedor' },
  { key: 'documentTypeName', header: 'Documento' },
  { key: 'validationType', header: 'Metodo', render: (row) => <StatusBadge enumMap={VALIDATION_TYPE} value={row.validationType} /> },
  { key: 'aiScore', header: 'Score', render: (row) => (row.aiScore != null ? <ScoreGauge score={row.aiScore} size={48} /> : '—') },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={DOCUMENT_STATUS} value={row.status} /> },
];

export default function DocumentCenterPage() {
  const { data: documents, isLoading } = useAsyncData(listDocuments, []);

  return (
    <div>
      <PageHeader
        eyebrow="Documentacao"
        title="Central de documentos"
        description="Visao consolidada de todos os documentos enviados por fornecedores, com o metodo de validacao aplicado."
      />
      <DataTable columns={COLUMNS} rows={documents ?? []} isLoading={isLoading} emptyTitle="Nenhum documento enviado ainda" />
    </div>
  );
}
