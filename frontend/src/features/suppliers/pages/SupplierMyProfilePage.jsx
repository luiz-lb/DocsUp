import { useEffect, useState } from 'react';
import { LuBuilding2, LuKeyRound, LuSave, LuUsers } from 'react-icons/lu';
import { Card, Button, FormField, Banner, StatusBadge } from '../../../components/ui/index.js';
import SupplierLayout from '../components/SupplierLayout/index.js';
import SupplierPageHeader from '../components/SupplierPageHeader/index.js';
import {
  changeSupplierPassword,
  createSupplierUser,
  getSupplierProfile,
  updateSupplierCompany,
  updateSupplierUser,
} from '../api/suppliersApi.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import { SUPPLIER_USER_ROLE, SUPPLIER_USER_ROLE_ID } from '../../../constants/enums.js';
import { getPasswordPolicyError, isValidEmail, PASSWORD_RULE_HINT } from '../../../utils/validators.js';
import styles from './SupplierMyProfilePage.module.css';

/**
 * Perfil no portal do fornecedor:
 *  - Empresa: CNPJ e razão social fixos; nome fantasia (só o Responsável altera).
 *  - Usuários: cada um edita o próprio nome e e-mail; o Responsável também edita o Operador
 *    e pode definir uma nova senha para ele (ex.: o Operador mudou de pessoa).
 *  - Minha senha: troca a senha de quem está logado (as outras sessões dele caem).
 */
