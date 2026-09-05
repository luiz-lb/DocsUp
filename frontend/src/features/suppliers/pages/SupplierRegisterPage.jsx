import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuArrowLeft, LuArrowRight, LuCheck, LuLoaderCircle, LuMapPin } from 'react-icons/lu';
import { Card, Button, FormField, Banner, WizardStepper } from '../../../components/ui/index.js';
import {
  validateCnpj,
  registerSupplier,
  getActivityTypesPublic,
  searchRegions,
  getRegionIdsByState,
} from '../api/suppliersApi.js';
import CnpjField from '../components/CnpjField.jsx';
import SearchSelectList from '../components/SearchSelectList/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './SupplierRegisterPage.module.css';

const STEPS = ['CNPJ', 'Contatos', 'Atuação', 'Senha', 'Revisão'];

// UFs do Brasil para o seletor de "estado inteiro"
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

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
  // Listas de selecionados guardam { id, label, sublabel } para exibir na lista
  activities: [],
  regions: [],
  employeeCount: '',
  password: '',
  passwordConfirm: '',
};

export default function SupplierRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Token de proposta propagado do login: preserva o fluxo até a cotação
  const tokenProposta = searchParams.get('tokenProposta');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [isValidatingCnpj, setIsValidatingCnpj] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Estado inteiro
  const [wholeStateUf, setWholeStateUf] = useState('');
  const [isAddingState, setIsAddingState] = useState(false);

  const setField = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // ── CNPJ ────────────────────────────────────────────────────────────────
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

  // ── Atividades: fetch para o autocomplete ────────────────────────────────
  const fetchActivities = useCallback(async (query) => {
    const list = await getActivityTypesPublic();
    const q = query.toLowerCase();
    return list
      .filter((a) => a.name.toLowerCase().includes(q))
      .map((a) => ({ id: a.id, label: a.name }));
  }, []);

  // ── Regiões: fetch para o autocomplete (busca por cidade) ─────────────────
  const fetchRegions = useCallback(async (query) => {
    const list = await searchRegions({ city: query });
    return list.map((r) => ({ id: r.id, label: r.city, sublabel: r.state }));
  }, []);

  // ── Adicionar/remover itens das listas ────────────────────────────────────
  const addActivity = (item) =>
    setForm((prev) => ({ ...prev, activities: [...prev.activities, item] }));

  const removeActivity = (id) =>
    setForm((prev) => ({ ...prev, activities: prev.activities.filter((a) => a.id !== id) }));

  const addRegion = (item) =>
    setForm((prev) => ({ ...prev, regions: [...prev.regions, item] }));

  const removeRegion = (id) =>
    setForm((prev) => ({ ...prev, regions: prev.regions.filter((r) => r.id !== id) }));

  // ── Adicionar estado inteiro ──────────────────────────────────────────────
  const handleAddWholeState = async () => {
    if (!wholeStateUf) return;
    setIsAddingState(true);

    // Busca todas as regiões do estado (para ter os labels de cidade)
    const regions = await searchRegions({ state: wholeStateUf });
    setIsAddingState(false);

    setForm((prev) => {
      const existingIds = new Set(prev.regions.map((r) => r.id));
      const toAdd = regions
        .filter((r) => !existingIds.has(r.id))
        .map((r) => ({ id: r.id, label: r.city, sublabel: r.state }));
      return { ...prev, regions: [...prev.regions, ...toAdd] };
    });
    setWholeStateUf('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
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
      // Envia apenas os IDs para o backend
      categoryIds: form.activities.map((a) => a.id),
      regionIds: form.regions.map((r) => r.id),
      contacts: [
        {
          name: form.legalName,
          email: form.legalEmail,
          phone: form.legalPhone,
          contactType: 0,
          isPrimary: true,
        },
        {
          name: form.operationalName,
          email: form.operationalEmail,
          phone: form.operationalPhone,
          contactType: 1,
          isPrimary: false,
        },
      ].filter((c) => c.email),
    });

    setIsSubmitting(false);

    if (!result.success) {
      setSubmitError(result.body?.message ?? 'Erro ao cadastrar. Tente novamente.');
      return;
    }

    // Volta ao login preservando o token de proposta (se houver)
    navigate(
      tokenProposta
        ? `${ROUTES.suppliers.login}?tokenProposta=${tokenProposta}`
        : ROUTES.suppliers.login,
    );
  };

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        <p className={authStyles.eyebrow}>Portal do Fornecedor</p>
        <h1 className={authStyles.title}>Cadastro de fornecedor</h1>
        <p className={authStyles.subtitle}>
          Esses dados são revisados a cada 6 meses para manter o cadastro atualizado.
        </p>

        <WizardStepper steps={STEPS} activeStep={step} tone="dark" />

        {/* ── Step 0: Empresa + CNPJ ── */}
        {step === 0 && (
          <div className={authStyles.form}>
            <FormField label="Nome Fantasia" required>
              <input value={form.nomeFantasia} onChange={setField('nomeFantasia')} placeholder="Nome fantasia" />
            </FormField>
            <FormField label="Razão Social" required>
              <input value={form.razaoSocial} onChange={setField('razaoSocial')} placeholder="Razão social" />
            </FormField>

            {/* Cidade e estado da empresa */}
            <div className={styles.cityStateRow}>
              <FormField label="Cidade" className={styles.cityField}>
                <input value={form.city} onChange={setField('city')} placeholder="Ex.: São Paulo" />
              </FormField>
              <FormField label="Estado (UF)" className={styles.stateField}>
                <select value={form.state} onChange={setField('state')}>
                  <option value="">—</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </FormField>
            </div>

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
              <Button variant="ghost" className={styles.backButton} icon={LuArrowLeft} onClick={() => setStep(0)}>Voltar</Button>
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

        {/* ── Step 2: Atuação (busca + listas) ── */}
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

            {/* Atividades — busca por nome */}
            <SearchSelectList
              label="Especialidade / atividade de serviço"
              placeholder="Pesquisar atividade…"
              selected={form.activities}
              onAdd={addActivity}
              onRemove={removeActivity}
              fetchOptions={fetchActivities}
              emptyHint="Nenhuma atividade adicionada ainda."
            />

            {/* Regiões — busca por cidade + adicionar estado inteiro */}
            <SearchSelectList
              label="Regiões atendidas"
              placeholder="Pesquisar cidade…"
              selected={form.regions}
              onAdd={addRegion}
              onRemove={removeRegion}
              fetchOptions={fetchRegions}
              emptyHint="Nenhuma cidade adicionada ainda."
              extraAction={
                <div className={styles.wholeStateWrap}>
                  <select
                    value={wholeStateUf}
                    onChange={(e) => setWholeStateUf(e.target.value)}
                    className={styles.wholeStateSelect}
                    aria-label="Selecionar estado inteiro"
                  >
                    <option value="">Estado inteiro…</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={isAddingState ? LuLoaderCircle : LuMapPin}
                    onClick={handleAddWholeState}
                    isLoading={isAddingState}
                    disabled={!wholeStateUf}
                  >
                    Adicionar
                  </Button>
                </div>
              }
            />

            <div className={styles.actionsRow}>
              <Button variant="ghost" className={styles.backButton} icon={LuArrowLeft} onClick={() => setStep(1)}>Voltar</Button>
              <Button
                icon={LuArrowRight}
                iconPosition="right"
                onClick={() => setStep(3)}
                disabled={form.activities.length === 0}
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
              <Button variant="ghost" className={styles.backButton} icon={LuArrowLeft} onClick={() => setStep(2)}>Voltar</Button>
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
              <dt>Localização</dt>
              <dd>{form.city && form.state ? `${form.city}/${form.state}` : '—'}</dd>
              <dt>Responsável legal</dt>
              <dd>{form.legalEmail}</dd>
              <dt>Responsável operacional</dt>
              <dd>{form.operationalEmail}</dd>
              <dt>Funcionários</dt>
              <dd>{form.employeeCount || '—'}</dd>
              <dt>Atividades</dt>
              <dd>{form.activities.length} selecionada(s)</dd>
              <dt>Regiões</dt>
              <dd>{form.regions.length} cidade(s)</dd>
            </dl>

            {submitError && <Banner tone="danger" description={submitError} />}

            <div className={styles.actionsRow}>
              <Button variant="ghost" className={styles.backButton} icon={LuArrowLeft} onClick={() => setStep(3)}>Voltar</Button>
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
