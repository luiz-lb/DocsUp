import {
  LuLayoutDashboard,
  LuClipboardList,
  LuFileStack,
  LuTruck,
  LuUsers,
  LuStar,
  LuReceipt,
  LuFolderCheck,
  LuUserCog,
  LuHistory,
  LuSettings,
} from 'react-icons/lu';
import { ROUTES } from './routes.js';
import { DEPARTMENT_ID } from './enums.js';
import { ACCESS } from './access.js';

// Navegacao lateral e' orientada por departamento (users.department), nao por
// role fixa por pagina: cada item declara quais departamentos o enxergam.
// department = null => visivel para todos os departamentos autenticados.
// O Admin enxerga todos os itens.
export const NAV_ITEMS = [
  { label: 'Painel', to: ROUTES.home, icon: LuLayoutDashboard, department: null },
  { label: 'Solicitações de Serviços', to: ROUTES.laborRequests.list, icon: LuClipboardList, department: null },
  { label: 'Fornecedores', to: ROUTES.suppliers.list, icon: LuTruck, department: ACCESS.suppliers },
  { label: 'Documentos', to: ROUTES.documents.review, icon: LuFolderCheck, department: ACCESS.supplierDocuments },
  { label: 'Docs de Fornecedores', to: ROUTES.documents.supplierDocs, icon: LuFileStack, department: ACCESS.supplierDocuments },
  { label: 'Colaboradores', to: ROUTES.employees.list, icon: LuUsers, department: ACCESS.employees },
  { label: 'Avaliação de Fornecedores', to: ROUTES.scoring.board, icon: LuStar, department: [0, 2, 5] },
  { label: 'Pedidos & Pagamentos', to: ROUTES.purchaseOrders.list, icon: LuReceipt, department: [3, 4, 2] },
  { label: 'Usuários', to: ROUTES.users.list, icon: LuUserCog, department: ACCESS.admin },
  { label: 'Parâmetros', to: ROUTES.parameters.list, icon: LuSettings, department: ACCESS.admin },
  { label: 'Auditoria', to: ROUTES.audit.list, icon: LuHistory, department: ACCESS.admin },
];

export function visibleNavItems(department) {
  if (department === DEPARTMENT_ID.ADMIN) return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => !item.department || item.department.includes(department));
}
