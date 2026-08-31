import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowLeft, LuArrowRight, LuCheck, LuLoaderCircle } from 'react-icons/lu';
import { Card, Button, FormField, Banner, WizardStepper } from '../../../components/ui/index.js';
import { SERVICE_CATEGORIES, REGIONS } from '../../../mocks/catalog.js';
import { validateCnpj, registerSupplier } from '../api/suppliersApi.js';
import CnpjField from '../components/CnpjField.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './SupplierRegisterPage.module.css';

const STEPS = ['CNPJ', 'Contatos', 'Atuacao', 'Revisao'];

const INITIAL = {
  cnpj: '',
  cnpjCheck: null,
  razaoSocial: '',
  legalEmail: '',
  operationalEmail: '',
  categoryIds: [],
  regionIds: [],
  employeeCount: '',
};

export default function SupplierRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [isValidatingCnpj, setIsValidatingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidateCnpj = async () => {
    setIsValidatingCnpj(true);
    const result = await validateCnpj(form.cnpj);
    setIsValidatingCnpj(false);
    setForm((prev) => ({ ...prev, cnpjCheck: result, razaoSocial: result.razaoSocial ?? '' }));
    if (result.valid) setStep(1);
  };

  const toggleId = (field, id) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((item) => item !== id) : [...prev[field], id],
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await registerSupplier({
      cnpj: form.cnpj,
      razaoSocial: form.razaoSocial,
      employeeCount: Number(form.employeeCount) || 0,
      categoryIds: form.categoryIds,
      regionIds: form.regionIds,
      contacts: [
        { name: '', email: form.legalEmail, type: 0 },
        { name: '', email: form.operationalEmail, type: 1 },
      ],
    });
    setIsSubmitting(false);
    navigate(ROUTES.suppliers.login);
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={authStyles.title}>Cadastro de fornecedor</h1>
        <p className={authStyles.subtitle}>Esses dados sao revisados a cada 6 meses para manter o cadastro atualizado.</p>

        <WizardStepper steps={STEPS} activeStep={step} />

        {step === 0 && (
          <div className={authStyles.form}>
            <CnpjField value={form.cnpj} onChange={(cnpj) => setForm((prev) => ({ ...prev, cnpj }))} />
            {form.cnpjCheck && !form.cnpjCheck.valid && (
              <Banner tone="danger" description="CNPJ invalido. Verifique os digitos informados." />
            )}
            <Button
              icon={isValidatingCnpj ? LuLoaderCircle : LuArrowRight}
              iconPosition="right"
              onClick={handleValidateCnpj}
              isLoading={isValidatingCnpj}
              fullWidth
            >
              Validar CNPJ
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className={authStyles.form}>
            <Banner tone="info" description={`Razao social identificada: ${form.razaoSocial}`} />
            <FormField label="E-mail do responsavel legal" required>
              <input type="email" value={form.legalEmail} onChange={(event) => setForm((prev) => ({ ...prev, legalEmail: event.target.value }))} />
            </FormField>
            <FormField label="E-mail do responsavel operacional" required>
              <input type="email" value={form.operationalEmail} onChange={(event) => setForm((prev) => ({ ...prev, operationalEmail: event.target.value }))} />
            </FormField>
            <div className={styles.actionsRow}>
              <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep(0)}>Voltar</Button>
              <Button icon={LuArrowRight} iconPosition="right" onClick={() => setStep(2)} disabled={!form.legalEmail || !form.operationalEmail}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={authStyles.form}>
            <FormField label="Quantidade de funcionarios" required>
              <input type="number" min="0" value={form.employeeCount} onChange={(event) => setForm((prev) => ({ ...prev, employeeCount: event.target.value }))} />
            </FormField>

            <span className={styles.groupLabel}>Especialidade / categoria de servico</span>
            <div className={styles.chipRow}>
              {SERVICE_CATEGORIES.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={cn(styles.chip, form.categoryIds.includes(category.id) && styles.chipActive)}
                  onClick={() => toggleId('categoryIds', category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <span className={styles.groupLabel}>Regioes atendidas</span>
            <div className={styles.chipRow}>
              {REGIONS.map((region) => (
                <button
                  type="button"
                  key={region.id}
                  className={cn(styles.chip, form.regionIds.includes(region.id) && styles.chipActive)}
                  onClick={() => toggleId('regionIds', region.id)}
                >
                  {region.city}/{region.state}
                </button>
              ))}
            </div>

            <div className={styles.actionsRow}>
              <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep(1)}>Voltar</Button>
              <Button icon={LuArrowRight} iconPosition="right" onClick={() => setStep(3)}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={authStyles.form}>
            <Banner
              tone="success"
              title="Cadastro pronto para envio"
              description="Apos concluir, defina uma senha de acesso e envie os documentos da empresa na proxima etapa."
            />
            <div className={styles.actionsRow}>
              <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep(2)}>Voltar</Button>
              <Button icon={LuCheck} onClick={handleSubmit} isLoading={isSubmitting}>Concluir cadastro</Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