export default function SupplierMyProfilePage() {
  const { refresh } = useSupplierAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getSupplierProfile().then((data) => {
      if (!active) return;
      setProfile(data);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [reloadKey]);

  const reload = () => {
    setReloadKey((key) => key + 1);
    refresh();
  };

  const currentUser = profile?.users?.find((user) => user.id === profile.currentUserId) ?? null;
  const isOwner = currentUser?.role === SUPPLIER_USER_ROLE_ID.RESPONSAVEL;
  // Cadastro antigo pode ter ficado sem um dos dois usuários: dá para cadastrar o que falta
  const missingRoles = [SUPPLIER_USER_ROLE_ID.RESPONSAVEL, SUPPLIER_USER_ROLE_ID.OPERADOR]
    .filter((role) => !profile?.users?.some((user) => user.role === role));

  return (
    <SupplierLayout>
      <SupplierPageHeader
        title="Perfil da empresa"
        subtitle="Dados da empresa e das duas pessoas que entram no portal."
      />

      {isLoading ? (
        <p className={styles.loading}>Carregando perfil…</p>
      ) : !profile ? (
        <Banner tone="danger" description="Não foi possível carregar o perfil. Tente novamente." />
      ) : (
        <div className={styles.grid}>
          <CompanyCard supplier={profile.supplier} canEdit={isOwner} onSaved={reload} />

          <Card>
            <Card.Body>
              <h3 className={styles.sectionTitle}><LuUsers /> Usuários do portal</h3>
              <p className={styles.sectionNote}>
                Cada usuário entra com o próprio e-mail e senha. {isOwner
                  ? 'Como Responsável, você também pode alterar os dados do Operador.'
                  : 'Os dados do Responsável só ele altera.'}
              </p>
              {profile.users.map((user) => (
                <UserBlock
                  key={user.id}
                  user={user}
                  isSelf={user.id === profile.currentUserId}
                  canEdit={user.id === profile.currentUserId || isOwner}
                  canSetPassword={isOwner && user.id !== profile.currentUserId}
                  onSaved={reload}
                />
              ))}
              {missingRoles.map((role) => (
                <MissingUserBlock key={role} role={role} onSaved={reload} />
              ))}
            </Card.Body>
          </Card>

          <PasswordCard />
        </div>
      )}
    </SupplierLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empresa
// ─────────────────────────────────────────────────────────────────────────────

function CompanyCard({ supplier, canEdit, onSaved }) {
  const [nomeFantasia, setNomeFantasia] = useState(supplier.nome_fantasia ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSave = async () => {
    setFeedback(null);
    setIsSaving(true);
    const result = await updateSupplierCompany({ nomeFantasia: nomeFantasia.trim() || null });
    setIsSaving(false);
    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao salvar.' });
      return;
    }
    setFeedback({ tone: 'success', message: result.body?.message ?? 'Dados da empresa atualizados.' });
    onSaved();
  };

  return (
    <Card>
      <Card.Body>
        <h3 className={styles.sectionTitle}><LuBuilding2 /> Dados da empresa</h3>
        <div className={styles.fieldGrid}>
          <FormField label="Razão social">
            <input value={supplier.razao_social ?? ''} disabled readOnly />
          </FormField>
          <FormField label="CNPJ">
            <input value={supplier.cnpj ?? ''} disabled readOnly />
          </FormField>
          <FormField label="Nome fantasia" hint={canEdit ? undefined : 'Só o Responsável altera.'}>
            <input
              value={nomeFantasia}
              onChange={(event) => setNomeFantasia(event.target.value)}
              disabled={!canEdit}
              maxLength={300}
            />
          </FormField>
        </div>
        {feedback && <Banner tone={feedback.tone} className={styles.aviso} description={feedback.message} />}
        {canEdit && (
          <div className={styles.cardActions}>
            <Button icon={LuSave} size="sm" isLoading={isSaving} onClick={handleSave}>
              Salvar dados da empresa
            </Button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Usuário (Responsável / Operador)
// ─────────────────────────────────────────────────────────────────────────────

function UserBlock({ user, isSelf, canEdit, canSetPassword, onSaved }) {
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSave = async () => {
    setFeedback(null);
    if (!name.trim() || !isValidEmail(email.trim())) {
      setFeedback({ tone: 'danger', message: 'Informe o nome e um e-mail válido.' });
      return;
    }
    if (password) {
      const passwordError = getPasswordPolicyError(password);
      if (passwordError) {
        setFeedback({ tone: 'danger', message: passwordError });
        return;
      }
    }

    setIsSaving(true);
    const result = await updateSupplierUser(user.id, {
      name: name.trim(),
      email: email.trim(),
      ...(password ? { password } : {}),
    });
    setIsSaving(false);

    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao salvar.' });
      return;
    }
    setPassword('');
    setFeedback({ tone: 'success', message: result.body?.message ?? 'Dados atualizados.' });
    onSaved();
  };

  return (
    <div className={styles.contactBlock}>
      <p className={styles.contactLabel}>
        <StatusBadge enumMap={SUPPLIER_USER_ROLE} value={user.role} />
        {isSelf && <span className={styles.youTag}>você</span>}
      </p>
      <div className={styles.fieldGrid}>
        <FormField label="Nome" required>
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} maxLength={200} />
        </FormField>
        <FormField label="E-mail" required hint={canEdit ? 'É o login dele no portal.' : undefined}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!canEdit}
            maxLength={200}
          />
        </FormField>
        {canSetPassword && (
          <FormField
            label="Nova senha do Operador (opcional)"
            hint={`Use quando o Operador mudar de pessoa. ${PASSWORD_RULE_HINT}`}
            className={styles.spanTwo}
          >
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </FormField>
        )}
      </div>
      {feedback && <Banner tone={feedback.tone} className={styles.aviso} description={feedback.message} />}
      {canEdit && (
        <div className={styles.cardActions}>
          <Button icon={LuSave} size="sm" variant="secondary" isLoading={isSaving} onClick={handleSave}>
            Salvar {user.role === SUPPLIER_USER_ROLE_ID.RESPONSAVEL ? 'Responsável' : 'Operador'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Usuário que falta (cadastro antigo)
// ─────────────────────────────────────────────────────────────────────────────

function MissingUserBlock({ role, onSaved }) {
  const label = SUPPLIER_USER_ROLE[role]?.label ?? 'Usuário';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async () => {
    setFeedback(null);
    if (!form.name.trim() || !isValidEmail(form.email.trim())) {
      setFeedback({ tone: 'danger', message: 'Informe o nome e um e-mail válido.' });
      return;
    }
    const passwordError = getPasswordPolicyError(form.password);
    if (passwordError) {
      setFeedback({ tone: 'danger', message: passwordError });
      return;
    }
    setIsSaving(true);
    const result = await createSupplierUser({
      role,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    setIsSaving(false);
    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao cadastrar.' });
      return;
    }
    onSaved();
  };

  return (
    <div className={styles.contactBlock}>
      <p className={styles.contactLabel}>
        <StatusBadge enumMap={SUPPLIER_USER_ROLE} value={role} />
        <span className={styles.youTag}>não cadastrado</span>
      </p>
      <p className={styles.sectionNote}>
        A empresa ainda não tem {label}. Cadastre o nome, o e-mail e uma senha inicial para ele entrar no portal.
      </p>
      <div className={styles.fieldGrid}>
        <FormField label="Nome" required>
          <input value={form.name} onChange={setField('name')} maxLength={200} />
        </FormField>
        <FormField label="E-mail" required>
          <input type="email" value={form.email} onChange={setField('email')} maxLength={200} />
        </FormField>
        <FormField label="Senha inicial" required hint={PASSWORD_RULE_HINT} className={styles.spanTwo}>
          <input type="password" value={form.password} onChange={setField('password')} autoComplete="new-password" />
        </FormField>
      </div>
      {feedback && <Banner tone={feedback.tone} className={styles.aviso} description={feedback.message} />}
      <div className={styles.cardActions}>
        <Button icon={LuSave} size="sm" variant="secondary" isLoading={isSaving} onClick={handleSave}>
          Cadastrar {label}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Minha senha
// ─────────────────────────────────────────────────────────────────────────────

function PasswordCard() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const setField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSave = async () => {
    setFeedback(null);
    const passwordError = getPasswordPolicyError(form.next);
    if (!form.current) {
      setFeedback({ tone: 'danger', message: 'Informe a senha atual.' });
      return;
    }
    if (passwordError) {
      setFeedback({ tone: 'danger', message: passwordError });
      return;
    }
    if (form.next !== form.confirm) {
      setFeedback({ tone: 'danger', message: 'A confirmação não confere com a nova senha.' });
      return;
    }

    setIsSaving(true);
    const result = await changeSupplierPassword(form.current, form.next);
    setIsSaving(false);
    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao trocar a senha.' });
      return;
    }
    setForm({ current: '', next: '', confirm: '' });
    setFeedback({ tone: 'success', message: 'Senha alterada. As outras sessões abertas com o seu e-mail foram encerradas.' });
  };

  return (
    <Card>
      <Card.Body>
        <h3 className={styles.sectionTitle}><LuKeyRound /> Minha senha</h3>
        <div className={styles.fieldGrid}>
          <FormField label="Senha atual" required className={styles.spanTwo}>
            <input type="password" value={form.current} onChange={setField('current')} autoComplete="current-password" />
          </FormField>
          <FormField label="Nova senha" required hint={PASSWORD_RULE_HINT}>
            <input type="password" value={form.next} onChange={setField('next')} autoComplete="new-password" />
          </FormField>
          <FormField label="Confirmar nova senha" required>
            <input type="password" value={form.confirm} onChange={setField('confirm')} autoComplete="new-password" />
          </FormField>
        </div>
        {feedback && <Banner tone={feedback.tone} className={styles.aviso} description={feedback.message} />}
        <div className={styles.cardActions}>
          <Button icon={LuKeyRound} size="sm" isLoading={isSaving} onClick={handleSave}>
            Trocar senha
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
