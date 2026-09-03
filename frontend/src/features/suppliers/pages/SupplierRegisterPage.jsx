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

const STEPS = ['CNPJ', 'Contatos', 'Atuação', 'Senha', 'Revisão'];

const INITIAL = {
  cnpj: '',
  cnpjCheck: null,
  razaoSocial: '',
  nomeFantasia: '',
  city: '',
  state: '',
  legalName: '',
  legalEmail: '',
  legalPhone: '',
  operationalName: '',
  operationalEmail: '',
  operationalPhone: '',
  categoryIds: [],
  regionIds: [],
  employeeCount: '',
  password: '',
  passwordConfirm: '',
};

export default function SupplierRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [isValidatingCnpj, setIsValidatingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const setField = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleValidateCnpj = async () => {
    setIsValidatingCnpj(true);
    const result = await validateCnpj(form.cnpj);
    setIsValidatingCnpj(false);

    setForm((prev) => ({
      ...prev,
      cnpjCheck: result,
      razaoSocial: result.razaoSocial ?? prev.razaoSocial,
      nomeFantasia: result.nomeFantasia ?? prev.nomeFantasia,
      city: result.municipio ?? prev.city,
      state: result.uf ?? prev.state,
    }));

    if (result.valid) setStep(1);
  };

  const toggleId = (field, id) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter((item) => item !== id)
        : [...prev[field], id],
    }));
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (form.password !== form.passwordConfirm) {
      setSubmitError('As senhas não coincidem.');
      return;
    }
    if (form.password.length < 8) {
      setSubmitError('A senha deve ter ao menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);

    const result = await registerSupplier({
      cnpj: form.cnpj,
      razaoSocial: form.razaoSocial,
      nomeFantasia: form.nomeFantasia,
      password: form.password,
      employeeCount: Number(form.employeeCount) || null,
      city: form.city,
      state: form.state,
      categoryIds: form.categoryIds,
      regionIds: form.regionIds,
      contacts: [
        {
          name: form.legalName,
          email: form.legalEmail,
          phone: form.legalPhone,
          contactType: 0,  // Legal
          isPrimary: true,
        },
        {
          name: form.operationalName,
          email: form.operationalEmail,
          phone: form.operationalPhone,
          contactType: 1,  // Operacional
          isPrimary: false,
        },
      ].filter((c) => c.email), // remove contato sem email
    });

    setIsSubmitting(false);

    if (!result.success) {
      setSubmitError(result.body?.message ?? 'Erro ao cadastrar. Tente novamente.');
      return;
    }

    navigate(ROUTES.suppliers.login);
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={authStyles.title}>Cadastro de fornecedor</h1>
        <p className={authStyles.subtitle}>
          Esses dados são revisados a cada 6 meses para manter o cadastro atualizado.
        </p>

        <WizardStepper steps={STEPS} activeStep={step} />

        {/* ── Step 0: CNPJ ── */}
        {step === 0 && (
          <div className={authStyles.form}>
            <FormField label="Razão Social" required>
              <input value={form.razaoSocial} onChange={setField('razaoSocial')} placeholder="Razão social" />
            </FormField>
            <CnpjField
              value={form.cnpj}
              onChange={(cnpj) => setForm((prev) => ({ ...prev, cnpj }))}
            />
            {form.cnpjCheck && !form.cnpjCheck.valid && (
              <Banner tone="danger" description="CNPJ inválido ou não encontrado. Verifique os dígitos." />
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

        {/* ── Step 1: Contatos ── */}
        {step === 1 && (
          <div className={authStyles.form}>
            {form.razaoSocial && (
              <Banner tone="info" description={`Razão social: ${form.razaoSocial}`} />
            )}

            <span className={styles.groupLabel}>Responsável legal</span>
            <FormField label="Nome" required>
              <input value={form.legalName} onChange={setField('legalName')} placeholder="Nome completo" />
            </FormField>
            <FormField label="E-mail" required>
              <input type="email" value={form.legalEmail} onChange={setField('legalEmail')} />
            </FormField>
            <FormField label="Telefone">
              <input value={form.legalPhone} onChange={setField('legalPhone')} placeholder="(11) 99999-9999" />
            </FormField>

            <span className={styles.groupLabel}>Responsável operacional</span>
            <FormField label="Nome">
              <input value={form.operationalName} onChange={setField('operationalName')} placeholder="Nome completo" />
            </FormField>
            <FormField label="E-mail" required>
              <input type="email" value={form.operationalEmail} onChange={setField('operationalEmail')} />
            </FormField>
            <FormField label="Telefone">
              <input value={form.operationalPhone} onChange={setField('operationalPhone')} placeholder="(11) 99999-9999" />
            </FormField>

            <div className={styles.actionsRow}>
              <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep(0)}>Voltar</Button>
              <Button
                icon={LuArrowRight}
                iconPosition="right"
                onClick={() => setStep(2)}
                disabled={!form.legalEmail || !form.operationalEmail}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Atuação ── */}
        {step === 2 && (
          <div className={authStyles.form}>
            <FormField label="Quantidade de funcionários" required>
              <input
                type="number"
                min="0"
                value={form.employeeCount}
                onChange={setField('employeeCount')}
                placeholder="Ex.: 25"
              />
            </FormField>

            <span className={styles.groupLabel}>Especialidade / categoria de serviço</span>
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

            <span className={styles.groupLabel}>Regiões atendidas</span>
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
              <Button
                icon={LuArrowRight}
                iconPosition="right"
                onClick={() => setStep(3)}
                disabled={form.categoryIds.length === 0}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Senha ── */}
        {step === 3 && (
          <div className={authStyles.form}>
            <Banner
              tone="info"
              description="Esta senha será usada para acessar o portal do fornecedor. Guarde-a em local seguro."
            />
            <FormField label="Senha" required hint="Mínimo de 8 caracteres.">
              <input
                type="password"
                value={form.password}
                onChange={setField('password')}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirmar senha" required>
              <input
                type="password"
                value={form.passwordConfirm}
                onChange={setField('passwordConfirm')}
                autoComplete="new-password"
              />
            </FormField>

            <div className={styles.actionsRow}>
              <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep(2)}>Voltar</Button>
              <Button
                icon={LuArrowRight}
                iconPosition="right"
                onClick={() => setStep(4)}
                disabled={form.password.length < 8 || form.password !== form.passwordConfirm}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Revisão ── */}
        {step === 4 && (
          <div className={authStyles.form}>
            <Banner
              tone="success"
              title="Cadastro pronto para envio"
              description="Após concluir, use o CNPJ e a senha definida para entrar no portal."
            />

            <dl className={styles.reviewGrid}>
              <dt>CNPJ</dt>
              <dd>{form.cnpj}</dd>
              <dt>Razão social</dt>
              <dd>{form.razaoSocial}</dd>
              <dt>Responsável legal</dt>
              <dd>{form.legalEmail}</dd>
              <dt>Responsável operacional</dt>
              <dd>{form.operationalEmail}</dd>
              <dt>Funcionários</dt>
              <dd>{form.employeeCount || '—'}</dd>
            </dl>

            {submitError && <Banner tone="danger" description={submitError} />}

            <div className={styles.actionsRow}>
              <Button variant="ghost" icon={LuArrowLeft} onClick={() => setStep(3)}>Voltar</Button>
              <Button icon={LuCheck} onClick={handleSubmit} isLoading={isSubmitting}>
                Concluir cadastro
              </Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
