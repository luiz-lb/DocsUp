import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listLaborRequests } from '../../labor-requests/api/laborRequestsApi.js';
import { listReviewQueue } from '../../documents/api/documentsApi.js';
import { getPhase2ByToken } from '../../employees/api/employeesApi.js';
import { listInvoicesWithBlocks } from '../../purchase-orders/api/purchaseOrdersApi.js';

const DEPARTMENT_TO_APPROVAL = { 0: 'RH', 1: 'Seguranca' };

/**
 * Agrega um recorte de cada modulo para o painel inicial. E' o unico lugar
 * do app que consulta varias features de uma vez - qualquer outra tela
 * deve falar so com a api/ da propria feature.
 */
export function useDashboardSummary(department) {
  return useAsyncData(async () => {
    const [laborRequests, reviewQueue, phase2, paymentData] = await Promise.all([
      listLaborRequests(),
      listReviewQueue(),
      getPhase2ByToken('phase2-demo'),
      listInvoicesWithBlocks(),
    ]);

    const approvalDept = DEPARTMENT_TO_APPROVAL[department];
    const pendingApprovals = laborRequests.filter(
      (request) => approvalDept && request.approvals.some((approval) => approval.department === approvalDept && approval.decision === 0),
    );

    return {
      pendingApprovals,
      reviewQueueCount: reviewQueue.length,
      phase2: phase2.deadline,
      activePaymentBlocks: paymentData.paymentBlocks.filter((block) => block.status === 0),
      openLaborRequests: laborRequests.filter((request) => request.status !== 6 && request.status !== 7),
    };
  }, [department]);
}
