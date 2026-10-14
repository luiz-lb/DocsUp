import { useMemo, useState } from 'react';
import { LuSave, LuArrowLeft, LuChevronRight } from 'react-icons/lu';
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

// Modos de agrupamento
const GROUP_BY = {
  supplier: {
    label: 'Fornecedor',
    keyOf: (d) => `s:${d.supplier_id}`,
    titleOf: (d) => d.supplier_name ?? 'Fornecedor sem nome',
  },
  location: {
    label: 'Local',
    keyOf: (d) => `l:${(d.labor_request_location ?? '—').toLowerCase()}`,
    titleOf: (d) => d.labor_request_location ?? 'Sem local',
  },
  request: {
    label: 'Solicitação',
    keyOf: (d) => `r:${d.labor_request_id ?? 0}`,
    titleOf: (d) => d.labor_request_title ?? 'Sem solicitação',
  },
};

// Ordem/campos do resumo de contagem por status
const SUMMARY_STATUSES = [0, 1, 2, 3, 4, 5];

export default function SupplierDocumentsPage() {
  const [groupBy, setGroupBy] = useState('supplier');
  const [openGroupKey, setOpenGroupKey] = useState(null);

  const { data: documents, isLoading, reload } = useAsyncData(
    () => listDeliveredDocuments({}),
    [],
  );

  const [pending, setPending] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Agrupa os documentos conforme o modo selecionado
  const groups = useMemo(() => {
    const docs = documents ?? [];
    const cfg = GROUP_BY[groupBy];
    const map = new Map();
    for (const doc of docs) {
      const key = cfg.keyOf(doc);
      if (!map.has(key)) {
        map.set(key, { key, title: cfg.titleOf(doc), docs: [], counts: {} });
      }
      const group = map.get(key);
      group.docs.push(doc);
      group.counts[doc.status] = (group.counts[doc.status] ?? 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => b.docs.length - a.docs.length);
  }, [documents, groupBy]);

  const openGroup = groups.find((g) => g.key === openGroupKey) ?? null;

  const changeGroupBy = (mode) => {
    setGroupBy(mode);
    setOpenGroupKey(null);
  };

  // ── Edição de status (na visão detalhada do grupo) ──────────────────────
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

  // ── Colunas da tabela de resumo (grupos) ────────────────────────────────
  const summaryColumns = [
    {
      key: 'title',
      header: GROUP_BY[groupBy].label,
      render: (g) => <strong>{g.title}</strong>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (g) => g.docs.length,
    },
    ...SUMMARY_STATUSES.map((st) => ({
      key: `st_${st}`,
      header: DOCUMENT_STATUS[st].label,
      render: (g) => (g.counts[st] ? <span className={styles.countPill}>{g.counts[st]}</span> : '—'),
    })),
    {
      key: 'open',
      header: '',
      render: () => <LuChevronRight aria-hidden="true" className={styles.chevron} />,
    },
  ];

  // ── Colunas da tabela de documentos (visão detalhada) ───────────────────
  const docColumns = [
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
    // Colunas contextuais conforme o agrupamento
    ...(groupBy !== 'supplier'
      ? [{ key: 'supplier_name', header: 'Fornecedor', render: (row) => row.supplier_name ?? '—' }]
      : []),
    ...(groupBy !== 'request'
      ? [{ key: 'labor_request_title', header: 'Solicitação', render: (row) => row.labor_request_title ?? '—' }]
      : []),
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
        description="Documentos entregues pelos fornecedores. Organize por fornecedor, local ou solicitação e atualize o status de cada documento."
        actions={
          !openGroup && (
            <FormField label="Organizar por" className={styles.filterField}>
              <select value={groupBy} onChange={(e) => changeGroupBy(e.target.value)}>
                {Object.entries(GROUP_BY).map(([value, { label }]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>
          )
        }
      />

      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      {openGroup ? (
        <>
          <div className={styles.drillHeader}>
            <Button variant="ghost" size="sm" icon={LuArrowLeft} onClick={() => setOpenGroupKey(null)}>
              Voltar
            </Button>
            <h3 className={styles.drillTitle}>
              {GROUP_BY[groupBy].label}: {openGroup.title}
              <span className={styles.drillCount}>{openGroup.docs.length} documento(s)</span>
            </h3>
          </div>
          <DataTable
            columns={docColumns}
            rows={openGroup.docs}
            getRowKey={(row) => row.id}
            emptyTitle="Nenhum documento neste grupo"
          />
        </>
      ) : (
        <DataTable
          columns={summaryColumns}
          rows={groups}
          isLoading={isLoading}
          getRowKey={(g) => g.key}
          onRowClick={(g) => setOpenGroupKey(g.key)}
          emptyTitle="Nenhum documento encontrado"
          emptyDescription="Ainda não há documentos entregues pelos fornecedores."
        />
      )}
    </div>
  );
}
