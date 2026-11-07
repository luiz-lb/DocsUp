import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, StatusBadge } from '../../../components/ui/index.js';
import { SUPPLIER_STATUS } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import { formatCnpj, formatDate } from '../../../utils/formatters.js';
import { useSuppliers } from '../hooks/useSuppliers.js';
import styles from './SupplierListPage.module.css';

function UserCell({ name, email }) {
  if (!email) return '—';
  return (
    <div>
      <span>{name || email}</span>
      {name && <div className={styles.cnpj}>{email}</div>}
    </div>
  );
}

const COLUMNS = [
  {
    key: 'razao_social',
    header: 'Fornecedor',
    render: (row) => (
      <div>
        <strong>{row.nome_fantasia || row.razao_social}</strong>
        <div className={styles.cnpj}>{formatCnpj(row.cnpj)}</div>
      </div>
    ),
  },
  {
    key: 'owner',
    header: 'Responsável',
    render: (row) => <UserCell name={row.owner_name} email={row.owner_email} />,
  },
  {
    key: 'operator',
    header: 'Operador',
    render: (row) => <UserCell name={row.operator_name} email={row.operator_email} />,
  },
  { key: 'created_at', header: 'Cadastrado em', render: (row) => formatDate(row.created_at) },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={SUPPLIER_STATUS} value={row.status} /> },
];

export default function SupplierListPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        eyebrow="Suprimentos"
        title="Fornecedores"
        description="Fornecedores cadastrados no portal, com o Responsável e o Operador de cada um."
      />
      <DataTable
        columns={COLUMNS}
        rows={suppliers ?? []}
        isLoading={isLoading}
        onRowClick={(row) => navigate(ROUTES.suppliers.profile(row.id))}
        emptyTitle="Nenhum fornecedor cadastrado"
        stackOnMobile
      />
    </div>
  );
}
