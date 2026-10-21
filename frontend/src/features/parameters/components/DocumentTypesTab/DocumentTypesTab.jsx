import { useState } from 'react';
import { LuBan, LuCircleCheck, LuPencil } from 'react-icons/lu';
import { DataTable, StatusBadge, Button, Banner, ConfirmDialog } from '../../../../components/ui/index.js';
import { DOCUMENT_CATEGORY, DOCUMENT_CATEGORY_ID, VALIDATION_METHOD } from '../../../../constants/enums.js';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue.js';
import { useDocumentTypes } from '../../hooks/useParameters.js';
import { setDocumentTypeStatus } from '../../api/parametersApi.js';
import { describeValidity, documentTypeLabel, shortText } from '../../parametersFormat.js';
import ParametersToolbar from '../ParametersToolbar/index.js';
import DocumentTypeFormModal from '../DocumentTypeFormModal/index.js';
import styles from './DocumentTypesTab.module.css';

/**
 * Aba de uma categoria de tipo de documento (empresa, básicos, NRs ou outros):
 * lista com busca e filtro de status, criação, edição e ativação/inativação.
 *
 * Props:
 *  - category : DOCUMENT_CATEGORY_ID da aba
 */
export default function DocumentTypesTab({ category }) {
  const isNr = category === DOCUMENT_CATEGORY_ID.NR;

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const search = useDebouncedValue(searchInput, 400);

  const { data: response, isLoading, reload } = useDocumentTypes({ category, status, search });
  const documentTypes = response?.body ?? [];
  const loadError = response && !response.success ? response.message : null;

  // Modais: formulário (criar/editar) e confirmação de status
  const [formState, setFormState] = useState({ open: false, documentType: null });
  const [statusTarget, setStatusTarget] = useState(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const closeForm = () => setFormState({ open: false, documentType: null });

  // Mensagens: 'NR-35 - Título criada.' / 'Tipo de documento "ASO" criado.'
  const subjectOf = (name) => (isNr ? name : `Tipo de documento "${name}"`);
  const ending = isNr ? 'a' : 'o';

  const handleFormSuccess = (saved, mode, payload) => {
    const edited = formState.documentType;
    closeForm();

    const name = saved ? documentTypeLabel(saved) : isNr ? `${payload.code} - ${payload.name}` : payload.name;
    let message = `${subjectOf(name)} ${mode === 'edit' ? 'atualizad' : 'criad'}${ending}.`;
    if (mode === 'edit' && payload.category !== undefined && payload.category !== edited?.category) {
      message = `${subjectOf(name)} atualizad${ending} e movid${ending} para ${DOCUMENT_CATEGORY[payload.category].label}.`;
    }
    setFeedback({ tone: 'success', message });
    reload();
  };

  const confirmStatusChange = async () => {
    const target = statusTarget;
    setIsChangingStatus(true);
    const result = await setDocumentTypeStatus(target.id, !target.is_active);
    setIsChangingStatus(false);
    setStatusTarget(null);

    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao alterar o status do tipo de documento.' });
      return;
    }
    const subject = subjectOf(documentTypeLabel(target));
    setFeedback({
      tone: 'success',
      message: `${subject} foi ${target.is_active ? 'inativad' : 'reativad'}${ending}.`,
    });
    reload();
  };

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row) =>
        isNr && row.code ? (
          <div>
            <strong>{row.code}</strong>
            <span className={styles.nrTitle}> {row.nr_name ?? row.name}</span>
          </div>
        ) : (
          <strong>{row.name}</strong>
        ),
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (row) =>
        row.description ? (
          <span className={styles.description} title={row.description}>
            {shortText(row.description)}
          </span>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    { key: 'validity', header: 'Validade', render: (row) => describeValidity(row) },
    {
      key: 'validation',
      header: 'Validação',
      render: (row) => <StatusBadge enumMap={VALIDATION_METHOD} value={row.validation_method} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.is_active ? 'Ativo' : 'Inativo'} tone={row.is_active ? 'success' : 'neutral'} />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon={LuPencil} onClick={() => setFormState({ open: true, documentType: row })}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" icon={row.is_active ? LuBan : LuCircleCheck} onClick={() => setStatusTarget(row)}>
            {row.is_active ? 'Inativar' : 'Reativar'}
          </Button>
        </div>
      ),
    },
  ];

  const statusName = statusTarget ? documentTypeLabel(statusTarget) : '';

  return (
    <div>
      {category === DOCUMENT_CATEGORY_ID.BASICO && (
        <Banner tone="info" description="Os documentos básicos são exigidos de todo colaborador, em todas as solicitações." />
      )}

      <ParametersToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={isNr ? 'Buscar por código ou título...' : 'Buscar por nome...'}
        status={status}
        onStatusChange={setStatus}
        createLabel={isNr ? 'Nova NR' : 'Novo tipo'}
        onCreate={() => setFormState({ open: true, documentType: null })}
      />

      {loadError && <Banner tone="danger" description={loadError} />}
      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      <DataTable
        columns={columns}
        rows={documentTypes}
        isLoading={isLoading}
        emptyTitle={isNr ? 'Nenhuma NR encontrada' : 'Nenhum tipo de documento encontrado'}
        emptyDescription="Ajuste a busca ou o filtro de status, ou crie um novo."
      />

      <DocumentTypeFormModal
        open={formState.open}
        category={category}
        documentType={formState.documentType}
        onClose={closeForm}
        onSuccess={handleFormSuccess}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        title={statusTarget?.is_active ? 'Inativar tipo de documento' : 'Reativar tipo de documento'}
        description={
          statusTarget?.is_active
            ? `${statusName} deixa de aparecer como opção para novas exigências e envios. Os documentos já enviados não mudam. Dá para reativar depois.`
            : `${statusName} volta a aparecer como opção para novas exigências e envios.`
        }
        confirmLabel={statusTarget?.is_active ? 'Inativar' : 'Reativar'}
        variant={statusTarget?.is_active ? 'danger' : 'primary'}
        isLoading={isChangingStatus}
      />
    </div>
  );
}
