import { cn } from '../../../../utils/cn.js';
import styles from './CompanyChecklistForm.module.css';

/**
 * Checklist "a empresa possui este documento?" para os documentos exigidos
 * pela solicitação. `documents` = [{ id, name }] (id = document_type_id, nome vindo
 * do backend); `values` = { [documentTypeId]: boolean }
 */
export default function CompanyChecklistForm({ documents, values, onChange }) {
  return (
    <div className={styles.list}>
      {documents.map((doc) => {
        const hasDocument = values[doc.id] ?? false;

        return (
          <div key={doc.id} className={styles.row}>
            <span>{doc.name}</span>
            <div className={styles.toggle}>
              <button
                type="button"
                className={cn(styles.option, hasDocument && styles.yes)}
                onClick={() => onChange({ ...values, [doc.id]: true })}
              >
                Possui
              </button>
              <button
                type="button"
                className={cn(styles.option, values[doc.id] === false && styles.no)}
                onClick={() => onChange({ ...values, [doc.id]: false })}
              >
                Não possui
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
