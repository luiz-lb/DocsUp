import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listSuppliers, getSupplierDetail } from '../api/suppliersApi.js';

export function useSuppliers() {
  return useAsyncData(() => listSuppliers(), []);
}

export function useSupplier(id) {
  return useAsyncData(() => getSupplierDetail(id), [id]);
}
