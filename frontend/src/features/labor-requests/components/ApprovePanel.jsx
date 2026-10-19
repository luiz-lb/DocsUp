import { useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuCheck, LuLock, LuPlus, LuSearch, LuSparkles, LuTrash2 } from 'react-icons/lu';
import { Button, FormField, WizardStepper } from '../../../components/ui/index.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import {
  getDocumentsTypes,
  getEmployeeDocumentTypes,
  getNrTypes,
  submitApproval,
} from '../api/laborRequestsApi.js';
import { DOCUMENT_CATEGORY_ID } from '../../../constants/enums.js';
import styles from './ApprovePanel.module.css';

const STEPS = ['Documentos da empresa', 'Documentos dos colaboradores'];

/** Texto sem acentos e em minúsculas, para a busca de NRs. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Sugeridos pela atividade primeiro; depois na ordem que já veio (nome ou código). */
function suggestedFirst(items, suggestedSet) {
  return [...items].sort((a, b) => Number(suggestedSet.has(b.id)) - Number(suggestedSet.has(a.id)));
}

/** Linha de apoio do documento: validade e prazo padrão. */
function validityMeta(doc) {
  if (!doc.has_expiration) return null;
  return doc.validity_days ? `Tem validade · prazo padrão ${doc.validity_days} dias` : 'Tem validade';
}

/** Ids iniciais: os sugeridos que existem na lista. */
function initialSelection(suggestedIds) {
  return new Set(suggestedIds.map(Number).filter(Boolean));
}

/**
 * Painel de aprovação da Segurança do Trabalho — 2 etapas.
 *
 * Etapa 0 — Documentos da empresa (ao menos um).
 * Etapa 1 — Documentos dos colaboradores:
 *   - Básicos: sempre exigidos (marcados e travados); o backend grava todos os ativos.
 *   - NRs e Outros: os sugeridos pela atividade já vêm marcados e podem ser desmarcados.
 *   Inclui campo de comentário livre antes do envio.
 *
 * Props:
 *  - laborRequestId     : number
 *  - activityDocTypeIds : number[] — ids sugeridos de document_types (empresa e outros)
 *  - activityNrTypeIds  : number[] — ids sugeridos de nr_types
 *  - onSuccess          : () => void
 */
