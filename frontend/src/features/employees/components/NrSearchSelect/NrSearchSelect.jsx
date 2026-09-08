import { useEffect, useMemo, useRef, useState } from 'react';
import { LuSearch, LuPlus, LuX } from 'react-icons/lu';
import FormField from '../../../../components/ui/FormField/index.js';
import styles from './NrSearchSelect.module.css';

/**
 * Select pesquisável (multi-seleção) das NRs exigidas para a atividade.
 *
 * Diferente do antigo painel de "chips" com todas as NRs mockadas, aqui as
 * opções vêm do backend (labor_request_NRs — definidas por Segurança do
 * Trabalho para a atividade) e o usuário pesquisa por código, nome ou descrição.
 *
 * Props:
 *  - label        : string
 *  - options      : Array<{ id, code, name }>   NRs disponíveis (exigidas na atividade)
 *  - selectedIds  : number[]                     ids atualmente selecionados
 *  - onChange     : (ids: number[]) => void
 *  - placeholder  : string
 */
export default function NrSearchSelect({
  label = 'NRs deste colaborador',
  options = [],
  selectedIds = [],
  onChange,
  placeholder = 'Pesquisar NR por código ou nome…',
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) =>
      [opt.code, opt.name, opt.description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [options, query]);

  const selectedOptions = options.filter((opt) => selectedSet.has(opt.id));

  const handleAdd = (id) => {
    if (!selectedSet.has(id)) {
      onChange?.([...selectedIds, id]);
    }
    setQuery('');
    setShowDropdown(false);
  };

  const handleRemove = (id) => {
    onChange?.(selectedIds.filter((item) => item !== id));
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <FormField label={label}>
        <div className={styles.inputWrap}>
          <LuSearch className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className={styles.input}
          />
        </div>
      </FormField>

      {showDropdown && (
        <div className={styles.dropdown}>
          {options.length === 0 ? (
            <p className={styles.dropdownMsg}>Nenhuma NR exigida para esta atividade.</p>
          ) : filtered.length === 0 ? (
            <p className={styles.dropdownMsg}>Nenhum resultado encontrado.</p>
          ) : (
            filtered.map((opt) => {
              const already = selectedSet.has(opt.id);
              return (
                <button
                  type="button"
                  key={opt.id}
                  className={styles.option}
                  onClick={() => handleAdd(opt.id)}
                  disabled={already}
                >
                  <span className={styles.optionLabel}>
                    <strong>{opt.code}</strong>
                    {opt.name && <span className={styles.optionSub}> · {opt.name}</span>}
                  </span>
                  {already ? (
                    <span className={styles.optionAdded}>Adicionado</span>
                  ) : (
                    <LuPlus className={styles.optionIcon} aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      <div className={styles.selectedList}>
        {selectedOptions.length === 0 ? (
          <p className={styles.emptyHint}>Nenhuma NR selecionada.</p>
        ) : (
          selectedOptions.map((item) => (
            <span key={item.id} className={styles.tag}>
              {item.code}
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => handleRemove(item.id)}
                aria-label={`Remover ${item.code}`}
              >
                <LuX />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
