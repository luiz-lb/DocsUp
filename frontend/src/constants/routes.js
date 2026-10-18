// Central de paths. Nada de strings de rota espalhadas pelas features.
export const ROUTES = {
  home: '/',

  auth: {
    login: '/auth',
  },

  laborRequests: {
    list: '/solicitacoes',
    new: '/solicitacoes/nova',
    detail: (id = ':id') => `/solicitacoes/${id}`,
  },

  quotations: {
    round: (id = ':roundId') => `/cotacoes/${id}`,
    submit: (token = ':token') => `/cotacoes/responder/${token}`,
  },

  suppliers: {
    list: '/fornecedores',
    profile: (id = ':id') => `/fornecedores/${id}`,
    login: '/fornecedor/entrar',
    mfa: '/fornecedor/mfa',
    register: '/fornecedor/cadastro',
    portal: '/fornecedor/painel',
    myProfile: '/fornecedor/perfil',
  },

  documents: {
    center: '/documentos',
    review: '/documentos/revisao',
    supplierDocs: '/documentos/fornecedores',
  },

  employees: {
    phase2: (token = ':token') => `/fase2/${token}`,
    list: '/colaboradores',
  },

  scoring: {
    evaluate: (requestId = ':requestId') => `/avaliacoes/${requestId}`,
    board: '/ranking-fornecedores',
  },

  purchaseOrders: {
    list: '/pedidos-compra',
    payments: '/pagamentos',
  },

  users: {
    list: '/usuarios',
  },
};
