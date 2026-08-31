import { LuFileCheck2 } from 'react-icons/lu';
import { DOCUMENT_TYPES } from '../../../mocks/catalog.js';
import { getDocumentsTypes } from '../api/laborRequestsApi.js'
import { cn } from '../../../utils/cn.js';
import { useState, useEffect } from 'react';
import styles from './DocumentChecklistPicker.module.css';

/**
 * RH/Seguranca escolhem os documentos exigidos para a contratacao, partindo
 * de uma lista pre-preenchida sugerida pelo tipo de atividade (`suggestedIds`).
 */
export default function DocumentChecklistPicker({ selectedIds, suggestedIds = [], onChange }) {
  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  };

  const [documentsTypes, setDocumentsTypes] = useState([]);

  useEffect(() => {
    async function fetchDocs() {
      const response = await getDocumentsTypes();
      // Assumindo que a resposta tenha um '.body' que seja um array
      setDocumentsTypes(response.body); 
    }
    fetchDocs();
  }, []);

  return (
    <div className={styles.grid}>
      {documentsTypes.map((doc) => {
        const isSelected = selectedIds.includes(doc.id);
        const isSuggested = suggestedIds.includes(doc.id);

        return (
          <label key={doc.id} className={cn(styles.option, isSelected && styles.selected)}>
            <input type="checkbox" checked={isSelected} onChange={() => toggle(doc.id)} />
            <div>
              <span className={styles.name}>{doc.name}</span>
              {isSuggested && (
                <span className={styles.suggested}>
                  <LuFileCheck2 /> sugerido para esta atividade
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
