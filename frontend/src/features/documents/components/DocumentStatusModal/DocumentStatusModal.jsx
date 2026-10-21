import { useEffect, useState } from 'react';
import { LuSave } from 'react-icons/lu';
import { Modal, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { DOCUMENT_STATUS } from '../../../../constants/enums.js';
import { setDocumentStatus } from '../../api/documentsRealApi.js';
import styles from './DocumentStatusModal.module.css';

// Status em que a observação é obrigatória (mesma regra do backend)
const STATUS_NEEDS_OBSERVATION = [3, 4];
const OBSERVATION_MAX_LENGTH = 2000;

/**
 * RH / Segurança muda o status da entrega atual de um documento. Em Reprovado e
 * Reenvio Necessário a observação é obrigatória: é o que o fornecedor vê como motivo.
 *
 * Props:
 *  - open      : boolean
 *  - document  : linha da lista (id, document_type_name, employee_name, status, observation...)
 *  - onClose   : () => void
 *  - onSuccess : (document, message) => void
 */
export default function DocumentStatusModal({ open, document, onClose, onSuccess }) {
  const [status, setStatus] = useState('');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Começa com o status e a observação atuais
  useEffect(() => {
    if (!open || !document) return;
    setStatus(String(document.status ?? 0));
    setObservation(document.observation ?? '');
    setError('');
  }, [open, document]);

  const needsObservation = STATUS_NEEDS_OBSERVATION.includes(Number(status));

  const handleSubmit = async (event) => {
    event?.preventDefault();

    const text = observation.trim();
    if (needsObservation && !text) {
      setError('Informe a observação: o fornecedor precisa saber o motivo.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const result = await setDocumentStatus(document.id, Number(status), text || null);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao atualizar o status.');
      return;
    }
    onSuccess?.(document, result.body?.message);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alterar status do documento"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuSave} isLoading={isSubmitting} onClick={handleSubmit}>Salvar</Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {document && (
          <p className={styles.subtitle}>
            <strong>{document.document_type_name}</strong>
            {document.employee_name ? ` · ${document.employee_name}` : ' · Empresa'}
            {document.supplier_name && <span className={styles.supplier}>{document.supplier_name}</span>}
          </p>
        )}

        <FormField label="Status" required>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(DOCUMENT_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Observação para o fornecedor"
          required={needsObservation}
          hint={
            needsObservation
              ? 'Obrigatória: explique o motivo da reprovação ou do reenvio. O fornecedor vê este texto.'
              : 'Opcional. O fornecedor vê este texto.'
          }
        >
          <textarea
            rows={4}
            value={observation}
            maxLength={OBSERVATION_MAX_LENGTH}
            onChange={(event) => setObservation(event.target.value)}
            placeholder={needsObservation ? 'Ex.: O ASO está sem a assinatura do médico.' : undefined}
          />
        </FormField>

        {error && <Banner tone="danger" description={error} />}
      </form>
    </Modal>
  );
}
