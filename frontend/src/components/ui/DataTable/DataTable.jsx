import { LuInbox } from 'react-icons/lu';
import EmptyState from '../EmptyState/index.js';
import styles from './DataTable.module.css';

/**
 * Tabela generica orientada a config: `columns` = [{ key, header, render?, width? }].
 * `getRowKey` default usa row.id. Usada por todas as telas de lista das features
 * (solicitacoes, fornecedores, cotacoes, pedidos de compra...).
 */
export default function DataTable({
  columns,
  rows,
  getRowKey = (row) => row.id,
  isLoading = false,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription,
  onRowClick,
}) {
  if (!isLoading && (!rows || rows.length === 0)) {
    return <EmptyState icon={LuInbox} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 4 }).map((_, rowIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={`skeleton-${rowIndex}`}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      <span className={styles.skeleton} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, index) => (
                <tr
                  key={getRowKey(row)}
                  className={onRowClick ? styles.clickableRow : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key}>{column.render ? column.render(row, index) : row[column.key]}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
