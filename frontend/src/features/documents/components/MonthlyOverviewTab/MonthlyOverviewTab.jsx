import { useMemo, useState } from 'react';
import { LuDownload, LuPencil } from 'react-icons/lu';
import { Banner, Button, DataTable, FormField, SearchSelect, StatusBadge } from '../../../../components/ui/index.js';
import { MONTHLY_SITUATION } from '../../../../constants/enums.js';
import { useAsyncData } from '../../../../hooks/useAsyncData.js';
import { formatDate, formatDateOnly, formatMonth } from '../../../../utils/formatters.js';
import { downloadDocumentFiles, getMonthlyOverview } from '../../api/documentsRealApi.js';
import DocumentStatusModal from '../DocumentStatusModal/index.js';
import styles from './MonthlyOverviewTab.module.css';

/** Mês anterior em 'AAAA-MM' (a competência que vence neste mês). */
function previousMonth() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const NO_CONTRACT = '__sem_contrato__';
const SUMMARY_ORDER = ['late', 'pending', 'returned', 'sent', 'approved'];

/**
 * Aba Mensais de Docs de Fornecedores (RH e Segurança): num mês (competência), cada documento
 * mensal esperado de cada contrato com fornecedor ativo — o que já veio (e a análise) e o que
 * falta, no prazo ou atrasado. Filtra por contrato, fornecedor e situação; baixa o arquivo e
 * muda o status direto daqui.
 */
