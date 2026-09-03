import { useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuCheck, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Button, FormField, WizardStepper } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getDocumentsTypes, getNrTypes, submitApproval } from '../api/laborRequestsApi.js';
import { DOCUMENT_SCOPE } from '../../../constants/enums.js';
import styles from './ApprovePanel.module.css';

const STEPS = ['Documentos da empresa', 'NRs dos colaboradores'];

/**
 * Painel de aprovação da Segurança do Trabalho — 2 etapas.
 *
 * Step 0 — Documentos da empresa:
 *   Define quais document_types são obrigatórios para esta contratação.
 *   Pré-seleção vem de activityDocTypeIds (sugestão da atividade).
 *
 * Step 1 — NRs dos colaboradores:
 *   Define quais NRs os colaboradores do fornecedor devem possuir.
 *   Pré-seleção vem de activityNrTypeIds (sugestão da atividade).
 *   Inclui campo de comentário livre antes do envio.
 *
 * Props:
 *  - laborRequestId     : number
 *  - activityDocTypeIds : number[] — IDs sugeridos de document_types
 *  - activityNrTypeIds  : number[] — IDs sugeridos de nr_types
 *  - onSuccess          : () => void
 */
export default function ApprovePanel({
  laborRequestId,
  activityDocTypeIds = [],
  activityNrTypeIds  = [],
  onSuccess,
}) {
  const { data: docTypesData, isLoading: isLoadingDocs } = useAsyncData(getDocumentsTypes, []);
  const { data: nrTypesData,  isLoading: isLoadingNrs  } = useAsyncData(getNrTypes, []);

  const [step, setStep] = useState(0);

  // ── Step 0 ───────────────────────────────────────────────────────────────
  const [selectedDocIds, setSelectedDocIds] = useState(
    () => new Set(activityDocTypeIds.map(Number).filter(Boolean)),
  );

  // ── Step 1 ───────────────────────────────────────────────────────────────
  const [selectedNrIds, setSelectedNrIds] = useState(
    () => new Set(activityNrTypeIds.map(Number).filter(Boolean)),
  );
  const [comments, setComments] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const documentTypes = docTypesData?.body ?? [];
  const nrTypes       = nrTypesData?.body  ?? [];

  // ── Helpers de toggle ────────────────────────────────────────────────────
  const toggleDoc = (id) =>
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleNr = (id) =>
    setSelectedNrIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Avançar step 0 → step 1 ──────────────────────────────────────────────
  const handleNext = () => {
    setError('');
    if (selectedDocIds.size === 0) {
      setError('Selecione ao menos um documento obrigatório para continuar.');
      return;
    }
    setStep(1);
  };

  // ── Envio final ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    if (selectedNrIds.size === 0) {
      setError('Selecione ao menos uma NR obrigatória antes de aprovar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitApproval(
        laborRequestId,
        2, // Aprovado
        comments,
        [...selectedDocIds],
        [...selectedNrIds],
      );

      if (!result.success) {
        setError(result.body?.message ?? 'Erro ao registrar decisão.');
        return;
      }

      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Separação sugeridos / outros ─────────────────────────────────────────
  const suggestedDocSet = new Set(activityDocTypeIds.map(Number));
  const suggestedDocs   = documentTypes.filter((d) => suggestedDocSet.has(d.id));
  const otherDocs       = documentTypes.filter((d) => !suggestedDocSet.has(d.id));

  const suggestedNrSet  = new Set(activityNrTypeIds.map(Number));
  const suggestedNrs    = nrTypes.filter((n) => suggestedNrSet.has(n.id));
  const otherNrs        = nrTypes.filter((n) => !suggestedNrSet.has(n.id));

  return (
    <div className={styles.panel}>
      <WizardStepper steps={STEPS} activeStep={step} />

      {/* ── Step 0: Documentos da empresa ──────────────────────────────── */}
      {step === 0 && (
        <>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              Documentos obrigatórios para a contratação
              <span className={styles.badge}>{selectedDocIds.size} selecionados</span>
            </p>

            {isLoadingDocs ? (
              <p className={styles.loading}>Carregando documentos…</p>
            ) : (
              <>
                {suggestedDocs.length > 0 && (
                  <CheckGroup label="Sugeridos pela atividade">
                    {suggestedDocs.map((doc) => (
                      <CheckItem
                        key={doc.id}
                        label={doc.name}
                        meta={`${DOCUMENT_SCOPE[doc.scope]?.label ?? ''}${doc.validity_days ? ` · Validade: ${doc.validity_days} dias` : ''}`}
                        checked={selectedDocIds.has(doc.id)}
                        onChange={() => toggleDoc(doc.id)}
                        disabled={isSubmitting}
                      />
                    ))}
                  </CheckGroup>
                )}

                {otherDocs.length > 0 && (
                  <CheckGroup label="Outros disponíveis">
                    {otherDocs.map((doc) => (
                      <CheckItem
                        key={doc.id}
                        label={doc.name}
                        meta={`${DOCUMENT_SCOPE[doc.scope]?.label ?? ''}${doc.validity_days ? ` · Validade: ${doc.validity_days} dias` : ''}`}
                        checked={selectedDocIds.has(doc.id)}
                        onChange={() => toggleDoc(doc.id)}
                        disabled={isSubmitting}
                      />
                    ))}
                  </CheckGroup>
                )}
              </>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button
              icon={LuArrowRight}
              iconPosition="right"
              onClick={handleNext}
              disabled={isLoadingDocs}
            >
              Próximo: NRs dos colaboradores
            </Button>
          </div>
        </>
      )}

      {/* ── Step 1: NRs dos colaboradores ──────────────────────────────── */}
      {step === 1 && (
        <>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              NRs obrigatórias para os colaboradores
              <span className={styles.badge}>{selectedNrIds.size} selecionadas</span>
            </p>

            {isLoadingNrs ? (
              <p className={styles.loading}>Carregando NRs…</p>
            ) : (
              <>
                {suggestedNrs.length > 0 && (
                  <CheckGroup label="Sugeridas pela atividade">
                    {suggestedNrs.map((nr) => (
                      <CheckItem
                        key={nr.id}
                        label={nr.code}
                        meta={nr.name}
                        checked={selectedNrIds.has(nr.id)}
                        onChange={() => toggleNr(nr.id)}
                        disabled={isSubmitting}
                      />
                    ))}
                  </CheckGroup>
                )}

                {otherNrs.length > 0 && (
                  <CheckGroup label="Outras disponíveis">
                    {otherNrs.map((nr) => (
                      <CheckItem
                        key={nr.id}
                        label={nr.code}
                        meta={nr.name}
                        checked={selectedNrIds.has(nr.id)}
                        onChange={() => toggleNr(nr.id)}
                        disabled={isSubmitting}
                      />
                    ))}
                  </CheckGroup>
                )}
              </>
            )}
          </div>

          {/* Comentário livre — único campo de texto, no step final */}
          <FormField
            label="Comentários (opcional)"
            hint="Observações adicionais para o departamento de Suprimentos."
          >
            <textarea
              className={styles.textarea}
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Ex.: Documentos solicitados para essa atividade foram atualizados pelo cliente."
              disabled={isSubmitting}
            />
          </FormField>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button
              variant="ghost"
              icon={LuArrowLeft}
              onClick={() => { setError(''); setStep(0); }}
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button
              icon={LuCheck}
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={selectedNrIds.size === 0 || isLoadingNrs}
            >
              Aprovar e definir requisitos
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes internos
// ─────────────────────────────────────────────────────────────────────────────

function CheckGroup({ label, children }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      {children}
    </div>
  );
}

function CheckItem({ label, meta, checked, onChange, disabled }) {
  return (
    <label className={`${styles.item} ${checked ? styles.itemChecked : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.checkbox}
        aria-label={label}
      />
      <div className={styles.itemInfo}>
        <span className={styles.itemLabel}>{label}</span>
        {meta && <span className={styles.itemMeta}>{meta}</span>}
      </div>
      {checked
        ? <LuTrash2 className={styles.itemIcon} aria-hidden="true" />
        : <LuPlus   className={styles.itemIcon} aria-hidden="true" />
      }
    </label>
  );
}
