import { useState, useEffect, useRef } from 'react';
import { LuSearch, LuPlus, LuX } from 'react-icons/lu';
import FormField from '../../../../components/ui/FormField/index.js';
import styles from './SearchSelectList.module.css';

/**
 * Campo de busca com resultados em dropdown + lista de itens selecionados abaixo.
 *
 * Substitui a antiga grade de "chips clicáveis": em vez de renderizar todas as
 * opções (custoso para milhares de cidades), o usuário pesquisa e adiciona.
 *
 * Props:
 *  - label          : string
 *  - placeholder    : string
 *  - selected       : Array<{ id, label, sublabel? }>  itens já escolhidos
 *  - onAdd          : (item) => void
 *  - onRemove       : (id) => void
 *  - fetchOptions   : async (query: string) => Array<{ id, label, sublabel? }>
 *  - minChars       : nº mínimo de caracteres para disparar a busca (default 2)
 *  - extraAction    : node opcional renderizado ao lado da busca (ex.: "adicionar estado inteiro")
 *  - emptyHint      : texto exibido quando não há itens selecionados
 */
export default function SearchSelectList({
  label,
  placeholder = 'Pesquisar…',
  selected = [],
  onAdd,
  onRemove,
  fetchOptions,
  minChars = 0,
  extraAction = null,
  emptyHint = 'Nenhum item adicionado ainda.',
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Busca com debounce de 300ms
  useEffect(() => {
    if (query.trim().length < minChars) {
      setOptions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      const results = await fetchOptions(query.trim());
      setOptions(results);
      setIsLoading(false);
      setShowDropdown(true);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, minChars, fetchOptions]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedIds = new Set(selected.map((s) => s.id));

  const handleAdd = (item) => {
    if (!selectedIds.has(item.id)) {
      onAdd(item);
    }
    setQuery('');
    setOptions([]);
    setShowDropdown(false);
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <FormField label={label}>
        <div className={styles.searchRow}>
          <div className={styles.inputWrap}>
            <LuSearch className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => options.length > 0 && setShowDropdown(true)}
              placeholder={placeholder}
              className={styles.input}
            />
          </div>
          {extraAction}
        </div>
      </FormField>

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className={styles.dropdown}>
          {isLoading ? (
            <p className={styles.dropdownMsg}>Buscando…</p>
          ) : options.length === 0 ? (
            <p className={styles.dropdownMsg}>Nenhum resultado encontrado.</p>
          ) : (
            options.map((opt) => {
              const already = selectedIds.has(opt.id);
              return (
                <button
                  type="button"
                  key={opt.id}
                  className={styles.option}
                  onClick={() => handleAdd(opt)}
                  disabled={already}
                >
                  <span className={styles.optionLabel}>
                    {opt.label}
                    {opt.sublabel && <span className={styles.optionSub}> · {opt.sublabel}</span>}
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

      {/* Lista de selecionados */}
      <div className={styles.selectedList}>
        {selected.length === 0 ? (
          <p className={styles.emptyHint}>{emptyHint}</p>
        ) : (
          selected.map((item) => (
            <span key={item.id} className={styles.tag}>
              {item.label}
              {item.sublabel && <span className={styles.tagSub}>/{item.sublabel}</span>}
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => onRemove(item.id)}
                aria-label={`Remover ${item.label}`}
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
