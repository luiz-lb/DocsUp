import { useEffect, useState } from 'react';
import { LuSave } from 'react-icons/lu';
import { Modal, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { DOCUMENT_CATEGORY, DOCUMENT_CATEGORY_ID } from '../../../../constants/enums.js';
import { createDocumentType, updateDocumentType } from '../../api/parametersApi.js';
import styles from './DocumentTypeFormModal.module.css';

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  hasExpiration: false,
  validityDays: '',
  category: '',
};

// Categorias de colaborador entre as quais um tipo pode ser movido na edição
const MOVABLE_CATEGORIES = [DOCUMENT_CATEGORY_ID.BASICO, DOCUMENT_CATEGORY_ID.OUTRO];

const NR_CODE_PATTERN = /^NR-\d{2}$/;

/**
 * Criação e edição de tipo de documento (tela de Parâmetros, só Admin).
 * Na criação, a categoria é a da aba atual. Na edição, básicos e outros podem
 * trocar de categoria entre si. Nas NRs, o nome é só o título e o código é obrigatório.
 *
 * Props:
 *  - open         : boolean
 *  - category     : categoria da aba (usada na criação)
 *  - documentType : tipo em edição (null = criação)
 *  - onClose      : () => void
 *  - onSuccess    : (documentType, mode, payload) => void
 */
export default function DocumentTypeFormModal({ open, category, documentType, onClose, onSuccess }) {
  const isEdit = Boolean(documentType);
  const currentCategory = isEdit ? documentType.category : category;
  const isNr = currentCategory === DOCUMENT_CATEGORY_ID.NR;
  const canMove = isEdit && MOVABLE_CATEGORIES.includes(documentType.category);

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preenche o formulário a cada abertura
  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      documentType
        ? {
            // Nas NRs o nome guardado é 'NR-35 - Título': o formulário edita só o título
            name:
              documentType.category === DOCUMENT_CATEGORY_ID.NR
                ? (documentType.nr_name ?? String(documentType.name ?? '').replace(/^NR-\d+\s*-\s*/, ''))
                : (documentType.name ?? ''),
            code: documentType.code ?? '',
            description: documentType.description ?? '',
            hasExpiration: Boolean(documentType.has_expiration),
            validityDays: documentType.validity_days ? String(documentType.validity_days) : '',
            category: String(documentType.category),
          }
        : EMPTY_FORM,
    );
  }, [open, documentType]);

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // Mesmas regras do backend (que valida de novo)
  const validate = () => {
    const name = form.name.trim();
    if (!name) return isNr ? 'Informe o título da NR.' : 'Informe o nome.';
    if (name.length > 200) return 'O nome pode ter no máximo 200 caracteres.';
    if (isNr && !NR_CODE_PATTERN.test(form.code.trim())) return 'Informe o código no formato NR-00 (ex.: NR-35).';
    if (form.hasExpiration && form.validityDays !== '') {
      const days = Number(form.validityDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        return 'O prazo padrão deve ser um número inteiro de 1 a 3650 dias.';
      }
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

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      hasExpiration: form.hasExpiration,
      validityDays: form.hasExpiration && form.validityDays !== '' ? Number(form.validityDays) : null,
    };
    if (isNr) payload.code = form.code.trim();
    if (!isEdit) payload.category = category;
    if (canMove) payload.category = Number(form.category);

    setError('');
    setIsSubmitting(true);
    const result = isEdit
      ? await updateDocumentType(documentType.id, payload)
      : await createDocumentType(payload);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao salvar o tipo de documento.');
      return;
    }

    onSuccess?.(result.body?.documentType, isEdit ? 'edit' : 'create', payload);
  };

  const title = isNr ? (isEdit ? 'Editar NR' : 'Nova NR') : isEdit ? 'Editar tipo de documento' : 'Novo tipo de documento';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuSave} isLoading={isSubmitting} onClick={handleSubmit}>
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {!canMove && (
          <p className={styles.category}>
            Categoria: <strong>{DOCUMENT_CATEGORY[currentCategory]?.label ?? '—'}</strong>
          </p>
        )}

        {isNr && (
          <FormField label="Código" required hint="Formato NR-00, ex.: NR-35.">
            <input
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              placeholder="NR-00"
              maxLength={10}
            />
          </FormField>
        )}

        <FormField label={isNr ? 'Título da NR' : 'Nome'} required>
          <input
            value={form.name}
            onChange={updateField('name')}
            maxLength={200}
            placeholder={isNr ? 'Ex.: Trabalho em Altura' : undefined}
          />
        </FormField>

        <FormField label="Descrição">
          <textarea value={form.description} onChange={updateField('description')} rows={3} maxLength={2000} />
        </FormField>

        {canMove && (
          <FormField label="Categoria" required hint="Os básicos são exigidos de todo colaborador, em todas as solicitações.">
            <select value={form.category} onChange={updateField('category')}>
              {MOVABLE_CATEGORIES.map((value) => (
                <option key={value} value={value}>{DOCUMENT_CATEGORY[value].label}</option>
              ))}
            </select>
          </FormField>
        )}

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={form.hasExpiration}
            onChange={(event) => setForm((prev) => ({ ...prev, hasExpiration: event.target.checked }))}
          />
          Tem validade
        </label>

        {form.hasExpiration && (
          <FormField label="Prazo padrão (dias)" hint="Usado para sugerir a data de validade no envio.">
            <input
              type="number"
              min={1}
              max={3650}
              step={1}
              value={form.validityDays}
              onChange={updateField('validityDays')}
              placeholder="Ex.: 365"
            />
          </FormField>
        )}

        {error && <Banner tone="danger" description={error} />}

        {/* Enter no formulário também salva */}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
