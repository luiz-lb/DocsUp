import { useState } from 'react';
import { LuSave } from 'react-icons/lu';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Button,
  Banner,
  FormField,
} from '../../../components/ui/index.js';
import { DOCUMENT_STATUS, DOCUMENT_SCOPE } from '../../../constants/enums.js';
import { formatDate } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listDeliveredDocuments, setDocumentStatus } from '../api/documentsRealApi.js';
import styles from './SupplierDocumentsPage.module.css';

// Opções de status que o RH / Segurança pode aplicar (0..5)
const STATUS_OPTIONS = Object.entries(DOCUMENT_STATUS).map(([value, { label }]) => ({
  value: Number(value),
  label,
}));

export default function SupplierDocumentsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: documents, isLoading, reload } = useAsyncData(
    () => listDeliveredDocuments({ status: statusFilter }),
    [statusFilter],
  );

  // status escolhido por linha (antes de salvar)
  const [pending, setPending] = useState({}); // { [documentId]: status }
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { tone, message }

  const rows = documents ?? [];

  const setRowStatus = (documentId, value) =>
    setPending((prev) => ({ ...prev, [documentId]: value === '' ? undefined : Number(value) }));

  const handleSave = async (doc) => {
    const newStatus = pending[doc.id];
    if (newStatus === undefined || newStatus === doc.status) return;

    setSavingId(doc.id);
    setFeedback(null);
    const result = await setDocumentStatus(doc.id, newStatus);
    setSavingId(null);

    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao atualizar status.' });
      return;
    }
    setFeedback({ tone: 'success', message: `Status de "${doc.document_type_name}" atualizado.` });
    setPending((prev) => { const next = { ...prev }; delete next[doc.id]; return next; });
    reload();
  };

  const columns = [
    {
      key: 'document_type_name',
      header: 'Documento',
      render: (row) => (
        <div className={styles.docCell}>
          <strong>{row.document_type_name}</strong>
          <span className={styles.fileName}>{row.file_name}</span>
        </div>
      ),
    },
    {
      key: 'supplier_name',
      header: 'Fornecedor',
      render: (row) => row.supplier_name ?? '—',
    },
    {
      key: 'scope',
      header: 'Escopo',
      render: (row) => <StatusBadge enumMap={DOCUMENT_SCOPE} value={row.scope} />,
    },
    {
      key: 'employee_name',
      header: 'Colaborador',
      render: (row) => row.employee_name ?? '—',
    },
    {
      key: 'uploaded_at',
      header: 'Enviado em',
      render: (row) => formatDate(row.uploaded_at),
    },
    {
      key: 'status',
      header: 'Status atual',
      render: (row) => <StatusBadge enumMap={DOCUMENT_STATUS} value={row.status} />,
    },
    {
      key: 'set_status',
      header: 'Alterar para',
      render: (row) => (
        <div className={styles.actionCell}>
          <select
            className={styles.statusSelect}
            value={pending[row.id] ?? row.status}
            onChange={(e) => setRowStatus(row.id, e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            icon={LuSave}
            isLoading={savingId === row.id}
            disabled={pending[row.id] === undefined || pending[row.id] === row.status}
            onClick={() => handleSave(row)}
          >
            Salvar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="RH & Segurança"
        title="Documentos dos fornecedores"
        description="Documentos entregues pelos fornecedores. Atualize o status conforme a análise: Validando, Aprovado, Reprovado, Reenvio Necessário ou Expirado."
        actions={
          <FormField label="Filtrar por status" className={styles.filterField}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>
        }
      />

      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        getRowKey={(row) => row.id}
        emptyTitle="Nenhum documento encontrado"
        emptyDescription="Ainda não há documentos entregues para os filtros selecionados."
      />
    </div>
  );
}
