import { PageHeader, DataTable, StatusBadge } from '../../../components/ui/index.js';
import { EMPLOYEE_STATUS } from '../../../constants/enums.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listEmployees } from '../api/employeesApi.js';
import NrBadgeList from '../components/NrBadgeList/index.js';

const COLUMNS = [
  { key: 'full_name', header: 'Colaborador' },
  { key: 'supplier_name', header: 'Fornecedor' },
  { key: 'labor_request_title', header: 'Solicitação' },
  { key: 'role_function', header: 'Função' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge enumMap={EMPLOYEE_STATUS} value={row.status} />,
  },
];

export default function EmployeeListPage() {
  const { data: employees, isLoading } = useAsyncData(listEmployees, []);

  return (
    <div>
      <PageHeader
        eyebrow="RH & Segurança"
        title="Colaboradores"
        description="Todos os colaboradores enviados pelos fornecedores na Fase 2, com o status de validação documental."
      />
      <DataTable
        columns={COLUMNS}
        rows={employees ?? []}
        isLoading={isLoading}
        emptyTitle="Nenhum colaborador enviado ainda"
      />
    </div>
  );
}
