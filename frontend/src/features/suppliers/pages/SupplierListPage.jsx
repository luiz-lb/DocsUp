import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, StatusBadge } from '../../../components/ui/index.js';
import { SUPPLIER_STATUS } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import { useSuppliers } from '../hooks/useSuppliers.js';
import styles from './SupplierListPage.module.css';

const COLUMNS = [
  {
    key: 'razaoSocial',
    header: 'Fornecedor',
    render: (row) => (
      <div>
        <strong>{row.nomeFantasia}</strong>
        <div className={styles.cnpj}>{row.cnpj}</div>
      </div>
    ),
  },
  { key: 'city', header: 'Cidade', render: (row) => `${row.city}/${row.state}` },
  { key: 'employeeCount', header: 'Funcionarios' },
  { key: 'overallScore', header: 'Score', render: (row) => row.overallScore?.toFixed(1) ?? '-' },
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
        description="Base de fornecedores cadastrados, com score de qualificacao e status de documentacao."
      />
      <DataTable
        columns={COLUMNS}
        rows={suppliers ?? []}
        isLoading={isLoading}
        onRowClick={(row) => navigate(ROUTES.suppliers.profile(row.id))}
        emptyTitle="Nenhum fornecedor cadastrado"
      />
    </div>
  );
}
