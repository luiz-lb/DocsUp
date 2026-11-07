import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuArrowLeft, LuArrowRight, LuCheck, LuLogIn, LuSearch } from 'react-icons/lu';
import { Card, Button, FormField, Banner, WizardStepper } from '../../../components/ui/index.js';
import { validateCnpj, registerSupplier } from '../api/suppliersApi.js';
import CnpjField from '../components/CnpjField.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import { getPasswordPolicyError, isValidCnpj, isValidEmail, PASSWORD_RULE_HINT } from '../../../utils/validators.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './SupplierRegisterPage.module.css';

const STEPS = ['Empresa', 'Usuários', 'Senha'];

const INITIAL = {
  cnpj: '',
  cnpjCheck: null,
  razaoSocial: '',
  nomeFantasia: '',
  ownerName: '',
  ownerEmail: '',
  operatorName: '',
  operatorEmail: '',
  password: '',
  passwordConfirm: '',
};

/**
 * Cadastro do fornecedor em 3 etapas:
 *  1. Empresa: CNPJ (conferido na Receita, que preenche a razão social) e nome fantasia.
 *  2. Usuários: Responsável (dono) e Operador, com nome e e-mail. Os dois entram no portal.
 *  3. Senha: senha inicial dos dois usuários (cada um troca a sua depois, no Perfil).
 *
 * O token da URL (?fase2) vem do link do convite aberto sem cadastro: volta para o login,
 * que depois leva de volta ao contrato.
 */
