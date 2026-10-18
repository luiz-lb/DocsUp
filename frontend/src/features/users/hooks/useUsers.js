import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listUsers } from '../api/usersApi.js';

export function useUsers({ page = 1, limit = 10, search = '', department, status } = {}) {
  return useAsyncData(
    () => listUsers({ page, limit, search, department, status }),
    [page, limit, search, department, status],
  );
}
