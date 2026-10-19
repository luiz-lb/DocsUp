import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listAuditLogs } from '../api/auditApi.js';

export function useAuditLogs({ page = 1, limit = 25, search = '', action, from, to } = {}) {
  return useAsyncData(
    () => listAuditLogs({ page, limit, search, action, from, to }),
    [page, limit, search, action, from, to],
  );
}
