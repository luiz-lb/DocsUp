// Filtros da aba Documentos (Docs de Fornecedores). Ficam guardados pela página enquanto ela
// estiver aberta (também ao trocar de aba); a lista vem inteira e é filtrada aqui.
export const EMPTY_DOCUMENT_FILTERS = {
  search: '',
  supplierId: '',
  location: '',
  requestId: '',
  documentTypeId: '',
  status: '',
  scope: '',
  from: '',
  to: '',
};

// Valor da opção "Sem local" (documentos sem solicitação ou solicitação sem local)
export const NO_LOCATION = '__sem_local__';

/** Texto sem acentos e em minúsculas, para a busca. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Data de envio no horário local, como o <input type="date"> ('AAAA-MM-DD'). */
function localDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function hasActiveFilters(filters) {
  return Object.values(filters).some((value) => value !== '');
}

/** Documentos que passam em todos os filtros preenchidos. */
export function filterDocuments(documents, filters) {
  const term = normalize(filters.search.trim());
  return documents.filter((doc) => {
    if (term && !normalize(`${doc.document_type_name} ${doc.employee_name ?? ''} ${doc.file_name} ${doc.supplier_name ?? ''}`).includes(term)) {
      return false;
    }
    if (filters.supplierId && String(doc.supplier_id) !== filters.supplierId) return false;
    if (filters.location) {
      const location = doc.labor_request_location?.trim() || NO_LOCATION;
      if (location !== filters.location) return false;
    }
    if (filters.requestId && String(doc.labor_request_id ?? '') !== filters.requestId) return false;
    if (filters.documentTypeId && String(doc.document_type_id) !== filters.documentTypeId) return false;
    if (filters.status && String(doc.status) !== filters.status) return false;
    if (filters.scope === 'empresa' && doc.employee_id) return false;
    if (filters.scope === 'colaborador' && !doc.employee_id) return false;
    if (filters.from || filters.to) {
      const day = localDay(doc.uploaded_at);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
    }
    return true;
  });
}

/** Opções dos filtros a partir de todos os documentos (não mudam conforme se filtra). */
export function buildFilterOptions(documents) {
  const suppliers = new Map();
  const locations = new Set();
  const requests = new Map();
  const documentTypes = new Map();

  for (const doc of documents) {
    if (doc.supplier_id) suppliers.set(String(doc.supplier_id), doc.supplier_name ?? `Fornecedor ${doc.supplier_id}`);
    locations.add(doc.labor_request_location?.trim() || NO_LOCATION);
    if (doc.labor_request_id) requests.set(String(doc.labor_request_id), doc.labor_request_title ?? `Solicitação ${doc.labor_request_id}`);
    documentTypes.set(String(doc.document_type_id), doc.document_type_name);
  }

  const byLabel = (a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR');
  const toOptions = (map) => [...map.entries()].map(([value, label]) => ({ value, label })).sort(byLabel);

  return {
    suppliers: toOptions(suppliers),
    locations: [...locations]
      .map((value) => ({ value, label: value === NO_LOCATION ? 'Sem local' : value }))
      .sort(byLabel),
    requests: toOptions(requests),
    documentTypes: toOptions(documentTypes),
  };
}
