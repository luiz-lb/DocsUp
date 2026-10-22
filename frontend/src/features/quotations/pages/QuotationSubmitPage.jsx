import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuFileCheck, LuSend } from 'react-icons/lu';
import { Button, FormField, Banner, CountdownTimer } from '../../../components/ui/index.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getInviteByToken, submitQuotation } from '../api/quotationsApi.js';
import NrDeclarationsForm from '../components/NrDeclarationsForm/index.js';
import CompanyChecklistForm from '../components/CompanyChecklistForm/index.js';
import AcceptanceTermDialog from '../components/AcceptanceTermDialog/index.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import SupplierLayout from '../../suppliers/components/SupplierLayout/index.js';
import SupplierPageHeader from '../../suppliers/components/SupplierPageHeader/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import styles from './QuotationSubmitPage.module.css';

export default function QuotationSubmitPage() {
  const { token } = useParams();

  const { data, isLoading } = useAsyncData(() => getInviteByToken(token), [token]);
  const termDialog = useDisclosure(false);

  const [totalValue, setTotalValue] = useState('');
  const [nrValues, setNrValues] = useState({});
  const [checklistValues, setChecklistValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [submitError, setSubmitError] = useState('');

  // Cabeçalho comum (o login é garantido pela rota: RequireSupplierAuth)
  const header = (subtitle, actions) => (
    <SupplierPageHeader
      title="Cotação"
      subtitle={subtitle}
      backTo={ROUTES.suppliers.portal}
      backLabel="Minhas cotações"
      actions={actions}
    />
  );

  if (isLoading) {
    return (
      <SupplierLayout>
        {header()}
        <p className={styles.loading}>Carregando cotação…</p>
      </SupplierLayout>
    );
  }

  if (!data) {
    return (
      <SupplierLayout>
        {header()}
        <Banner
          tone="danger"
          title="Cotação não encontrada"
          description="O link é inválido, expirado ou o prazo já encerrou."
        />
      </SupplierLayout>
    );
  }

  const { round, laborRequest, existingQuotation } = data;

  // Cotação já submetida
  if (submitted || existingQuotation) {
    const record = submitted ?? existingQuotation;
    return (
      <SupplierLayout>
        {header(laborRequest.title)}
        <div className={cn(styles.panel, styles.successBody)}>
          <LuFileCheck className={styles.successIcon} />
          <h2 className={styles.successTitle}>Cotação enviada com sucesso</h2>
          <p className={styles.subtitle}>
            Registramos o Termo de Aceite em{' '}
            {formatDateTime(record.acceptance_at ?? record.submitted_at)} (IP{' '}
            {record.acceptance_ip ?? '—'}).
          </p>
        </div>
      </SupplierLayout>
    );
  }

  // Documentos obrigatórios para o checklist (id e nome vêm do backend)
  const requiredDocs = (laborRequest.requiredDocuments ?? []).map((d) => ({
    id: d.document_type_id,
    name: d.document_type_name,
  }));

  // NRs exigidas para a atividade (vêm do backend, não de mock),
  // ordenadas pelo número da NR (NR-6 antes de NR-10, etc.)
  const nrNumber = (code) => Number(String(code ?? '').replace(/\D/g, '')) || 0;
  const requiredNrTypes = (laborRequest.requiredNrTypes ?? [])
    .map((nr) => ({
      id: nr.nr_type_id,
      code: nr.nr_code,
      name: nr.nr_name,
    }))
    .sort((a, b) => nrNumber(a.code) - nrNumber(b.code));

  const handleAccept = async () => {
    setSubmitError('');
    setIsSubmitting(true);

    const result = await submitQuotation(token, {
      totalValue: Number(totalValue),
      nrDeclarations: Object.entries(nrValues).map(([nrTypeId, employeeCount]) => ({
        nrTypeId: Number(nrTypeId),
        employeeCount: Number(employeeCount),
      })),
      checklist: Object.entries(checklistValues).map(([documentTypeId, hasDocument]) => ({
        documentTypeId: Number(documentTypeId),
        hasDocument: Boolean(hasDocument),
      })),
      checklistAccepted: true,
      omissionWarningAccepted: true,
    });

    setIsSubmitting(false);
    termDialog.close();

    if (!result.success) {
      setSubmitError(result.body?.message ?? 'Erro ao enviar cotação. Tente novamente.');
      return;
    }

    setSubmitted(result.body.quotation);
  };

  return (
    <SupplierLayout>
      {header(
        laborRequest.title,
        <div className={styles.deadlineRow}>
          <span>Prazo de resposta:</span>
          <CountdownTimer deadline={round.deadline} />
        </div>,
      )}
      <div className={styles.panel}>

        {/* Valor da proposta */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Valor da proposta</h2>
          <FormField label="Valor total (R$)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalValue}
              onChange={(event) => setTotalValue(event.target.value)}
              placeholder="0,00"
            />
          </FormField>
          {totalValue && (
            <p className={styles.preview}>{formatCurrency(Number(totalValue))}</p>
          )}
        </div>

        {/* Declaração de NRs */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Colaboradores por NR</h2>
          <p className={styles.hint}>
            Não envie dados de colaboradores agora — apenas quantos já possuem cada NR.
          </p>
          <NrDeclarationsForm nrTypes={requiredNrTypes} values={nrValues} onChange={setNrValues} />
        </div>

        {/* Checklist da empresa */}
        {requiredDocs.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Checklist de documentação exigida</h2>
            <CompanyChecklistForm
              documents={requiredDocs}
              values={checklistValues}
              onChange={setChecklistValues}
            />
          </div>
        )}

        <Banner
          tone="warning"
          title="Atenção"
          description="A omissão de documentação obrigatória pode causar atraso no pagamento e até cancelamento do contrato."
        />

        {submitError && <Banner tone="danger" description={submitError} />}

        <Button
          icon={LuSend}
          fullWidth
          onClick={termDialog.open}
          disabled={!totalValue || Number(totalValue) <= 0}
          className={styles.submitButton}
        >
          Enviar cotação
        </Button>
      </div>

      <AcceptanceTermDialog
        open={termDialog.isOpen}
        onClose={termDialog.close}
        onAccept={handleAccept}
        isSubmitting={isSubmitting}
      />
    </SupplierLayout>
  );
}
