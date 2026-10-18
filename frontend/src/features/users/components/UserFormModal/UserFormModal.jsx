import { useEffect, useState } from 'react';
import { LuSave } from 'react-icons/lu';
import { Modal, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { DEPARTMENT, DEPARTMENT_ID } from '../../../../constants/enums.js';
import { isValidEmail, getPasswordPolicyError, PASSWORD_RULE_HINT } from '../../../../utils/validators.js';
import { createUser, updateUser } from '../../api/usersApi.js';
import styles from './UserFormModal.module.css';

const EMPTY_FORM = { name: '', email: '', department: '', password: '', confirmPassword: '' };

/**
 * Criação e edição de usuário interno (tela só do Admin).
 * Na edição não há senha: a redefinição é feita no ResetPasswordModal.
 *
 * Props:
 *  - open          : boolean
 *  - mode          : 'create' | 'edit'
 *  - user          : usuário em edição (mode 'edit')
 *  - currentUserId : id do usuário logado (para avisar quando ele edita a si mesmo)
 *  - onClose       : () => void
 *  - onSuccess     : (user, mode) => void
 */
export default function UserFormModal({ open, mode = 'create', user, currentUserId, onClose, onSuccess }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preenche o formulário a cada abertura
  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      isEdit && user
        ? { ...EMPTY_FORM, name: user.name ?? '', email: user.email ?? '', department: String(user.department ?? '') }
        : EMPTY_FORM,
    );
  }, [open, isEdit, user]);

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // Mesmas regras do backend (que valida de novo)
  const validate = () => {
    if (!form.name.trim()) return 'Informe o nome.';
    if (!isValidEmail(form.email.trim())) return 'Informe um e-mail válido.';
    if (form.department === '') return 'Selecione o departamento.';
    if (!isEdit) {
      const passwordError = getPasswordPolicyError(form.password);
      if (passwordError) return passwordError;
      if (form.password !== form.confirmPassword) return 'As senhas não conferem.';
    }
    return null;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);
    const payload = { name: form.name.trim(), email: form.email.trim(), department: Number(form.department) };
    const result = isEdit
      ? await updateUser(user.id, payload)
      : await createUser({ ...payload, password: form.password });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao salvar o usuário.');
      return;
    }

    onSuccess?.(result.body?.user, mode);
  };

  const isSelf = isEdit && user?.id === currentUserId;
  const isLeavingAdmin = isSelf && form.department !== '' && Number(form.department) !== DEPARTMENT_ID.ADMIN;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar usuário' : 'Novo usuário'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuSave} isLoading={isSubmitting} onClick={handleSubmit}>
            {isEdit ? 'Salvar' : 'Criar usuário'}
          </Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <FormField label="Nome" required>
          <input value={form.name} onChange={updateField('name')} maxLength={200} />
        </FormField>

        <FormField label="E-mail corporativo" required hint="É o login do usuário.">
          <input type="email" value={form.email} onChange={updateField('email')} maxLength={200} />
        </FormField>

        <FormField label="Departamento" required hint="Define o que o usuário vê e pode fazer no sistema.">
          <select value={form.department} onChange={updateField('department')}>
            <option value="">Selecione…</option>
            {Object.entries(DEPARTMENT).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        {!isEdit && (
          <>
            <FormField label="Senha" required hint={PASSWORD_RULE_HINT}>
              <input type="password" value={form.password} onChange={updateField('password')} autoComplete="new-password" />
            </FormField>
            <FormField label="Confirmar senha" required>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={updateField('confirmPassword')}
                autoComplete="new-password"
              />
            </FormField>
          </>
        )}

        {isLeavingAdmin && (
          <Banner
            tone="warning"
            description="Você está tirando o seu próprio perfil de Admin: ao salvar, perde o acesso a esta tela."
          />
        )}
        {error && <Banner tone="danger" description={error} />}

        {/* Enter no formulário também salva */}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
