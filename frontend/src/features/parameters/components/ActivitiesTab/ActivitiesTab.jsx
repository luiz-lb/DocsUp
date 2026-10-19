import { useState } from 'react';
import { LuBan, LuCircleCheck, LuPencil } from 'react-icons/lu';
import { DataTable, StatusBadge, Button, Banner, ConfirmDialog } from '../../../../components/ui/index.js';
import { RISK_LEVEL } from '../../../../constants/enums.js';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue.js';
import { useActivities } from '../../hooks/useParameters.js';
import { setActivityStatus } from '../../api/parametersApi.js';
import { shortText } from '../../parametersFormat.js';
import ParametersToolbar from '../ParametersToolbar/index.js';
import ActivityFormModal from '../ActivityFormModal/index.js';
import styles from './ActivitiesTab.module.css';

/** Coluna "Documentos sugeridos": quantidade, com os nomes no title. */
function SuggestedDocuments({ documents = [] }) {
  if (documents.length === 0) return <span className={styles.muted}>Nenhum</span>;
  const label = `${documents.length} documento${documents.length === 1 ? '' : 's'}`;
  return (
    <span
      className={styles.docCount}
      title={documents.map((doc) => (doc.is_active === false ? `${doc.name} (inativo)` : doc.name)).join('\n')}
    >
      {label}
    </span>
  );
}

/**
 * Aba de atividades: lista com busca e filtro de status, criação, edição
 * (com os documentos sugeridos) e ativação/inativação.
 */
export default function ActivitiesTab() {
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const search = useDebouncedValue(searchInput, 400);

  const { data: response, isLoading, reload } = useActivities({ status, search });
  const activities = response?.body ?? [];
  const loadError = response && !response.success ? response.message : null;

  // Modais: formulário (criar/editar) e confirmação de status
  const [formState, setFormState] = useState({ open: false, activity: null });
  const [statusTarget, setStatusTarget] = useState(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const closeForm = () => setFormState({ open: false, activity: null });

  const handleFormSuccess = (saved, mode, payload) => {
    closeForm();
    const name = saved?.name ?? payload.name;
    setFeedback({
      tone: 'success',
      message: `Atividade "${name}" ${mode === 'edit' ? 'atualizada' : 'criada'}.`,
    });
    reload();
  };

  const confirmStatusChange = async () => {
    const target = statusTarget;
    setIsChangingStatus(true);
    const result = await setActivityStatus(target.id, !target.is_active);
    setIsChangingStatus(false);
    setStatusTarget(null);

    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao alterar o status da atividade.' });
      return;
    }
    setFeedback({
      tone: 'success',
      message: `Atividade "${target.name}" foi ${target.is_active ? 'inativada' : 'reativada'}.`,
    });
    reload();
  };

  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          {row.description && (
            <div className={styles.description} title={row.description}>
              {shortText(row.description, 80)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risco',
      render: (row) =>
        row.risk_level === null || row.risk_level === undefined ? (
          <span className={styles.muted}>—</span>
        ) : (
          <StatusBadge enumMap={RISK_LEVEL} value={row.risk_level} />
        ),
    },
    { key: 'documents', header: 'Documentos sugeridos', render: (row) => <SuggestedDocuments documents={row.documents} /> },
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
          <Button size="sm" variant="ghost" icon={LuPencil} onClick={() => setFormState({ open: true, activity: row })}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" icon={row.is_active ? LuBan : LuCircleCheck} onClick={() => setStatusTarget(row)}>
            {row.is_active ? 'Inativar' : 'Reativar'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <ParametersToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Buscar atividade por nome..."
        status={status}
        onStatusChange={setStatus}
        createLabel="Nova atividade"
        onCreate={() => setFormState({ open: true, activity: null })}
      />

      {loadError && <Banner tone="danger" description={loadError} />}
      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      <DataTable
        columns={columns}
        rows={activities}
        isLoading={isLoading}
        emptyTitle="Nenhuma atividade encontrada"
        emptyDescription="Ajuste a busca ou o filtro de status, ou crie uma nova atividade."
      />

      <ActivityFormModal
        open={formState.open}
        activity={formState.activity}
        onClose={closeForm}
        onSuccess={handleFormSuccess}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        title={statusTarget?.is_active ? 'Inativar atividade' : 'Reativar atividade'}
        description={
          statusTarget?.is_active
            ? `"${statusTarget.name}" deixa de aparecer como opção nas novas solicitações. As solicitações já feitas não mudam. Dá para reativar depois.`
            : `"${statusTarget?.name ?? ''}" volta a aparecer como opção nas novas solicitações.`
        }
        confirmLabel={statusTarget?.is_active ? 'Inativar' : 'Reativar'}
        variant={statusTarget?.is_active ? 'danger' : 'primary'}
        isLoading={isChangingStatus}
      />
    </div>
  );
}
