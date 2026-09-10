import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout/index.js';
import PublicLayout from '../components/layout/PublicLayout/index.js';
import RouteFallback from './RouteFallback.jsx';
import { ROUTES } from '../constants/routes.js';
import RequireAuth from '../features/auth/collaborator/RequireAuth.jsx';

// Cada pagina e' code-split via React.lazy: rotas pouco usadas (fase 2,
// cadastro de fornecedor) nao engordam o bundle inicial do painel interno.
const CollaboratorLoginPage = lazy(() => import('../features/auth/collaborator/pages/LoginPage.jsx'));

const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage.jsx'));

const RequestListPage = lazy(() => import('../features/labor-requests/pages/RequestListPage.jsx'));
const NewRequestPage = lazy(() => import('../features/labor-requests/pages/NewRequestPage.jsx'));
const RequestDetailPage = lazy(() => import('../features/labor-requests/pages/RequestDetailPage.jsx'));

const QuotationRoundPage = lazy(() => import('../features/quotations/pages/QuotationRoundPage.jsx'));
const QuotationSubmitPage = lazy(() => import('../features/quotations/pages/QuotationSubmitPage.jsx'));

const SupplierListPage = lazy(() => import('../features/suppliers/pages/SupplierListPage.jsx'));
const SupplierProfilePage = lazy(() => import('../features/suppliers/pages/SupplierProfilePage.jsx'));
const SupplierLoginPage = lazy(() => import('../features/suppliers/pages/SupplierLoginPage.jsx'));
const SupplierMfaPage = lazy(() => import('../features/suppliers/pages/SupplierMfaPage.jsx'));
const SupplierRegisterPage = lazy(() => import('../features/suppliers/pages/SupplierRegisterPage.jsx'));
const SupplierPortalPage = lazy(() => import('../features/suppliers/pages/SupplierPortalPage.jsx'));

const DocumentCenterPage = lazy(() => import('../features/documents/pages/DocumentCenterPage.jsx'));
const DocumentReviewPage = lazy(() => import('../features/documents/pages/DocumentReviewPage.jsx'));

const Phase2UploadPage = lazy(() => import('../features/employees/pages/Phase2UploadPage.jsx'));
const EmployeeListPage = lazy(() => import('../features/employees/pages/EmployeeListPage.jsx'));

const SupplierEvaluationPage = lazy(() => import('../features/scoring/pages/SupplierEvaluationPage.jsx'));
const ScoreboardPage = lazy(() => import('../features/scoring/pages/ScoreboardPage.jsx'));

const PurchaseOrderListPage = lazy(() => import('../features/purchase-orders/pages/PurchaseOrderListPage.jsx'));
const PaymentTrackingPage = lazy(() => import('../features/purchase-orders/pages/PaymentTrackingPage.jsx'));

function SuspendedOutlet() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <SuspendedOutlet />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { path: ROUTES.home, element: <DashboardPage /> },

              { path: ROUTES.laborRequests.list, element: <RequestListPage /> },
              { path: ROUTES.laborRequests.new, element: <NewRequestPage /> },
              { path: ROUTES.laborRequests.detail(), element: <RequestDetailPage /> },


              { path: ROUTES.quotations.round(), element: <QuotationRoundPage /> },

              { path: ROUTES.suppliers.list, element: <SupplierListPage /> },
              { path: ROUTES.suppliers.profile(), element: <SupplierProfilePage /> },

              { path: ROUTES.documents.center, element: <DocumentCenterPage /> },
              { path: ROUTES.documents.review, element: <DocumentReviewPage /> },

              { path: ROUTES.employees.list, element: <EmployeeListPage /> },

              { path: ROUTES.scoring.evaluate(), element: <SupplierEvaluationPage /> },
              { path: ROUTES.scoring.board, element: <ScoreboardPage /> },

              { path: ROUTES.purchaseOrders.list, element: <PurchaseOrderListPage /> },
              { path: ROUTES.purchaseOrders.payments, element: <PaymentTrackingPage /> },
            ],
          },
        ],
      },
      {
        element: <PublicLayout />,
        children: [
          { path: ROUTES.auth.login, element: <CollaboratorLoginPage /> },
          { path: ROUTES.quotations.submit(), element: <QuotationSubmitPage /> },
          { path: ROUTES.suppliers.login, element: <SupplierLoginPage /> },
          { path: ROUTES.suppliers.mfa, element: <SupplierMfaPage /> },
          { path: ROUTES.suppliers.register, element: <SupplierRegisterPage /> },
          { path: ROUTES.employees.phase2(), element: <Phase2UploadPage /> },
        ],
      },
      // Portal do fornecedor: usa seu próprio shell com sidebar (SupplierLayout),
      // por isso fica fora do PublicLayout para ocupar a tela inteira.
      { path: ROUTES.suppliers.portal, element: <SupplierPortalPage /> },
    ],
  },
]);
