import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listSuppliers, getSupplier } from '../api/suppliersApi.js';

export function useSuppliers() {
  return useAsyncData(listSuppliers, []);
}

export function useSupplier(id) {
  return useAsyncData(() => getSupplier(id), [id]);
}
