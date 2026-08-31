import { PageHeader, DataTable, StatusBadge } from '../../../components/ui/index.js';
import { EMPLOYEE_STATUS } from '../../../constants/enums.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listEmployees } from '../api/employeesApi.js';
import NrBadgeList from '../components/NrBadgeList/index.js';

const COLUMNS = [
  { key: 'fullName', header: 'Colaborador' },
  { key: 'supplierName', header: 'Fornecedor' },
  { key: 'roleFunction', header: 'Funcao' },
  { key: 'nrIds', header: 'NRs', render: (row) => <NrBadgeList nrIds={row.nrIds} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={EMPLOYEE_STATUS} value={row.status} /> },
];

export default function EmployeeListPage() {
  const { data: employees, isLoading } = useAsyncData(listEmployees, []);

  return (
    <div>
      <PageHeader
        eyebrow="RH & Seguranca"
        title="Colaboradores"
        description="Todos os colaboradores enviados pelos fornecedores na Fase 2, com o status de validacao documental."
      />
      <DataTable columns={COLUMNS} rows={employees ?? []} isLoading={isLoading} emptyTitle="Nenhum colaborador enviado ainda" />
    </div>
  );
}
