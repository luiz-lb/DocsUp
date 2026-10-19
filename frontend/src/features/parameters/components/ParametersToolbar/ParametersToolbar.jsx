import { LuPlus, LuSearch } from 'react-icons/lu';
import { Button } from '../../../../components/ui/index.js';
import styles from './ParametersToolbar.module.css';

/**
 * Barra das abas de Parâmetros: busca, filtro de status e botão de criar.
 *
 * Props:
 *  - search / onSearchChange : texto da busca (o debounce fica com quem usa)
 *  - searchPlaceholder       : string
 *  - status / onStatusChange : '' (todos) | '1' (ativos) | '0' (inativos)
 *  - createLabel / onCreate  : botão de criar
 */
export default function ParametersToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar por nome...',
  status,
  onStatusChange,
  createLabel,
  onCreate,
}) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.searchField}>
        <LuSearch className={styles.searchIcon} />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className={styles.filters}>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Filtrar por status">
          <option value="">Ativos e inativos</option>
          <option value="1">Só ativos</option>
          <option value="0">Só inativos</option>
        </select>

        <Button icon={LuPlus} onClick={onCreate}>
          {createLabel}
        </Button>
      </div>
    </div>
  );
}
