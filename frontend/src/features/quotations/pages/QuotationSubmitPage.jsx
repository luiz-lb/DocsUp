import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LuFileCheck, LuSend, LuLogIn } from 'react-icons/lu';
import { Card, Button, FormField, Banner, CountdownTimer } from '../../../components/ui/index.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getInviteByToken, submitQuotation } from '../api/quotationsApi.js';
import NrDeclarationsForm from '../components/NrDeclarationsForm/index.js';
import CompanyChecklistForm from '../components/CompanyChecklistForm/index.js';
import AcceptanceTermDialog from '../components/AcceptanceTermDialog/index.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import styles from './QuotationSubmitPage.module.css';

export default function QuotationSubmitPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated: isSupplierAuth, isLoading: isAuthLoading } = useSupplierAuth();

  const { data, isLoading } = useAsyncData(() => getInviteByToken(token), [token]);
  const termDialog = useDisclosure(false);

  const [totalValue, setTotalValue] = useState('');
  const [nrValues, setNrValues] = useState({});
  const [checklistValues, setChecklistValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [submitError, setSubmitError] = useState('');

  // Enquanto valida autenticação e carrega dados
  if (isAuthLoading || isLoading) return null;

  // Fornecedor não está autenticado — redireciona para login preservando o destino
  if (!isSupplierAuth) {
    return (
      <Card tone="dark" className={styles.card}>
        <Card.Body>
          <p className={styles.eyebrow}>Portal do Fornecedor</p>
          <h1 className={styles.title}>Faça login para continuar</h1>
          <p className={styles.subtitle}>
            Para responder a esta cotação, você precisa estar autenticado no portal.
          </p>
          <Button
            icon={LuLogIn}
            fullWidth
            onClick={() =>
              navigate(ROUTES.suppliers.login, {
                state: { returnTo: `/cotacoes/responder/${token}` },
              })
            }
          >
            Entrar no portal
          </Button>
        </Card.Body>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card tone="dark" className={styles.card}>
        <Card.Body>
          <h1 className={styles.title}>Cotação não encontrada</h1>
          <p className={styles.subtitle}>O link é inválido, expirado ou o prazo já encerrou.</p>
        </Card.Body>
      </Card>
    );
  }

  const { round, laborRequest, existingQuotation } = data;

  // Cotação já submetida
  if (submitted || existingQuotation) {
    const record = submitted ?? existingQuotation;
    return (
      <Card tone="dark" className={styles.card}>
        <Card.Body className={styles.successBody}>
          <LuFileCheck className={styles.successIcon} />
          <h1 className={styles.title}>Cotação enviada com sucesso</h1>
          <p className={styles.subtitle}>
            Registramos o Termo de Aceite em{' '}
            {formatDateTime(record.acceptance_at ?? record.submitted_at)} (IP{' '}
            {record.acceptance_ip ?? '—'}).
          </p>
        </Card.Body>
      </Card>
    );
  }

  // IDs dos documentos obrigatórios para o checklist da empresa
  const requiredDocIds = (laborRequest.requiredDocuments ?? []).map((d) => d.document_type_id);

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
    <Card tone="dark" className={styles.card}>
      <Card.Body>
        <p className={styles.eyebrow}>Cotação — {laborRequest.title}</p>
        <h1 className={styles.title}>Responder cotação</h1>
        <div className={styles.deadlineRow}>
          <span>Prazo de resposta:</span>
          <CountdownTimer deadline={round.deadline} />
        </div>

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
          <NrDeclarationsForm values={nrValues} onChange={setNrValues} />
        </div>

        {/* Checklist da empresa */}
        {requiredDocIds.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Checklist de documentação da empresa</h2>
            <CompanyChecklistForm
              documentTypeIds={requiredDocIds}
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
