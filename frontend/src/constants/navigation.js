import {
  LuLayoutDashboard,
  LuClipboardList,
  LuFileStack,
  LuTruck,
  LuUsers,
  LuStar,
  LuReceipt,
  LuFolderCheck,
} from 'react-icons/lu';
import { ROUTES } from './routes.js';

// Navegacao lateral e' orientada por departamento (users.department), nao por
// role fixa por pagina: cada item declara quais departamentos o enxergam.
// department = null => visivel para todos os departamentos autenticados.
export const NAV_ITEMS = [
  { label: 'Painel', to: ROUTES.home, icon: LuLayoutDashboard, department: null },
  { label: 'Solicitacoes de Serviços', to: ROUTES.laborRequests.list, icon: LuClipboardList, department: null },
  { label: 'Fornecedores', to: ROUTES.suppliers.list, icon: LuTruck, department: [2, 6] },
  { label: 'Documentos', to: ROUTES.documents.review, icon: LuFolderCheck, department: [0, 1] },
  { label: 'Colaboradores', to: ROUTES.employees.list, icon: LuUsers, department: [0, 1, 5] },
  { label: 'Avaliacão de Fornecedores', to: ROUTES.scoring.board, icon: LuStar, department: [0, 2, 5] },
  { label: 'Pedidos & Pagamentos', to: ROUTES.purchaseOrders.list, icon: LuReceipt, department: [3, 4, 2] },
];

export function visibleNavItems(department) {
  return NAV_ITEMS.filter((item) => !item.department || item.department.includes(department));
}
