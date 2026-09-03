import { useState } from 'react';
import { LuPlus, LuTrash2, LuSend } from 'react-icons/lu';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Modal from '../../../../components/ui/Modal/index.js';
import Button from '../../../../components/ui/Button/index.js';
import FormField from '../../../../components/ui/FormField/index.js';
import Banner from '../../../../components/ui/Banner/index.js';
import { createRound } from '../../api/quotationsApi.js';
import styles from './CreateRoundModal.module.css';

/**
 * Modal para Suprimentos criar uma rodada de cotação e convidar fornecedores.
 *
 * Props:
 *  - open           : boolean
 *  - onClose        : () => void
 *  - laborRequestId : number
 *  - onSuccess      : (roundId) => void
 */
export default function CreateRoundModal({ open, onClose, laborRequestId, onSuccess }) {
  const [deadline, setDeadline] = useState(null);
  const [deadlineHoursPhase2, setDeadlineHoursPhase2] = useState(72);
  const [invitees, setInvitees] = useState([{ email: '', supplierId: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addInvitee = () =>
    setInvitees((prev) => [...prev, { email: '', supplierId: '' }]);

  const removeInvitee = (index) =>
    setInvitees((prev) => prev.filter((_, i) => i !== index));

  const updateInvitee = (index, field, value) =>
    setInvitees((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );

  const handleSubmit = async () => {
    setError('');

    const validInvitees = invitees.filter((inv) => inv.email?.trim());
    if (validInvitees.length === 0) {
      setError('Adicione ao menos um email de fornecedor.');
      return;
    }
    if (!deadline) {
      setError('Defina o prazo para envio das cotações.');
      return;
    }
    if (new Date(deadline) <= new Date()) {
      setError('O prazo deve ser uma data futura.');
      return;
    }

    setIsSubmitting(true);
    const result = await createRound({
      laborRequestId,
      deadline: deadline.toISOString(),
      deadlineHoursPhase2: Number(deadlineHoursPhase2),
      invitees: validInvitees.map((inv) => ({
        email: inv.email.trim(),
        supplierId: inv.supplierId ? Number(inv.supplierId) : undefined,
      })),
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao criar rodada.');
      return;
    }

    onSuccess?.(result.body.roundId);
    handleClose();
  };

  const handleClose = () => {
    setDeadline(null);
    setDeadlineHoursPhase2(72);
    setInvitees([{ email: '', supplierId: '' }]);
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Criar rodada de cotação"
      maxWidth="sm"
      actions={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button icon={LuSend} isLoading={isSubmitting} onClick={handleSubmit}>
            Criar e enviar convites
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {/* Prazo de resposta */}
        <FormField label="Prazo para envio das cotações" required>
          <DatePicker
            selected={deadline}
            onChange={(date) => setDeadline(date)}
            minDate={new Date()}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            dateFormat="dd/MM/yyyy HH:mm"
            placeholderText="Selecione data e hora"
            className={styles.dateInput}
          />
        </FormField>

        {/* Prazo Phase 2 */}
        <FormField
          label="Prazo da Fase 2 (horas)"
          hint="Horas que o fornecedor vencedor terá para enviar os documentos dos colaboradores."
        >
          <select
            value={deadlineHoursPhase2}
            onChange={(e) => setDeadlineHoursPhase2(e.target.value)}
          >
            <option value={24}>24 horas</option>
            <option value={48}>48 horas</option>
            <option value={72}>72 horas (padrão)</option>
            <option value={96}>96 horas</option>
          </select>
        </FormField>

        {/* Fornecedores a convidar */}
        <div>
          <p className={styles.inviteLabel}>Fornecedores convidados</p>
          {invitees.map((invitee, index) => (
            <div key={index} className={styles.inviteeRow}>
              <FormField label={index === 0 ? 'E-mail' : ''} className={styles.emailField}>
                <input
                  type="email"
                  value={invitee.email}
                  onChange={(e) => updateInvitee(index, 'email', e.target.value)}
                  placeholder="email@fornecedor.com.br"
                />
              </FormField>
              {invitees.length > 1 && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeInvitee(index)}
                  aria-label="Remover fornecedor"
                >
                  <LuTrash2 />
                </button>
              )}
            </div>
          ))}
          <button type="button" className={styles.addBtn} onClick={addInvitee}>
            <LuPlus /> Adicionar outro fornecedor
          </button>
        </div>

        {error && <Banner tone="danger" description={error} />}
      </div>
    </Modal>
  );
}
