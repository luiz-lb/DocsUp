import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listActivities, listDocumentTypes } from '../api/parametersApi.js';

// Filtros vazios não vão na URL (sem valor = sem filtro)
const clean = (value) => (value === '' || value === null ? undefined : value);

export function useDocumentTypes({ category, status, search = '' } = {}) {
  return useAsyncData(
    () => listDocumentTypes({ category: clean(category), status: clean(status), search: clean(search.trim()) }),
    [category, status, search],
  );
}

export function useActivities({ status, search = '' } = {}) {
  return useAsyncData(
    () => listActivities({ status: clean(status), search: clean(search.trim()) }),
    [status, search],
  );
}
