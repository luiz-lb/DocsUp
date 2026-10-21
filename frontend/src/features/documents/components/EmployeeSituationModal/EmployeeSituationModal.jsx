import { useEffect, useState } from 'react';
import { LuSave } from 'react-icons/lu';
import { Modal, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { EMPLOYEE_STATUS } from '../../../../constants/enums.js';
import { setEmployeeSituation } from '../../api/documentsRealApi.js';
import styles from './EmployeeSituationModal.module.css';

// Integração agendada: exige data e hora
const INTEGRATION_SCHEDULED = 2;
// Normalmente definidos pela rotina diária (00:01)
const AUTOMATIC_STATUSES = [4, 6];

/** Date / ISO → valor do <input type="datetime-local"> ('AAAA-MM-DDTHH:mm', horário local). */
function toDateTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * RH / Segurança muda a situação do colaborador (Docs de Fornecedores, aba Colaboradores).
 *
 * Props:
 *  - open      : boolean
 *  - employee  : linha da lista (id, full_name, supplier_name, status, integration_at...)
 *  - onClose   : () => void
 *  - onSuccess : (employee, message) => void
 */
export default function EmployeeSituationModal({ open, employee, onClose, onSuccess }) {
  const [status, setStatus] = useState('');
  const [integrationAt, setIntegrationAt] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setStatus(String(employee.status ?? 0));
    setIntegrationAt(toDateTimeInputValue(employee.integration_at));
    setError('');
  }, [open, employee]);

  const isScheduling = Number(status) === INTEGRATION_SCHEDULED;
  // Agendamento só no futuro (o backend confere de novo)
  const minIntegrationAt = toDateTimeInputValue(new Date());

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (isScheduling && !integrationAt) {
      setError('Informe a data e a hora da integração.');
      return;
    }
    // 'AAAA-MM-DDTHH:mm' sem fuso: o navegador lê no horário local
    if (isScheduling && new Date(integrationAt) <= new Date()) {
      setError('A integração tem que ser agendada para uma data e hora futuras.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const result = await setEmployeeSituation(employee.id, Number(status), isScheduling ? integrationAt : undefined);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao atualizar a situação.');
      return;
    }
    onSuccess?.(employee, result.body?.message);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Situação do colaborador"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuSave} isLoading={isSubmitting} onClick={handleSubmit}>Salvar</Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {employee && (
          <p className={styles.subtitle}>
            <strong>{employee.full_name}</strong>
            <span className={styles.meta}>
              {employee.supplier_name}
              {employee.labor_request_title ? ` · ${employee.labor_request_title}` : ''}
            </span>
          </p>
        )}

        <FormField
          label="Situação"
          required
          hint={AUTOMATIC_STATUSES.includes(Number(status))
            ? 'Esta situação normalmente é definida pela rotina diária (00:01).'
            : undefined}
        >
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(EMPLOYEE_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        {isScheduling && (
          <FormField label="Data e hora da integração" required>
            <input
              type="datetime-local"
              value={integrationAt}
              min={minIntegrationAt}
              onChange={(event) => setIntegrationAt(event.target.value)}
            />
          </FormField>
        )}

        {employee?.retained_by && (
          <Banner tone="danger" title="Pendência da empresa" description={`Documento(s) vencido(s): ${employee.retained_by}.`} />
        )}

        {error && <Banner tone="danger" description={error} />}
      </form>
    </Modal>
  );
}
