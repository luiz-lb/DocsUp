import { useNavigate } from 'react-router-dom';
import { PageHeader, DataTable, StatusBadge } from '../../../components/ui/index.js';
import { SUPPLIER_STATUS } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import { formatCnpj } from '../../../utils/formatters.js';
import { useSuppliers } from '../hooks/useSuppliers.js';
import styles from './SupplierListPage.module.css';

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
    key: 'city',
    header: 'Cidade',
    render: (row) => (row.city ? `${row.city}/${row.state ?? ''}`.replace(/\/$/, '') : '—'),
  },
  { key: 'employee_count', header: 'Funcionários', render: (row) => row.employee_count ?? '—' },
  { key: 'overall_score', header: 'Score', render: (row) => (row.overall_score != null ? Number(row.overall_score).toFixed(1) : '-') },
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
        description="Base de fornecedores cadastrados, com score de qualificação e status de documentação."
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
