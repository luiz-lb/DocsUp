import { useEffect, useState } from 'react';
import { LuKeyRound } from 'react-icons/lu';
import { Modal, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { getPasswordPolicyError, PASSWORD_RULE_HINT } from '../../../../utils/validators.js';
import { resetUserPassword } from '../../api/usersApi.js';
import styles from './ResetPasswordModal.module.css';

/**
 * Admin define uma nova senha para o usuário (sem troca obrigatória no 1º acesso).
 *
 * Props:
 *  - open      : boolean
 *  - user      : usuário alvo
 *  - onClose   : () => void
 *  - onSuccess : (user) => void
 */
export default function ResetPasswordModal({ open, user, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Limpa os campos a cada abertura (a senha nunca fica guardada na tela)
  useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirmPassword('');
    setError('');
  }, [open]);

  const handleSubmit = async (event) => {
    event?.preventDefault();

    const policyError = getPasswordPolicyError(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const result = await resetUserPassword(user.id, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao redefinir a senha.');
      return;
    }

    onSuccess?.(user);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Redefinir senha"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuKeyRound} isLoading={isSubmitting} onClick={handleSubmit}>Redefinir senha</Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.subtitle}>
          Nova senha de <strong>{user?.name}</strong>. As sessões abertas dessa pessoa são encerradas.
          Passe a senha para ela por um canal seguro.
        </p>

        <FormField label="Nova senha" required hint={PASSWORD_RULE_HINT}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </FormField>
        <FormField label="Confirmar nova senha" required>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>

        {error && <Banner tone="danger" description={error} />}

        {/* Enter no formulário também confirma */}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
