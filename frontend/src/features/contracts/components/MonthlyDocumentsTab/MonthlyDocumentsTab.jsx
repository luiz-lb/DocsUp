import { useState } from 'react';
import { LuDownload, LuUpload } from 'react-icons/lu';
import { Banner, Button, FileDropzone, Modal, StatusBadge } from '../../../../components/ui/index.js';
import { MONTHLY_SITUATION } from '../../../../constants/enums.js';
import { useAsyncData } from '../../../../hooks/useAsyncData.js';
import { cn } from '../../../../utils/cn.js';
import { formatDateOnly, formatMonth, formatMonthShort } from '../../../../utils/formatters.js';
import { downloadPhase2Document, getMonthlyDocuments, uploadMonthlyDocument } from '../../../employees/api/employeesApi.js';
import styles from './MonthlyDocumentsTab.module.css';

/** Texto curto do que falta no mês: '2 atrasados · 1 a enviar'. */
function monthBadge(entry) {
  if (entry.late > 0) return { text: `${entry.late} atrasado${entry.late === 1 ? '' : 's'}`, tone: 'danger' };
  if (entry.returned > 0) return { text: `${entry.returned} devolvido${entry.returned === 1 ? '' : 's'}`, tone: 'danger' };
  if (entry.pending > 0) return { text: `${entry.pending} a enviar`, tone: 'info' };
  if (entry.sent > 0) return { text: 'em análise', tone: 'warning' };
  return { text: 'em dia', tone: 'success' };
}

/**
 * Documentos trabalhistas mensais do contrato (portal do fornecedor): escolhe a competência
 * (mês) e envia cada documento — os da empresa uma vez por mês e os de colaborador um por
 * colaborador. Depois do dia limite do mês seguinte, o que não foi enviado fica atrasado.
 * Documento aprovado pelo RH não é substituído; reprovado volta para reenvio.
 *
 * Props: token (link do contrato)
 */