export default function SupplierRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fase2Token = searchParams.get('fase2');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [isValidatingCnpj, setIsValidatingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const loginUrl = () => (fase2Token
    ? `${ROUTES.suppliers.login}?fase2=${encodeURIComponent(fase2Token)}`
    : ROUTES.suppliers.login);

  const goTo = (nextStep) => {
    setError('');
    setStep(nextStep);
  };

  // ── Etapa 1: CNPJ ───────────────────────────────────────────────────────
  const handleValidateCnpj = async () => {
    setError('');
    if (!isValidCnpj(form.cnpj)) {
      setForm((prev) => ({ ...prev, cnpjCheck: { valid: false } }));
      return;
    }
    setIsValidatingCnpj(true);
    const result = await validateCnpj(form.cnpj);
    setIsValidatingCnpj(false);

    setForm((prev) => ({
      ...prev,
      cnpjCheck: result,
      razaoSocial: result.razaoSocial ?? prev.razaoSocial,
      nomeFantasia: result.nomeFantasia ?? prev.nomeFantasia,
    }));
  };

  const cnpjChecked = form.cnpjCheck?.valid && !form.cnpjCheck?.alreadyRegistered;

  const handleCompanyNext = () => {
    if (!cnpjChecked) {
      setError('Valide o CNPJ para continuar.');
      return;
    }
    if (!form.razaoSocial.trim()) {
      setError('Informe a razão social.');
      return;
    }
    goTo(1);
  };

  // ── Etapa 2: usuários ───────────────────────────────────────────────────
  const handleUsersNext = () => {
    if (!form.ownerName.trim() || !isValidEmail(form.ownerEmail.trim())) {
      setError('Informe o nome e um e-mail válido do Responsável.');
      return;
    }
    if (!form.operatorName.trim() || !isValidEmail(form.operatorEmail.trim())) {
      setError('Informe o nome e um e-mail válido do Operador.');
      return;
    }
    if (form.ownerEmail.trim().toLowerCase() === form.operatorEmail.trim().toLowerCase()) {
      setError('O Responsável e o Operador precisam ter e-mails diferentes.');
      return;
    }
    goTo(2);
  };

  // ── Etapa 3: senha e envio ──────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    const passwordError = getPasswordPolicyError(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    const result = await registerSupplier({
      cnpj: form.cnpj,
      razaoSocial: form.razaoSocial.trim(),
      nomeFantasia: form.nomeFantasia.trim() || null,
      owner: { name: form.ownerName.trim(), email: form.ownerEmail.trim() },
      operator: { name: form.operatorName.trim(), email: form.operatorEmail.trim() },
      password: form.password,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao cadastrar. Tente novamente.');
      return;
    }

    // Login com o e-mail do Responsável já preenchido (os tokens do link seguem junto)
    navigate(loginUrl(), { state: { registeredEmail: form.ownerEmail.trim().toLowerCase() } });
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={authStyles.title}>Cadastro de fornecedor</h1>
        <p className={authStyles.subtitle}>
          Três passos: a empresa, as duas pessoas que vão usar o portal e a senha de acesso.
        </p>

        <WizardStepper steps={STEPS} activeStep={step} tone="dark" />

        {/* ── Etapa 1: Empresa ── */}
        {step === 0 && (
          <div className={authStyles.form}>
            <CnpjField
              value={form.cnpj}
              onChange={(cnpj) => setForm((prev) => ({ ...prev, cnpj, cnpjCheck: null }))}
            />
            {form.cnpjCheck && !form.cnpjCheck.valid && (
              <Banner tone="danger" description="CNPJ inválido ou não encontrado. Confira os dígitos." />
            )}
            {form.cnpjCheck?.valid && form.cnpjCheck.alreadyRegistered && (
              <Banner
                tone="warning"
                title="Este CNPJ já tem cadastro"
                description="Entre com o e-mail do Responsável ou do Operador da empresa."
              />
            )}
            {!cnpjChecked && (
              <Button
                icon={LuSearch}
                onClick={handleValidateCnpj}
                isLoading={isValidatingCnpj}
                disabled={form.cnpj.replace(/\D/g, '').length !== 14}
                fullWidth
              >
                Validar CNPJ
              </Button>
            )}
            {form.cnpjCheck?.valid && form.cnpjCheck.alreadyRegistered && (
              <Button variant="secondary" icon={LuLogIn} onClick={() => navigate(loginUrl())} fullWidth>
                Ir para o login
              </Button>
            )}

            {cnpjChecked && (
              <>
                <FormField label="Razão social" required>
                  <input value={form.razaoSocial} onChange={setField('razaoSocial')} placeholder="Razão social" maxLength={300} />
                </FormField>
                <FormField label="Nome fantasia">
                  <input value={form.nomeFantasia} onChange={setField('nomeFantasia')} placeholder="Opcional" maxLength={300} />
                </FormField>
              </>
            )}

            {error && <Banner tone="danger" description={error} />}

            {cnpjChecked && (
              <div className={styles.actionsRow}>
                <span />
                <Button icon={LuArrowRight} iconPosition="right" onClick={handleCompanyNext}>
                  Continuar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Etapa 2: Usuários ── */}
        {step === 1 && (
          <div className={authStyles.form}>
            <div className={styles.companyBanner}>
              <Banner tone="info" description={`${form.razaoSocial} · CNPJ ${form.cnpj}`} />
            </div>

            <span className={styles.groupLabel}>Responsável (dono da empresa)</span>
            <FormField label="Nome" required>
              <input value={form.ownerName} onChange={setField('ownerName')} placeholder="Nome completo" maxLength={200} />
            </FormField>
            <FormField label="E-mail" required hint="Usado para entrar no portal.">
              <input type="email" value={form.ownerEmail} onChange={setField('ownerEmail')} maxLength={200} autoComplete="email" />
            </FormField>

            <span className={styles.groupLabel}>Operador (quem envia os documentos)</span>
            <FormField label="Nome" required>
              <input value={form.operatorName} onChange={setField('operatorName')} placeholder="Nome completo" maxLength={200} />
            </FormField>
            <FormField label="E-mail" required hint="Precisa ser diferente do e-mail do Responsável.">
              <input type="email" value={form.operatorEmail} onChange={setField('operatorEmail')} maxLength={200} />
            </FormField>

            {error && <Banner tone="danger" description={error} />}

            <div className={styles.actionsRow}>
              <Button variant="ghost" className={styles.backButton} icon={LuArrowLeft} onClick={() => goTo(0)}>Voltar</Button>
              <Button icon={LuArrowRight} iconPosition="right" onClick={handleUsersNext}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── Etapa 3: Senha ── */}
        {step === 2 && (
          <div className={authStyles.form}>
            <Banner
              tone="info"
              description="Esta é a senha inicial do Responsável e do Operador. Depois de entrar, cada um pode trocar a sua no Perfil."
            />
            <FormField label="Senha" required hint={PASSWORD_RULE_HINT}>
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

            <dl className={styles.reviewGrid}>
              <dt>Empresa</dt>
              <dd>{form.razaoSocial}</dd>
              <dt>CNPJ</dt>
              <dd>{form.cnpj}</dd>
              <dt>Responsável</dt>
              <dd>{form.ownerName} · {form.ownerEmail.trim().toLowerCase()}</dd>
              <dt>Operador</dt>
              <dd>{form.operatorName} · {form.operatorEmail.trim().toLowerCase()}</dd>
            </dl>

            {error && <Banner tone="danger" description={error} />}

            <div className={styles.actionsRow}>
              <Button variant="ghost" className={styles.backButton} icon={LuArrowLeft} onClick={() => goTo(1)}>Voltar</Button>
              <Button
                icon={LuCheck}
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={!form.password || !form.passwordConfirm}
              >
                Concluir cadastro
              </Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
