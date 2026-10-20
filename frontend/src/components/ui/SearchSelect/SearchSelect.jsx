import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LuCheck, LuChevronDown, LuX } from 'react-icons/lu';
import { cn } from '../../../utils/cn.js';
import styles from './SearchSelect.module.css';

/** Texto sem acentos e em minúsculas, para a busca. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Select com busca: digite para filtrar e escolha com clique ou teclado
 * (setas, Enter e Esc). Use dentro de um FormField, no lugar do <select>.
 *
 * Props:
 *  - options      : Array<{ value, label, group?, hint?, searchText? }>
 *                   group: título do grupo (as opções vêm agrupadas, na ordem recebida)
 *                   hint: texto curto à direita da opção (ex.: 'exigido')
 *                   searchText: texto extra que também entra na busca (ex.: código)
 *  - value        : valor selecionado ('' = nenhum)
 *  - onChange     : (value) => void ('' ao limpar)
 *  - placeholder  : string
 *  - emptyMessage : texto quando a busca não encontra nada
 *  - disabled     : boolean
 */
export default function SearchSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecione ou pesquise…',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled = false,
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((option) => String(option.value) === String(value)) ?? null;

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return options;
    return options.filter((option) => normalize(`${option.label} ${option.searchText ?? ''}`).includes(term));
  }, [options, query]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Mantém a opção destacada visível ao navegar com as setas
  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  const open = () => {
    if (disabled || isOpen) return;
    setQuery('');
    // Abre com a opção selecionada destacada
    setActiveIndex(Math.max(0, options.findIndex((option) => String(option.value) === String(value))));
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  const choose = (option) => {
    onChange?.(String(option.value));
    close();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) open();
      else setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      // Enter escolhe a opção destacada (e não envia o formulário)
      if (isOpen) {
        event.preventDefault();
        if (filtered[activeIndex]) choose(filtered[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        close();
      }
    } else if (event.key === 'Tab') {
      close();
    }
  };

  const activeOption = isOpen ? filtered[activeIndex] : null;

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <div className={styles.control}>
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? `${listId}-${activeIndex}` : undefined}
          className={styles.input}
          value={isOpen ? query : (selected?.label ?? '')}
          placeholder={isOpen && selected ? selected.label : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={open}
          onClick={open}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        {selected && !disabled ? (
          <button
            type="button"
            className={styles.clear}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange?.('');
              close();
            }}
            aria-label="Limpar seleção"
          >
            <LuX />
          </button>
        ) : (
          <LuChevronDown className={styles.chevron} aria-hidden="true" />
        )}
      </div>

      {isOpen && (
        <ul className={styles.dropdown} id={listId} role="listbox" ref={listRef}>
          {filtered.length === 0 ? (
            <li className={styles.message}>{emptyMessage}</li>
          ) : (
            filtered.map((option, index) => {
              const showGroup = option.group && option.group !== filtered[index - 1]?.group;
              const isSelected = String(option.value) === String(value);
              return [
                showGroup && (
                  <li key={`group-${option.group}`} className={styles.group} role="presentation">
                    {option.group}
                  </li>
                ),
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    styles.option,
                    index === activeIndex && styles.optionActive,
                    isSelected && styles.optionSelected,
                  )}
                  // Mantém o foco no campo ao clicar na opção
                  onMouseDown={(event) => event.preventDefault()}
                  // preventDefault: dentro de um <label> (FormField), o clique seria repassado
                  // ao input e reabriria a lista
                  onClick={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.hint && <span className={styles.hint}>{option.hint}</span>}
                  {isSelected && <LuCheck className={styles.check} aria-hidden="true" />}
                </li>,
              ];
            })
          )}
        </ul>
      )}
    </div>
  );
}
