import { useEffect, useMemo, useRef, useState } from 'react';
import { LuArrowLeft, LuChevronRight, LuDownload, LuHistory, LuPencil } from 'react-icons/lu';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Button,
  Banner,
  FormField,
} from '../../../components/ui/index.js';
import { DOCUMENT_STATUS } from '../../../constants/enums.js';
import { formatDate } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { downloadDocumentFiles, listDeliveredDocuments } from '../api/documentsRealApi.js';
import DocumentStatusModal from '../components/DocumentStatusModal/index.js';
import DeliveryHistoryModal from '../components/DeliveryHistoryModal/index.js';
import styles from './SupplierDocumentsPage.module.css';

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

// Caixa "selecionar todos": marcada, desmarcada ou parcial (indeterminate)
function SelectAllCheckbox({ total, selected, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < total;
  }, [selected, total]);
  return (
    <label className={styles.selectAll}>
      <input
        ref={ref}
        type="checkbox"
        className={styles.checkbox}
        checked={total > 0 && selected === total}
        onChange={(event) => onChange(event.target.checked)}
      />
      Selecionar todos
    </label>
  );
}

export default function SupplierDocumentsPage() {
  const [groupBy, setGroupBy] = useState('supplier');
  const [openGroupKey, setOpenGroupKey] = useState(null);

  const { data: documents, isLoading, reload } = useAsyncData(
    () => listDeliveredDocuments({}),
    [],
  );

  const [feedback, setFeedback] = useState(null);

  // Modais: alterar status e histórico de entregas
  const [statusTarget, setStatusTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  // Download: documentos marcados no grupo aberto e o que está baixando agora
  // ('selected', 'all' ou o id do documento da linha)
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [downloading, setDownloading] = useState(null);

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

  // Ao trocar de grupo (ou de agrupamento), a seleção começa vazia
  const openGroupWith = (key) => {
    setOpenGroupKey(key);
    setSelectedIds(new Set());
  };

  const changeGroupBy = (mode) => {
    setGroupBy(mode);
    openGroupWith(null);
  };

  // ── Download (um arquivo ou ZIP) ─────────────────────────────────────────
  const groupDocIds = openGroup ? openGroup.docs.map((doc) => doc.id) : [];
  const selectedInGroup = groupDocIds.filter((docId) => selectedIds.has(docId));

  const toggleSelected = (docId) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });

  const selectAll = (checked) => setSelectedIds(checked ? new Set(groupDocIds) : new Set());

  const handleDownload = async (documentIds, key) => {
    if (documentIds.length === 0) return;
    setDownloading(key);
    setFeedback(null);
    const result = await downloadDocumentFiles(documentIds);
    setDownloading(null);

    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao baixar os documentos.' });
      return;
    }
    setFeedback({
      tone: 'success',
      message: documentIds.length === 1
        ? `Download iniciado: ${result.fileName}.`
        : `Download iniciado: ${result.fileName} (${documentIds.length} documentos).`,
    });
  };

  // ── Status (modal) ───────────────────────────────────────────────────────
  const handleStatusSuccess = (doc, message) => {
    setStatusTarget(null);
    setFeedback({
      tone: 'success',
      message: message === 'Nenhuma alteração para salvar.'
        ? message
        : `Status de "${doc.document_type_name}" atualizado.`,
    });
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
  // Coluna de origem conforme o agrupamento (o que o grupo aberto ainda não diz)
  const originColumn = {
    supplier: { header: 'Solicitação', render: (row) => row.labor_request_title ?? '—' },
    location: {
      header: 'Fornecedor · Solicitação',
      render: (row) => (
        <div className={styles.docCell}>
          <span>{row.supplier_name ?? '—'}</span>
          <span className={styles.meta}>{row.labor_request_title ?? '—'}</span>
        </div>
      ),
    },
    request: { header: 'Fornecedor', render: (row) => row.supplier_name ?? '—' },
  }[groupBy];

  const docColumns = [
    {
      key: 'select',
      header: '',
      label: 'Selecionar',
      width: '2.5rem',
      render: (row) => (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={selectedIds.has(row.id)}
          onChange={() => toggleSelected(row.id)}
          aria-label={`Selecionar ${row.document_type_name}`}
        />
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      render: (row) => (
        <div className={styles.docCell}>
          <strong>{row.document_type_name}</strong>
          <span className={styles.fileName} title={row.file_name}>{row.file_name}</span>
          <span className={styles.meta}>{row.employee_name ? `Colaborador: ${row.employee_name}` : 'Empresa'}</span>
        </div>
      ),
    },
    { key: 'origin', ...originColumn },
    {
      key: 'uploaded_at',
      header: 'Enviado em',
      render: (row) => (
        <div className={styles.docCell}>
          <span>{formatDate(row.uploaded_at)}</span>
          {row.deliveries_count > 1 && <span className={styles.meta}>{row.deliveries_count}ª entrega</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className={styles.statusCell}>
          <StatusBadge enumMap={DOCUMENT_STATUS} value={row.status} />
          {row.observation && (
            <span className={styles.observation} title={row.observation}>{row.observation}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="ghost"
            icon={LuPencil}
            onClick={() => setStatusTarget(row)}
            title="Alterar status"
            aria-label={`Alterar status de ${row.document_type_name}`}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={LuHistory}
            onClick={() => setHistoryTarget(row)}
            title="Histórico de entregas"
            aria-label={`Histórico de entregas de ${row.document_type_name}`}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={LuDownload}
            isLoading={downloading === row.id}
            disabled={downloading !== null && downloading !== row.id}
            onClick={() => handleDownload([row.id], row.id)}
            title="Baixar arquivo"
            aria-label={`Baixar ${row.file_name}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="RH & Segurança"
        title="Documentos dos fornecedores"
        description="Documentos entregues pelos fornecedores. Organize por fornecedor, local ou solicitação, baixe os arquivos e atualize o status de cada documento."
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
            <Button variant="ghost" size="sm" icon={LuArrowLeft} onClick={() => openGroupWith(null)}>
              Voltar
            </Button>
            <h3 className={styles.drillTitle}>
              {GROUP_BY[groupBy].label}: {openGroup.title}
              <span className={styles.drillCount}>{openGroup.docs.length} documento(s)</span>
            </h3>
          </div>

          {/* Download: os marcados ou o grupo inteiro (mais de um arquivo vai num ZIP) */}
          <div className={styles.downloadBar}>
            <div className={styles.selection}>
              <SelectAllCheckbox total={groupDocIds.length} selected={selectedInGroup.length} onChange={selectAll} />
              <span className={styles.selectionInfo}>
                {selectedInGroup.length === 0
                  ? 'Marque os documentos para baixar só alguns.'
                  : `${selectedInGroup.length} de ${groupDocIds.length} selecionado(s)`}
              </span>
            </div>
            <div className={styles.downloadActions}>
              <Button
                size="sm"
                variant="secondary"
                icon={LuDownload}
                isLoading={downloading === 'selected'}
                disabled={selectedInGroup.length === 0 || (downloading !== null && downloading !== 'selected')}
                onClick={() => handleDownload(selectedInGroup, 'selected')}
              >
                Baixar selecionados{selectedInGroup.length > 0 ? ` (${selectedInGroup.length})` : ''}
              </Button>
              <Button
                size="sm"
                icon={LuDownload}
                isLoading={downloading === 'all'}
                disabled={groupDocIds.length === 0 || (downloading !== null && downloading !== 'all')}
                onClick={() => handleDownload(groupDocIds, 'all')}
              >
                Baixar todos do grupo ({groupDocIds.length})
              </Button>
            </div>
          </div>
          <DataTable
            columns={docColumns}
            rows={openGroup.docs}
            getRowKey={(row) => row.id}
            emptyTitle="Nenhum documento neste grupo"
            stackOnMobile
          />
        </>
      ) : (
        <DataTable
          columns={summaryColumns}
          rows={groups}
          isLoading={isLoading}
          getRowKey={(g) => g.key}
          onRowClick={(g) => openGroupWith(g.key)}
          emptyTitle="Nenhum documento encontrado"
          emptyDescription="Ainda não há documentos entregues pelos fornecedores."
          stackOnMobile
        />
      )}

      <DocumentStatusModal
        open={Boolean(statusTarget)}
        document={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSuccess={handleStatusSuccess}
      />

      <DeliveryHistoryModal
        open={Boolean(historyTarget)}
        document={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