export default function ApprovePanel({
  laborRequestId,
  activityDocTypeIds = [],
  activityNrTypeIds = [],
  onSuccess,
}) {
  const { data: companyData, isLoading: isLoadingCompany } = useAsyncData(getDocumentsTypes, []);
  const { data: employeeData, isLoading: isLoadingEmployee } = useAsyncData(getEmployeeDocumentTypes, []);
  const { data: nrData, isLoading: isLoadingNrs } = useAsyncData(getNrTypes, []);

  const [step, setStep] = useState(0);

  // Sugeridos da atividade: empresa e outros vêm juntos em activityDocTypeIds
  const [selectedDocIds, setSelectedDocIds] = useState(() => initialSelection(activityDocTypeIds));
  const [selectedNrIds, setSelectedNrIds] = useState(() => initialSelection(activityNrTypeIds));
  const [nrSearch, setNrSearch] = useState('');
  const [comments, setComments] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const suggestedDocSet = new Set(activityDocTypeIds.map(Number));
  const suggestedNrSet = new Set(activityNrTypeIds.map(Number));

  const companyTypes = suggestedFirst(companyData?.body ?? [], suggestedDocSet);
  const employeeTypes = employeeData?.body ?? [];
  const basicTypes = employeeTypes.filter((doc) => doc.category === DOCUMENT_CATEGORY_ID.BASICO);
  const otherTypes = suggestedFirst(
    employeeTypes.filter((doc) => doc.category === DOCUMENT_CATEGORY_ID.OUTRO),
    suggestedDocSet,
  );
  const nrTypes = suggestedFirst(nrData?.body ?? [], suggestedNrSet);

  const searchTerm = normalize(nrSearch.trim());
  const visibleNrs = searchTerm
    ? nrTypes.filter((nr) => normalize(`${nr.code} ${nr.name}`).includes(searchTerm))
    : nrTypes;

  // Contagens só do que está na lista (um sugerido inativo não conta)
  const companyCount = companyTypes.filter((doc) => selectedDocIds.has(doc.id)).length;
  const otherCount = otherTypes.filter((doc) => selectedDocIds.has(doc.id)).length;
  const nrCount = nrTypes.filter((nr) => selectedNrIds.has(nr.id)).length;

  const toggle = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleDoc = toggle(setSelectedDocIds);
  const toggleNr = toggle(setSelectedNrIds);

  // ── Avançar etapa 0 → etapa 1 ────────────────────────────────────────────
  const handleNext = () => {
    setError('');
    if (companyCount === 0) {
      setError('Selecione ao menos um documento da empresa para continuar.');
      return;
    }
    setStep(1);
  };

  // ── Envio final ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      // Empresa e outros marcados; os básicos o backend inclui sozinho
      const documentTypeIds = [...companyTypes, ...otherTypes]
        .filter((doc) => selectedDocIds.has(doc.id))
        .map((doc) => doc.id);
      const nrTypeIds = nrTypes.filter((nr) => selectedNrIds.has(nr.id)).map((nr) => nr.id);

      const result = await submitApproval(laborRequestId, 2, comments, documentTypeIds, nrTypeIds);

      if (!result.success) {
        setError(result.body?.message ?? 'Erro ao registrar decisão.');
        return;
      }

      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <WizardStepper steps={STEPS} activeStep={step} />

      {/* ── Etapa 0: Documentos da empresa ──────────────────────────────── */}
      {step === 0 && (
        <>
          <Section title="Documentos da empresa" count={companyCount}>
            {isLoadingCompany ? (
              <p className={styles.loading}>Carregando documentos…</p>
            ) : companyTypes.length === 0 ? (
              <p className={styles.loading}>Nenhum documento da empresa cadastrado.</p>
            ) : (
              companyTypes.map((doc) => (
                <CheckItem
                  key={doc.id}
                  label={doc.name}
                  meta={validityMeta(doc)}
                  suggested={suggestedDocSet.has(doc.id)}
                  checked={selectedDocIds.has(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  disabled={isSubmitting}
                />
              ))
            )}
          </Section>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Button
              icon={LuArrowRight}
              iconPosition="right"
              onClick={handleNext}
              disabled={isLoadingCompany}
            >
              Próximo: documentos dos colaboradores
            </Button>
          </div>
        </>
      )}

      {/* ── Etapa 1: Documentos dos colaboradores ───────────────────────── */}
      {step === 1 && (
        <>
          <Section
            title="Básicos do colaborador"
            note="Exigidos de todo colaborador. Ficam gravados nesta solicitação como estão hoje."
          >
            {isLoadingEmployee ? (
              <p className={styles.loading}>Carregando documentos…</p>
            ) : basicTypes.length === 0 ? (
              <p className={styles.loading}>Nenhum documento básico cadastrado.</p>
            ) : (
              basicTypes.map((doc) => (
                <CheckItem key={doc.id} label={doc.name} meta={validityMeta(doc)} checked locked />
              ))
            )}
          </Section>

          <Section title="NRs do colaborador" count={nrCount}>
            {isLoadingNrs ? (
              <p className={styles.loading}>Carregando NRs…</p>
            ) : nrTypes.length === 0 ? (
              <p className={styles.loading}>Nenhuma NR ativa cadastrada.</p>
            ) : (
              <>
                <label className={styles.searchField}>
                  <LuSearch className={styles.searchIcon} aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Buscar NR por código ou título..."
                    value={nrSearch}
                    onChange={(event) => setNrSearch(event.target.value)}
                  />
                </label>
                {visibleNrs.length === 0 ? (
                  <p className={styles.loading}>Nenhuma NR encontrada para “{nrSearch.trim()}”.</p>
                ) : (
                  visibleNrs.map((nr) => (
                    <CheckItem
                      key={nr.id}
                      label={nr.code}
                      meta={nr.name}
                      suggested={suggestedNrSet.has(nr.id)}
                      checked={selectedNrIds.has(nr.id)}
                      onChange={() => toggleNr(nr.id)}
                      disabled={isSubmitting}
                    />
                  ))
                )}
              </>
            )}
          </Section>

          <Section title="Outros do colaborador" count={otherCount}>
            {isLoadingEmployee ? (
              <p className={styles.loading}>Carregando documentos…</p>
            ) : otherTypes.length === 0 ? (
              <p className={styles.loading}>Nenhum documento em “Outros” cadastrado.</p>
            ) : (
              otherTypes.map((doc) => (
                <CheckItem
                  key={doc.id}
                  label={doc.name}
                  meta={validityMeta(doc)}
                  suggested={suggestedDocSet.has(doc.id)}
                  checked={selectedDocIds.has(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  disabled={isSubmitting}
                />
              ))
            )}
          </Section>

          {/* Comentário livre — único campo de texto, na etapa final */}
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
              disabled={isLoadingEmployee || isLoadingNrs}
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

function Section({ title, count, note, children }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>
        {title}
        {count !== undefined && (
          <span className={styles.badge}>{count} {count === 1 ? 'selecionado' : 'selecionados'}</span>
        )}
      </p>
      {note && <p className={styles.sectionNote}>{note}</p>}
      {children}
    </div>
  );
}

function CheckItem({ label, meta, suggested = false, checked, onChange, disabled = false, locked = false }) {
  const isDisabled = disabled || locked;
  return (
    <label
      className={`${styles.item} ${checked ? styles.itemChecked : ''} ${locked ? styles.itemLocked : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange ?? (() => {})}
        disabled={isDisabled}
        className={styles.checkbox}
        aria-label={label}
      />
      <div className={styles.itemInfo}>
        <span className={styles.itemLabel}>
          {label}
          {suggested && (
            <span className={styles.suggestedTag}>
              <LuSparkles aria-hidden="true" /> sugerido pela atividade
            </span>
          )}
        </span>
        {meta && <span className={styles.itemMeta}>{meta}</span>}
      </div>
      {locked ? (
        <LuLock className={styles.itemIcon} aria-label="Sempre exigido" />
      ) : checked ? (
        <LuTrash2 className={styles.itemIcon} aria-hidden="true" />
      ) : (
        <LuPlus className={styles.itemIcon} aria-hidden="true" />
      )}
    </label>
  );
}