export default function MonthlyDocumentsTab({ token }) {
  const [month, setMonth] = useState(null);
  const { data: response, isLoading, reload } = useAsyncData(() => getMonthlyDocuments(token, month), [token, month]);
  const [target, setTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  if (isLoading && !response) return <p className={styles.muted}>Carregando documentos mensais…</p>;
  if (!response?.success) return <Banner tone="danger" description={response?.message ?? 'Erro ao buscar os documentos mensais.'} />;

  const data = response.body;
  if (!data.hasTypes) {
    return <Banner tone="info" description="Nenhum documento mensal é cobrado por enquanto." />;
  }
  if (data.months.length === 0) {
    return <Banner tone="info" description="Os documentos mensais começam a ser cobrados no mês de início do contrato." />;
  }

  const companyItems = data.items.filter((item) => !item.employeeId);
  const employeeItems = data.items.filter((item) => item.employeeId);

  const handleDownload = async (documentId) => {
    setDownloadingId(documentId);
    const result = await downloadPhase2Document(token, documentId);
    setDownloadingId(null);
    if (!result.success) setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao baixar o arquivo.' });
  };

  const handleUploaded = (message) => {
    setTarget(null);
    setFeedback({ tone: 'success', message });
    reload();
  };

  const renderItem = (item) => {
    const canSend = item.situation !== 'approved';
    return (
      <div key={`${item.documentTypeId}:${item.employeeId ?? 'empresa'}`} className={styles.item}>
        <div className={styles.itemInfo}>
          <span className={styles.itemTitle}>{item.employeeName ?? item.documentTypeName}</span>
          {item.employeeName && <span className={styles.itemMeta}>{item.documentTypeName}</span>}
          {item.document && (
            <span className={styles.itemMeta}>
              {item.document.fileName} · enviado em {formatDateOnly(item.document.uploadedAt)}
              {item.document.version > 1 ? ` · ${item.document.version}ª entrega` : ''}
            </span>
          )}
          {item.situation === 'returned' && item.document?.observation && (
            <span className={styles.observation}>Motivo: {item.document.observation}</span>
          )}
        </div>
        <StatusBadge enumMap={MONTHLY_SITUATION} value={item.situation} />
        <div className={styles.itemActions}>
          {item.document && (
            <Button
              size="sm"
              variant="ghost"
              icon={LuDownload}
              isLoading={downloadingId === item.document.id}
              onClick={() => handleDownload(item.document.id)}
              aria-label={`Baixar ${item.document.fileName}`}
              title="Baixar arquivo"
            />
          )}
          {canSend && (
            <Button size="sm" variant={item.document ? 'secondary' : 'primary'} icon={LuUpload} onClick={() => setTarget(item)}>
              {item.document ? 'Reenviar' : 'Enviar'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      {data.concluded && (
        <Banner tone="info" description="Contrato concluído: não há novos meses a cobrar. Envie só o que ficou pendente." />
      )}

      {/* Competências (mais nova primeiro) */}
      <div className={styles.months} role="tablist" aria-label="Mês de referência">
        {data.months.map((entry) => {
          const badge = monthBadge(entry);
          const isActive = entry.month === data.selectedMonth;
          return (
            <button
              key={entry.month}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(styles.month, isActive && styles.monthActive)}
              onClick={() => setMonth(entry.month)}
            >
              <span className={styles.monthLabel}>{formatMonthShort(entry.month)}</span>
              <span className={cn(styles.monthBadge, styles[`tone_${badge.tone}`])}>{badge.text}</span>
            </button>
          );
        })}
      </div>

      <p className={styles.monthHeader}>
        Competência <strong>{formatMonth(data.selectedMonth)}</strong> · vence em {formatDateOnly(data.selectedDueDate)}
      </p>

      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      {companyItems.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Da empresa</h4>
          {companyItems.map(renderItem)}
        </section>
      )}

      {employeeItems.length > 0 && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Dos colaboradores</h4>
          {employeeItems.map(renderItem)}
        </section>
      )}

      {companyItems.length === 0 && employeeItems.length === 0 && (
        <p className={styles.muted}>Nada a enviar neste mês. Os documentos por colaborador aparecem depois que os colaboradores são cadastrados.</p>
      )}

      <MonthlyUploadModal
        token={token}
        month={data.selectedMonth}
        target={target}
        onClose={() => setTarget(null)}
        onSuccess={handleUploaded}
      />
    </div>
  );
}

function MonthlyUploadModal({ token, month, target, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setFile(null);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Escolha o arquivo do documento.');
      return;
    }
    setIsSubmitting(true);
    const result = await uploadMonthlyDocument(token, {
      documentTypeId: target.documentTypeId,
      referenceMonth: month,
      employeeId: target.employeeId,
    }, file);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao enviar o documento.');
      return;
    }
    setFile(null);
    setError('');
    onSuccess(`Documento enviado: ${target.documentTypeName}${target.employeeName ? ` de ${target.employeeName}` : ''} (${formatMonth(month)}).`);
  };

  return (
    <Modal
      open={Boolean(target)}
      onClose={isSubmitting ? undefined : close}
      title="Enviar documento mensal"
      actions={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuUpload} onClick={handleSubmit} isLoading={isSubmitting} disabled={!file}>Enviar</Button>
        </>
      }
    >
      {target && (
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            <strong>{target.documentTypeName}</strong>
            {target.employeeName ? ` · ${target.employeeName}` : ' · empresa'}
            <br />
            Competência {formatMonth(month)}
          </p>
          {target.document && (
            <Banner tone="info" description="O arquivo novo substitui o atual deste mês. O anterior fica no histórico." />
          )}
          <FileDropzone
            files={file ? [file] : []}
            onFilesChange={(files) => setFile(files[files.length - 1] ?? null)}
            multiple={false}
            label="Arquivo do documento (um arquivo)"
            hint="PDF, JPG ou PNG"
          />
          {error && <Banner tone="danger" description={error} />}
        </div>
      )}
    </Modal>
  );
}
