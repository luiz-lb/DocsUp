import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { LuArrowLeft, LuArrowRight, LuSend } from 'react-icons/lu';
import { ErrorDialog, Card, PageHeader, Button, FormField, WizardStepper, Banner } from '../../../components/ui/index.js';
import DocumentChecklistPicker from '../components/DocumentChecklistPicker.jsx';
import { createLaborRequest, getActivityTypes } from '../api/laborRequestsApi.js';
import { ROUTES } from '../../../constants/routes.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import styles from './NewRequestPage.module.css';

const STEPS = ['Dados da solicitacão', 'Revisão e envio'];

const INITIAL_FORM = {
  title: '',
  activityTypeId: '',
  location: '',
  urgency: 1,
  startDate: null,
  description: '',
  requiredDocumentIds: [],
};

export default function NewRequestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activityOptions, setActivityOptions] = useState([]);

  useEffect(() => {
    getActivityTypes().then((result) => {
      setActivityOptions(Array.isArray(result?.body) ? result.body : []);
    });
  }, []);

  const activity = useMemo(
    () => activityOptions.find((item) => item.id === Number(form.activityTypeId)),
    [activityOptions, form.activityTypeId],
  );
  const suggestedDocumentIds = activity?.document_type_id ?? [];

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const goToDocumentsStep = () => {
    setForm((prev) => ({
      ...prev,
      requiredDocumentIds: prev.requiredDocumentIds.length ? prev.requiredDocumentIds : suggestedDocumentIds,
    }));
    setStep(1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const created = await createLaborRequest({
      ...form,
      activityTypeId: Number(form.activityTypeId),
      urgency: Number(form.urgency),
      idUser: user.id
    });
    if(!created.success){
      setErrorMessage(created.body.message);
      setIsSubmitting(false);
    } else{
      setIsSubmitting(false);
      navigate(ROUTES.laborRequests.detail(created.body.solicitacaoId));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Obra"
        title="Nova solicitacao de mão de obra"
        description="Ao enviar, o departamento de Suprimentos é notificado por e-mail para dar sequencia a cotação."
      />

      <WizardStepper steps={STEPS} activeStep={step} />

      <Card>
        <Card.Body>
          {step === 0 && (
            <div className={styles.grid}>
              <FormField label="Titulo da solicitacao" required className={styles.fullSpan}>
                <input value={form.title} onChange={updateField('title')} placeholder="Ex.: Equipe de instalacao eletrica - Torre B" />
              </FormField>

              <FormField label="Tipo de atividade" required>
                <select value={form.activityTypeId} onChange={updateField('activityTypeId')}>
                  <option value="" disabled>Selecione</option>
                  {activityOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Local da obra" required>
                <input value={form.location} onChange={updateField('location')} placeholder="Ex.: Torre B - Alphaville" />
              </FormField>

              <FormField label="Urgencia" required>
                <select value={form.urgency} onChange={updateField('urgency')}>
                  <option value={0}>Baixa</option>
                  <option value={1}>Normal</option>
                  <option value={2}>Alta</option>
                  <option value={3}>Urgente</option>
                </select>
              </FormField>

              <FormField label="Data prevista de inicio">
                <DatePicker
                  selected={form.startDate}
                  onChange={(date) => setForm((prev) => ({ ...prev, startDate: date }))}
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Selecione a data"
                  className={styles.dateInput}
                />
              </FormField>

              <FormField label="Observações" className={styles.fullSpan}>
                <textarea rows={3} value={form.description} onChange={updateField('description')} placeholder="Detalhes do escopo, riscos ja mapeados, etc." />
              </FormField>
            </div>
          )}

          {/*{step === 1 && (
            <div>
              {activity && (
                <Banner
                  tone="info"
                  title={`Sugestao para "${activity.name}"`}
                  description="Pre-selecionamos os documentos usualmente exigidos para esse tipo de atividade. Ajuste conforme necessario."
                />
              )}
              <div className={styles.checklistSpacer}>
                <DocumentChecklistPicker
                  selectedIds={form.requiredDocumentIds}
                  suggestedIds={suggestedDocumentIds}
                  onChange={(ids) => setForm((prev) => ({ ...prev, requiredDocumentIds: ids }))}
                />
              </div>
            </div>
          )}*/}

          {step === 1 && (
            <div className={styles.review}>
              <dl className={styles.reviewGrid}>
                <dt>Titulo</dt>
                <dd>{form.title || '-'}</dd>
                <dt>Atividade</dt>
                <dd>{activity?.name ?? '-'}</dd>
                <dt>Local</dt>
                <dd>{form.location || '-'}</dd>
                {/*<dt>Efetivo</dt>
                <dt>Documentos exigidos</dt>
                <dd>{form.requiredDocumentIds.length} documento(s) selecionado(s)</dd>*/}
              </dl>
              <Banner
                tone="success"
                title="Pronto para enviar"
                description="Suprimentos recebera um e-mail assim que você enviar esta solicitação."
              />
            </div>
          )}
        </Card.Body>
        <Card.Footer>
          {step > 0 && (
            <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep((current) => current - 1)}>
              Voltar
            </Button>
          )}
          {step === 0 && (
            <Button icon={LuArrowRight} iconPosition="right" onClick={goToDocumentsStep} disabled={!form.title || !form.activityTypeId || !form.location}>
              Continuar
            </Button>
          )}
          {/*{step === 1 && (
            <Button icon={LuArrowRight} iconPosition="right" onClick={() => setStep(2)}>
              Continuar
            </Button>
          )}*/}
          {step === 1 && (
            <Button icon={LuSend} onClick={handleSubmit} isLoading={isSubmitting}>
              Enviar solicitacao
            </Button>
          )}
        </Card.Footer>
      </Card>

      <ErrorDialog
        open={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        message={errorMessage}
      />
    </div>
  );
}
