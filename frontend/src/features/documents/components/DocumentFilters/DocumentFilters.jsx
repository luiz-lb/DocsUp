import { useState } from 'react';
import { LuSearch, LuSlidersHorizontal, LuX } from 'react-icons/lu';
import { Button, FormField, SearchSelect } from '../../../../components/ui/index.js';
import { DOCUMENT_STATUS } from '../../../../constants/enums.js';
import { cn } from '../../../../utils/cn.js';
import { EMPTY_DOCUMENT_FILTERS, hasActiveFilters } from './documentFilters.js';
import styles from './DocumentFilters.module.css';

/**
 * Busca e filtros da aba Documentos: contrato, fornecedor, obra (local), solicitação, documento, status,
 * escopo (empresa / colaborador) e data de envio. Fornecedor e documento têm busca.
 *
 * Props:
 *  - filters         : ver EMPTY_DOCUMENT_FILTERS
 *  - onFiltersChange : (filters) => void
 *  - options         : { contracts, suppliers, locations, requests, documentTypes } (buildFilterOptions)
 *  - resultCount     : quantos documentos passaram nos filtros
 */
export default function DocumentFilters({ filters, onFiltersChange, options, resultCount }) {
  // No celular os campos ficam recolhidos atrás do botão "Filtros" (no computador, sempre abertos)
  const [isOpen, setIsOpen] = useState(false);
  const set = (field, value) => onFiltersChange({ ...filters, [field]: value });
  const setFromEvent = (field) => (event) => set(field, event.target.value);
  const active = hasActiveFilters(filters);
  // Filtros preenchidos além da busca (mostrado no botão do celular)
  const fieldCount = Object.entries(filters).filter(([field, value]) => field !== 'search' && value !== '').length;

  return (
    <div className={styles.filters}>
      <div className={styles.searchRow}>
        <label className={styles.searchField}>
          <LuSearch className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar por colaborador, documento, arquivo, fornecedor ou contrato..."
            value={filters.search}
            onChange={setFromEvent('search')}
          />
        </label>
        <Button
          size="sm"
          variant="ghost"
          icon={LuSlidersHorizontal}
          className={styles.toggle}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
        >
          Filtros{fieldCount > 0 ? ` (${fieldCount})` : ''}
        </Button>
        {active && (
          <span className={styles.result}>
            {resultCount} documento{resultCount === 1 ? '' : 's'} encontrado{resultCount === 1 ? '' : 's'}
          </span>
        )}
        {active && (
          <Button size="sm" variant="ghost" icon={LuX} onClick={() => onFiltersChange(EMPTY_DOCUMENT_FILTERS)}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className={cn(styles.grid, isOpen && styles.gridOpen)}>
        <FormField label="Contrato" className={styles.field}>
          <SearchSelect
            options={options.contracts}
            value={filters.contract}
            onChange={(value) => set('contract', value)}
            placeholder="Todos"
            emptyMessage="Nenhum contrato encontrado."
          />
        </FormField>

        <FormField label="Fornecedor" className={styles.field}>
          <SearchSelect
            options={options.suppliers}
            value={filters.supplierId}
            onChange={(value) => set('supplierId', value)}
            placeholder="Todos"
            emptyMessage="Nenhum fornecedor encontrado."
          />
        </FormField>

        <FormField label="Obra (local)" className={styles.field}>
          <select value={filters.location} onChange={setFromEvent('location')}>
            <option value="">Todas</option>
            {options.locations.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Solicitação" className={styles.field}>
          <select value={filters.requestId} onChange={setFromEvent('requestId')}>
            <option value="">Todas</option>
            {options.requests.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Documento" className={styles.field}>
          <SearchSelect
            options={options.documentTypes}
            value={filters.documentTypeId}
            onChange={(value) => set('documentTypeId', value)}
            placeholder="Todos"
            emptyMessage="Nenhum documento encontrado."
          />
        </FormField>

        <FormField label="Status" className={styles.field}>
          <select value={filters.status} onChange={setFromEvent('status')}>
            <option value="">Todos</option>
            {Object.entries(DOCUMENT_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Escopo" className={styles.field}>
          <select value={filters.scope} onChange={setFromEvent('scope')}>
            <option value="">Empresa e colaboradores</option>
            <option value="empresa">Só da empresa</option>
            <option value="colaborador">Só de colaboradores</option>
          </select>
        </FormField>

        <FormField label="Enviado de" className={styles.field}>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={setFromEvent('from')} />
        </FormField>

        <FormField label="Enviado até" className={styles.field}>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={setFromEvent('to')} />
        </FormField>
      </div>
    </div>
  );
}
