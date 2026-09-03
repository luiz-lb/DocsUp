import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { cn } from '../../../utils/cn.js';
import styles from './Pagination.module.css';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Gera a janela de paginas exibida, com "..." para intervalos grandes. */
function getPageWindow(page, totalPages) {
  const delta = 2;
  const pages = [];

  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    }
  }

  const withDots = [];
  let previous;
  pages.forEach((current) => {
    if (previous !== undefined) {
      if (current - previous === 2) {
        withDots.push(previous + 1);
      } else if (current - previous > 2) {
        withDots.push('...');
      }
    }
    withDots.push(current);
    previous = current;
  });

  return withDots;
}

/**
 * Navegacao de tabela: total de resultados, tamanho de pagina e paginas
 * numeradas (com reticencias para listas longas). `onPageChange` recebe
 * 1-based page number; `onPageSizeChange` reseta a pagina para 1.
 */
export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  if (totalItems === 0) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  const pageWindow = getPageWindow(page, totalPages);

  return (
    <div className={styles.pagination}>
      <div className={styles.summary}>
        Mostrando <strong>{firstItem}</strong>-<strong>{lastItem}</strong> de <strong>{totalItems}</strong> resultados
      </div>

      <div className={styles.pageSize}>
        <label htmlFor="pagination-page-size">Itens por pagina</label>
        <select
          id="pagination-page-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <nav className={styles.pages} aria-label="Paginacao">
        <button
          type="button"
          className={styles.navButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Pagina anterior"
        >
          <LuChevronLeft />
        </button>

        {pageWindow.map((item, index) =>
          item === '...' ? (
            // eslint-disable-next-line react/no-array-index-key
            <span key={`dots-${index}`} className={styles.dots}>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={cn(styles.pageButton, item === page && styles.pageButtonActive)}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className={styles.navButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Proxima pagina"
        >
          <LuChevronRight />
        </button>
      </nav>
    </div>
  );
}
