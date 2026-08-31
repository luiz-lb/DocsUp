import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listLaborRequests, getLaborRequestById } from '../api/laborRequestsApi.js';

export function useLaborRequests() {
  return useAsyncData(listLaborRequests, []);
}

export function useLaborRequest(id) {
  return useAsyncData(() => getLaborRequestById(id), [id]);
}
