import { useEffect, useState } from 'react';
import { LuUpload } from 'react-icons/lu';
import { Modal, Button, FormField, FileDropzone, Banner } from '../../../../components/ui/index.js';
import { addDaysToToday, toDateInputValue } from '../../../../utils/formatters.js';
import { addEmployee, uploadCompanyDocuments } from '../../api/employeesApi.js';
import styles from './ResendDocumentModal.module.css';

/**
 * Reenvio de um documento pelo fornecedor (nova entrega; a anterior vai para o histórico).
 *
 * Props:
 *  - open         : boolean
 *  - token        : token do link da Fase 2
 *  - target       : { document, documentType, employee? } — employee vazio = documento da empresa
 *                   documentType: { id, has_expiration, validity_days }
 *  - onClose      : () => void
 *  - onSuccess    : (message) => void
 */
export default function ResendDocumentModal({ open, token, target, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentType = target?.documentType;
  const needsExpiry = Boolean(documentType?.has_expiration);
  const today = toDateInputValue();

  // Limpa a cada abertura; a validade começa pela sugestão do prazo padrão
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setError('');
    setExpiresAt(needsExpiry && documentType?.validity_days ? addDaysToToday(documentType.validity_days) : '');
  }, [open, needsExpiry, documentType]);

  const handleSubmit = async () => {
    if (!file) {
      setError('Envie o arquivo novo do documento.');
      return;
    }
    if (needsExpiry && !expiresAt) {
      setError('Informe a validade do documento.');
      return;
    }
    if (needsExpiry && expiresAt < today) {
      setError('A validade do documento não pode ser anterior a hoje.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const validity = needsExpiry ? expiresAt : null;
    const { employee } = target;
    const result = employee
      ? await addEmployee(
          token,
          {
            fullName: employee.full_name,
            cpf: employee.cpf,
            rg: employee.rg,
            roleFunction: employee.role_function,
            documentTypeId: documentType.id,
            expiresAt: validity,
          },
          file,
        )
      : await uploadCompanyDocuments(token, [file], [documentType.id], [validity]);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao reenviar o documento.');
      return;
    }
    onSuccess?.(`${target.document.document_type_name} reenviado. A entrega anterior foi para o histórico.`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reenviar documento"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuUpload} isLoading={isSubmitting} onClick={handleSubmit}>Reenviar</Button>
        </>
      }
    >
      {target && (
        <div className={styles.content}>
          <p className={styles.subtitle}>
            <strong>{target.document.document_type_name}</strong>
            {target.employee ? ` · ${target.employee.full_name}` : ' · Empresa'}
          </p>

          {target.document.observation && (
            <Banner tone="warning" title="Observação do RH" description={target.document.observation} />
          )}

          <FileDropzone
            files={file ? [file] : []}
            onFilesChange={(files) => setFile(files[files.length - 1] ?? null)}
            multiple={false}
            label="Arquivo novo (um arquivo)"
            hint="PDF, JPG ou PNG"
          />

          {needsExpiry && (
            <FormField
              label="Validade do documento"
              required
              hint={documentType.validity_days ? 'Sugerida pelo prazo padrão. Confira a data no documento.' : undefined}
            >
              <input type="date" value={expiresAt} min={today} onChange={(event) => setExpiresAt(event.target.value)} />
            </FormField>
          )}

          {error && <Banner tone="danger" description={error} />}
        </div>
      )}
    </Modal>
  );
}
