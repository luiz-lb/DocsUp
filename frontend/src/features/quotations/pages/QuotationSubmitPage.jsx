import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { LuFileCheck, LuSend } from 'react-icons/lu';
import { Card, Button, FormField, Banner, CountdownTimer } from '../../../components/ui/index.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getInviteByToken, submitQuotation } from '../api/quotationsApi.js';
import NrDeclarationsForm from '../components/NrDeclarationsForm/index.js';
import CompanyChecklistForm from '../components/CompanyChecklistForm/index.js';
import AcceptanceTermDialog from '../components/AcceptanceTermDialog/index.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
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

  if (isLoading || !data) return null;

  const { round, laborRequest } = data;

  if (submitted) {
    return (
      <Card tone="dark" className={styles.card}>
        <Card.Body className={styles.successBody}>
          <LuFileCheck className={styles.successIcon} />
          <h1 className={styles.title}>Cotacao enviada com sucesso</h1>
          <p className={styles.subtitle}>
            Registramos o Termo de Aceite em {formatDateTime(submitted.acceptanceAt)} (IP {submitted.acceptanceIp}).
            Um comprovante em PDF foi gerado para voce e para o time de Suprimentos.
          </p>
          <Button variant="secondary" disabled>Baixar comprovante (PDF)</Button>
        </Card.Body>
      </Card>
    );
  }

  const handleAccept = async () => {
    setIsSubmitting(true);
    const record = await submitQuotation(token, {
      totalValue: Number(totalValue),
      nrDeclarations: Object.entries(nrValues).map(([nrTypeId, employeeCount]) => ({ nrTypeId: Number(nrTypeId), employeeCount })),
      checklist: Object.entries(checklistValues).map(([documentTypeId, hasDocument]) => ({ documentTypeId: Number(documentTypeId), hasDocument })),
      checklistAccepted: true,
      omissionWarningAccepted: true,
    });
    setIsSubmitting(false);
    termDialog.close();
    setSubmitted(record);
  };

  return (
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Cotacao — {laborRequest.title}</p>
        <h1 className={styles.title}>Responder cotacao</h1>
        <div className={styles.deadlineRow}>
          <span>Prazo de resposta:</span>
          <CountdownTimer deadline={round.deadline} />
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Valor da proposta</h2>
          <FormField label="Valor total (R$)" required>
            <input type="number" min="0" value={totalValue} onChange={(event) => setTotalValue(event.target.value)} placeholder="0,00" />
          </FormField>
          {totalValue && <p className={styles.preview}>{formatCurrency(Number(totalValue))}</p>}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Colaboradores por NR</h2>
          <p className={styles.hint}>Nao envie dados de colaboradores agora - apenas quantos ja possuem cada NR.</p>
          <NrDeclarationsForm values={nrValues} onChange={setNrValues} />
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Checklist de documentacao da empresa</h2>
          <CompanyChecklistForm
            documentTypeIds={laborRequest.requiredDocumentIds}
            values={checklistValues}
            onChange={setChecklistValues}
          />
        </div>

        <Banner
          tone="warning"
          title="Atencao"
          description="A omissao de documentacao obrigatoria pode causar atraso no pagamento e ate cancelamento do contrato."
        />

        <Button icon={LuSend} fullWidth onClick={termDialog.open} disabled={!totalValue} className={styles.submitButton}>
          Enviar cotacao
        </Button>
      </Card.Body>

      <AcceptanceTermDialog
        open={termDialog.isOpen}
        onClose={termDialog.close}
        onAccept={handleAccept}
        isSubmitting={isSubmitting}
      />
    </Card>
  );
}