export default function MonthlyOverviewTab() {
  const [month, setMonth] = useState(previousMonth);
  const [filters, setFilters] = useState({ contract: '', supplierId: '', situation: '' });
  const { data: response, isLoading, reload } = useAsyncData(() => getMonthlyOverview(month), [month]);
  const [statusTarget, setStatusTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const rows = useMemo(() => (response?.success ? response.body.rows : []), [response]);

  const options = useMemo(() => {
    const contracts = new Map();
    const suppliers = new Map();
    for (const row of rows) {
      const key = row.contractNumber?.trim() || NO_CONTRACT;
      contracts.set(key, key === NO_CONTRACT ? 'Sem contrato' : key);
      suppliers.set(String(row.supplierId), row.supplierName);
    }
    const toOptions = (map) => [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    return { contracts: toOptions(contracts), suppliers: toOptions(suppliers) };
  }, [rows]);

  const filtered = rows.filter((row) => {
    if (filters.contract && (row.contractNumber?.trim() || NO_CONTRACT) !== filters.contract) return false;
    if (filters.supplierId && String(row.supplierId) !== filters.supplierId) return false;
    if (filters.situation && row.situation !== filters.situation) return false;
    return true;
  });

  const handleDownload = async (documentId) => {
    setDownloadingId(documentId);
    setFeedback(null);
    const result = await downloadDocumentFiles([documentId]);
    setDownloadingId(null);
    if (!result.success) setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao baixar o arquivo.' });
  };

  const handleStatusSuccess = (doc, message) => {
    setStatusTarget(null);
    setFeedback({
      tone: 'success',
      message: message === 'Nenhuma alteração para salvar.' ? message : `Status de "${doc.document_type_name}" atualizado.`,
    });
    reload();
  };

  const columns = [
    {
      key: 'contract',
      header: 'Contrato · Fornecedor',
      render: (row) => (
        <div className={styles.cell}>
          <strong>{row.contractNumber ?? 'Sem contrato'}</strong>
          <span className={styles.meta}>{row.supplierName}</span>
          <span className={styles.meta}>{row.laborRequestTitle}</span>
        </div>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      render: (row) => (
        <div className={styles.cell}>
          <span>{row.documentTypeName}</span>
          <span className={styles.meta}>{row.employeeName ? `Colaborador: ${row.employeeName}` : 'Empresa'}</span>
          {row.document && <span className={styles.meta} title={row.document.fileName}>{row.document.fileName}</span>}
        </div>
      ),
    },
    {
      key: 'situation',
      header: 'Situação',
      render: (row) => (
        <div className={styles.cell}>
          <StatusBadge enumMap={MONTHLY_SITUATION} value={row.situation} />
          {row.document && <span className={styles.meta}>Enviado em {formatDate(row.document.uploadedAt)}</span>}
          {row.document?.observation && <span className={styles.observation}>{row.document.observation}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => row.document && (
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="ghost"
            icon={LuPencil}
            title="Alterar status"
            aria-label={`Alterar status de ${row.documentTypeName}`}
            onClick={() => setStatusTarget({
              id: row.document.id,
              status: row.document.status,
              observation: row.document.observation,
              document_type_name: `${row.documentTypeName} (${formatMonth(response.body.month)})`,
              employee_name: row.employeeName,
              supplier_name: row.supplierName,
              file_name: row.document.fileName,
            })}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={LuDownload}
            title="Baixar arquivo"
            aria-label={`Baixar ${row.document.fileName}`}
            isLoading={downloadingId === row.document.id}
            onClick={() => handleDownload(row.document.id)}
          />
        </div>
      ),
    },
  ];

  const body = response?.success ? response.body : null;

  return (
    <div>
      <div className={styles.toolbar}>
        <FormField label="Competência (mês)" className={styles.field}>
          <input type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        </FormField>
        <FormField label="Contrato" className={styles.field}>
          <SearchSelect
            options={options.contracts}
            value={filters.contract}
            onChange={(contract) => setFilters((prev) => ({ ...prev, contract }))}
            placeholder="Todos"
            emptyMessage="Nenhum contrato."
          />
        </FormField>
        <FormField label="Fornecedor" className={styles.field}>
          <SearchSelect
            options={options.suppliers}
            value={filters.supplierId}
            onChange={(supplierId) => setFilters((prev) => ({ ...prev, supplierId }))}
            placeholder="Todos"
            emptyMessage="Nenhum fornecedor."
          />
        </FormField>
        <FormField label="Situação" className={styles.field}>
          <select value={filters.situation} onChange={(event) => setFilters((prev) => ({ ...prev, situation: event.target.value }))}>
            <option value="">Todas</option>
            {SUMMARY_ORDER.map((value) => (
              <option key={value} value={value}>{MONTHLY_SITUATION[value].label}</option>
            ))}
          </select>
        </FormField>
      </div>

      {response && !response.success && <Banner tone="danger" description={response.message} />}
      {body && !body.hasTypes && (
        <Banner tone="info" description="Nenhum documento mensal está ativo. O Admin ativa os tipos em Parâmetros → Trabalhistas mensais." />
      )}
      {body?.hasTypes && (
        <p className={styles.header}>
          {formatMonth(body.month)} · vence em {formatDateOnly(body.dueDate)} (dia {body.dueDay} do mês seguinte)
          {SUMMARY_ORDER.filter((key) => body.summary[key] > 0).map((key) => (
            <span key={key} className={styles.summaryItem}>
              <StatusBadge label={`${body.summary[key]} ${MONTHLY_SITUATION[key].label.toLowerCase()}`} tone={MONTHLY_SITUATION[key].tone} />
            </span>
          ))}
        </p>
      )}
      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      <DataTable
        columns={columns}
        rows={filtered}
        isLoading={isLoading}
        getRowKey={(row) => `${row.laborRequestId}:${row.documentTypeId}:${row.employeeId ?? 'empresa'}`}
        emptyTitle="Nenhum documento mensal neste mês"
        emptyDescription="Aparecem aqui os contratos com fornecedor ativo no mês escolhido."
        stackOnMobile
      />

      <DocumentStatusModal
        open={Boolean(statusTarget)}
        document={statusTarget}
        onClose={() => setStatusTarget(null)}
        onSuccess={handleStatusSuccess}
      />
    </div>
  );
}
