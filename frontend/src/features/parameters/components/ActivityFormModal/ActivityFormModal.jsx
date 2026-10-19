import { useEffect, useMemo, useState } from 'react';
import { LuSave, LuSearch } from 'react-icons/lu';
import { Modal, Button, FormField, Banner } from '../../../../components/ui/index.js';
import { DOCUMENT_CATEGORY, DOCUMENT_CATEGORY_ID, RISK_LEVEL } from '../../../../constants/enums.js';
import { cn } from '../../../../utils/cn.js';
import { createActivity, listDocumentTypes, updateActivity } from '../../api/parametersApi.js';
import styles from './ActivityFormModal.module.css';

const EMPTY_FORM = { name: '', description: '', riskLevel: '' };

// Grupos de documentos sugeridos. Os básicos ficam de fora: já são exigidos de todo colaborador.
const SUGGESTION_GROUPS = [
  { category: DOCUMENT_CATEGORY_ID.EMPRESA },
  { category: DOCUMENT_CATEGORY_ID.NR, searchable: true },
  { category: DOCUMENT_CATEGORY_ID.OUTRO },
];
const SUGGESTION_CATEGORIES = SUGGESTION_GROUPS.map((group) => group.category);

/** Texto sem acentos e em minúsculas, para a busca. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Criação e edição de atividade (tela de Parâmetros, só Admin), com os
 * documentos sugeridos (empresa, NRs e outros do colaborador).
 *
 * Props:
 *  - open      : boolean
 *  - activity  : atividade em edição (null = criação)
 *  - onClose   : () => void
 *  - onSuccess : (activity, mode, payload) => void
 */
export default function ActivityFormModal({ open, activity, onClose, onSuccess }) {
  const isEdit = Boolean(activity);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedIds, setSelectedIds] = useState([]);
  const [nrSearch, setNrSearch] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tipos de documento ativos: busca a cada abertura, para refletir o catálogo atual
  const [catalog, setCatalog] = useState({ isLoading: false, response: null });
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setCatalog({ isLoading: true, response: null });
    listDocumentTypes({ status: '1' }).then((response) => {
      if (!cancelled) setCatalog({ isLoading: false, response });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const catalogResponse = catalog.response;
  const isLoadingCatalog = catalog.isLoading || !catalogResponse;
  const catalogError = catalogResponse && !catalogResponse.success ? catalogResponse.message : null;

  // Preenche o formulário a cada abertura
  useEffect(() => {
    if (!open) return;
    setError('');
    setNrSearch('');
    setForm(
      activity
        ? {
            name: activity.name ?? '',
            description: activity.description ?? '',
            riskLevel: activity.risk_level === null || activity.risk_level === undefined ? '' : String(activity.risk_level),
          }
        : EMPTY_FORM,
    );
    setSelectedIds(
      (activity?.documents ?? [])
        .filter((doc) => SUGGESTION_CATEGORIES.includes(doc.category))
        .map((doc) => doc.id),
    );
  }, [open, activity]);

  // Opções de cada grupo: os tipos ativos da categoria e, na edição, os já sugeridos
  // que estão inativos (aparecem marcados, para poderem ser desmarcados)
  const optionsByCategory = useMemo(() => {
    if (!catalogResponse?.success) return {};
    const activeTypes = catalogResponse.body ?? [];
    const activeIds = new Set(activeTypes.map((type) => type.id));
    const linkedInactive = (activity?.documents ?? [])
      .filter((doc) => !activeIds.has(doc.id))
      .map((doc) => ({ ...doc, inactive: true }));

    const groups = {};
    SUGGESTION_CATEGORIES.forEach((category) => {
      groups[category] = [...activeTypes, ...linkedInactive].filter((type) => type.category === category);
    });
    return groups;
  }, [catalogResponse, activity]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleDocument = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // Mesmas regras do backend (que valida de novo)
  const validate = () => {
    const name = form.name.trim();
    if (!name) return 'Informe o nome da atividade.';
    if (name.length > 200) return 'O nome pode ter no máximo 200 caracteres.';
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
      riskLevel: form.riskLevel === '' ? null : Number(form.riskLevel),
      documentTypeIds: selectedIds,
    };

    setError('');
    setIsSubmitting(true);
    const result = isEdit ? await updateActivity(activity.id, payload) : await createActivity(payload);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.body?.message ?? 'Erro ao salvar a atividade.');
      return;
    }

    onSuccess?.(result.body?.activity, isEdit ? 'edit' : 'create', payload);
  };

  const renderGroup = ({ category, searchable }) => {
    const options = optionsByCategory[category] ?? [];
    const selectedCount = options.filter((option) => selectedSet.has(option.id)).length;
    const term = searchable ? normalize(nrSearch.trim()) : '';
    const visible = term
      ? options.filter((option) => normalize(`${option.code ?? ''} ${option.name}`).includes(term))
      : options;

    return (
      <fieldset key={category} className={styles.group}>
        <legend className={styles.groupTitle}>
          {DOCUMENT_CATEGORY[category].label}
          <span className={styles.groupCount}>
            {selectedCount === 0 ? 'nenhum marcado' : `${selectedCount} marcado${selectedCount === 1 ? '' : 's'}`}
          </span>
        </legend>

        {searchable && options.length > 0 && (
          <label className={styles.searchField}>
            <LuSearch className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar NR por código ou título..."
              value={nrSearch}
              onChange={(event) => setNrSearch(event.target.value)}
              // Enter na busca não envia o formulário
              onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
            />
          </label>
        )}

        {options.length === 0 ? (
          <p className={styles.muted}>Nenhum documento ativo nesta categoria.</p>
        ) : visible.length === 0 ? (
          <p className={styles.muted}>Nenhuma NR encontrada para “{nrSearch.trim()}”.</p>
        ) : (
          <div className={styles.options}>
            {visible.map((option) => {
              const checked = selectedSet.has(option.id);
              return (
                <label key={option.id} className={cn(styles.option, checked && styles.optionChecked)}>
                  <input type="checkbox" checked={checked} onChange={() => toggleDocument(option.id)} />
                  <span>
                    {option.name}
                    {option.inactive && <span className={styles.inactiveTag}>inativo</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar atividade' : 'Nova atividade'}
      maxWidth="md"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button icon={LuSave} isLoading={isSubmitting} onClick={handleSubmit}>
            {isEdit ? 'Salvar' : 'Criar atividade'}
          </Button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.row}>
          <FormField label="Nome" required className={styles.grow}>
            <input value={form.name} onChange={updateField('name')} maxLength={200} />
          </FormField>

          <FormField label="Risco">
            <select value={form.riskLevel} onChange={updateField('riskLevel')}>
              <option value="">Não informado</option>
              {Object.entries(RISK_LEVEL).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Descrição">
          <textarea value={form.description} onChange={updateField('description')} rows={3} maxLength={2000} />
        </FormField>

        <div className={styles.suggestions}>
          <p className={styles.suggestionsTitle}>Documentos sugeridos</p>
          <p className={styles.muted}>
            Os documentos básicos (ex.: ASO, Ficha de EPI) já são exigidos de todo colaborador.
          </p>

          {isLoadingCatalog ? (
            <p className={styles.muted}>Carregando documentos…</p>
          ) : catalogError ? (
            <Banner tone="danger" description={catalogError} />
          ) : (
            SUGGESTION_GROUPS.map(renderGroup)
          )}
        </div>

        {error && <Banner tone="danger" description={error} />}

        {/* Enter no formulário também salva */}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
