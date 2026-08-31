import { findDocumentType } from '../../../../mocks/catalog.js';
import { cn } from '../../../../utils/cn.js';
import styles from './CompanyChecklistForm.module.css';

/**
 * Checklist "a empresa possui este documento?" para os documentos exigidos
 * pela solicitacao (APR, PGR, CIPA...). `values` = { [documentTypeId]: boolean }
 */
export default function CompanyChecklistForm({ documentTypeIds, values, onChange }) {
  return (
    <div className={styles.list}>
      {documentTypeIds.map((docId) => {
        const doc = findDocumentType(docId);
        const hasDocument = values[docId] ?? false;

        return (
          <div key={docId} className={styles.row}>
            <span>{doc?.name}</span>
            <div className={styles.toggle}>
              <button
                type="button"
                className={cn(styles.option, hasDocument && styles.yes)}
                onClick={() => onChange({ ...values, [docId]: true })}
              >
                Possui
              </button>
              <button
                type="button"
                className={cn(styles.option, values[docId] === false && styles.no)}
                onClick={() => onChange({ ...values, [docId]: false })}
              >
                Nao possui
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
