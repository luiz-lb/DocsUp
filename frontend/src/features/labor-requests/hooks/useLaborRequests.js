import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listLaborRequests, getLaborRequestById, getApprovals } from '../api/laborRequestsApi.js';

export function useLaborRequests({ page = 1, limit = 10, search = '', status, urgency } = {}) {
  return useAsyncData(
    () => listLaborRequests({ page, limit, search, status, urgency }),
    [page, limit, search, status, urgency],
  );
}

export function useLaborRequest(id) {
  return useAsyncData(() => getLaborRequestById(id), [id]);
}

export function useLaborRequestApprovals(laborRequestId) {
  return useAsyncData(() => getApprovals(laborRequestId), [laborRequestId]);
}
