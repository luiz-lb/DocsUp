import { useEffect, useState } from 'react';
import { LuKeyRound, LuPencil, LuSearch, LuUserCheck, LuUserPlus, LuUserX } from 'react-icons/lu';
import {
  PageHeader,
  DataTable,
  Pagination,
  StatusBadge,
  Button,
  Banner,
  ConfirmDialog,
} from '../../../components/ui/index.js';
import { DEPARTMENT } from '../../../constants/enums.js';
import { formatDate } from '../../../utils/formatters.js';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useUsers } from '../hooks/useUsers.js';
import { setUserStatus } from '../api/usersApi.js';
import UserFormModal from '../components/UserFormModal/index.js';
import ResetPasswordModal from '../components/ResetPasswordModal/index.js';
import styles from './UserListPage.module.css';

// Texto do diálogo de ativar/inativar
function statusDialogDescription(target, isSelf) {
  if (!target) return null;
  if (!target.is_active) return `${target.name} volta a conseguir entrar no sistema.`;

  const text = `${target.name} perde o acesso na hora, inclusive nas sessões já abertas. Dá para reativar depois.`;
  if (isSelf) {
    return `${text} Esse é o seu usuário: você sai do sistema. Se você for o último Admin ativo, a reativação só pode ser feita direto no banco.`;
  }
  return text;
}

export default function UserListPage() {
  const { user: currentUser, refreshUser } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const search = useDebouncedValue(searchInput, 400);

  useEffect(() => {
    setPage(1);
  }, [search, department, status]);

  const { data: response, isLoading, reload } = useUsers({
    page,
    limit,
    search,
    department: department === '' ? undefined : Number(department),
    status: status === '' ? undefined : status,
  });

  const users = response?.body ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };
  const loadError = response && !response.success ? response.message : null;

  // Modais: formulário (criar/editar), senha e confirmação de status
  const [formState, setFormState] = useState({ open: false, mode: 'create', user: null });
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isSelf = (row) => row?.id === currentUser.id;

  // Depois de mexer no próprio cadastro, relê o usuário logado: a mudança vale na hora
  // (deixou de ser Admin: a tela fica restrita; inativou a si mesmo: volta para o login).
  const afterChange = async (row, message) => {
    setFeedback({ tone: 'success', message });
    if (isSelf(row)) await refreshUser();
    reload();
  };

  const handleFormSuccess = async (savedUser, mode) => {
    setFormState({ open: false, mode: 'create', user: null });
    const name = savedUser?.name ?? 'Usuário';
    await afterChange(savedUser, mode === 'edit' ? `${name} atualizado.` : `${name} criado.`);
  };

  const handlePasswordSuccess = (target) => {
    setPasswordTarget(null);
    setFeedback({ tone: 'success', message: `Senha de ${target.name} redefinida.` });
  };

  const confirmStatusChange = async () => {
    const target = statusTarget;
    setIsChangingStatus(true);
    const result = await setUserStatus(target.id, !target.is_active);
    setIsChangingStatus(false);
    setStatusTarget(null);

    if (!result.success) {
      setFeedback({ tone: 'danger', message: result.body?.message ?? 'Erro ao alterar o status do usuário.' });
      return;
    }
    await afterChange(target, target.is_active ? `${target.name} foi inativado.` : `${target.name} foi reativado.`);
  };

  const columns = [
    {
      key: 'name',
      header: 'Usuário',
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          {isSelf(row) && <span className={styles.selfTag}>você</span>}
          <div className={styles.email}>{row.email}</div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Departamento',
      render: (row) => <StatusBadge enumMap={DEPARTMENT} value={row.department} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={row.is_active ? 'Ativo' : 'Inativo'} tone={row.is_active ? 'success' : 'neutral'} />
      ),
    },
    { key: 'createdAt', header: 'Criado em', render: (row) => formatDate(row.created_at) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" icon={LuPencil} onClick={() => setFormState({ open: true, mode: 'edit', user: row })}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" icon={LuKeyRound} onClick={() => setPasswordTarget(row)}>
            Senha
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={row.is_active ? LuUserX : LuUserCheck}
            onClick={() => setStatusTarget(row)}
          >
            {row.is_active ? 'Inativar' : 'Reativar'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        description="Usuários internos do DocsUp. O departamento define o que cada um vê e pode fazer."
        actions={
          <Button icon={LuUserPlus} onClick={() => setFormState({ open: true, mode: 'create', user: null })}>
            Novo usuário
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <LuSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        <div className={styles.filters}>
          <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filtrar por departamento">
            <option value="">Todos os departamentos</option>
            {Object.entries(DEPARTMENT).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status">
            <option value="">Ativos e inativos</option>
            <option value="1">Só ativos</option>
            <option value="0">Só inativos</option>
          </select>
        </div>
      </div>

      {loadError && <Banner tone="danger" description={loadError} />}
      {feedback && <Banner tone={feedback.tone} description={feedback.message} />}

      <DataTable
        columns={columns}
        rows={users}
        isLoading={isLoading}
        emptyTitle="Nenhum usuário encontrado"
        emptyDescription="Ajuste a busca ou os filtros, ou crie um novo usuário."
      />

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      <UserFormModal
        open={formState.open}
        mode={formState.mode}
        user={formState.user}
        currentUserId={currentUser.id}
        onClose={() => setFormState({ open: false, mode: 'create', user: null })}
        onSuccess={handleFormSuccess}
      />

      <ResetPasswordModal
        open={Boolean(passwordTarget)}
        user={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onSuccess={handlePasswordSuccess}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        title={statusTarget?.is_active ? 'Inativar usuário' : 'Reativar usuário'}
        description={statusDialogDescription(statusTarget, isSelf(statusTarget))}
        confirmLabel={statusTarget?.is_active ? 'Inativar' : 'Reativar'}
        variant={statusTarget?.is_active ? 'danger' : 'primary'}
        isLoading={isChangingStatus}
      />
    </div>
  );
}
