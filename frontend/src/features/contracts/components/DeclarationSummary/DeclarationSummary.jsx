import { LuChevronRight, LuFileCheck } from 'react-icons/lu';
import { StatusBadge } from '../../../../components/ui/index.js';
import { DOCUMENT_CATEGORY_ID } from '../../../../constants/enums.js';
import { formatDateTime } from '../../../../utils/formatters.js';
import styles from './DeclarationSummary.module.css';

/**
 * Resumo da declaração assinada, no contrato do fornecedor: documentos da empresa (tem / não
 * tem) e, para cada documento de colaborador, quantos funcionários foram declarados e quantos
 * já foram enviados (colaboradores com o documento atual).
 *
 * Props: declaration (linhas do backend), assignment ({ declaredAt, declaredByName }),
 *        employees (colaboradores com os documentos atuais; opcional)
 */
export default function DeclarationSummary({ declaration = [], assignment, employees = [] }) {
  if (declaration.length === 0) return null;

  const company = declaration.filter((row) => row.category === DOCUMENT_CATEGORY_ID.EMPRESA);
  const employeeRows = declaration.filter((row) => row.category !== DOCUMENT_CATEGORY_ID.EMPRESA);

  // Colaboradores com o documento enviado (atual), por tipo
  const sentByType = new Map();
  for (const employee of employees) {
    for (const document of employee.documents ?? []) {
      sentByType.set(document.document_type_id, (sentByType.get(document.document_type_id) ?? 0) + 1);
    }
  }

  return (
    <details className={styles.box}>
      <summary>
        <LuChevronRight className={styles.chevron} aria-hidden="true" />
        <LuFileCheck aria-hidden="true" />
        Sua declaração
        {assignment?.declaredAt && (
          <span className={styles.meta}>
            assinada em {formatDateTime(assignment.declaredAt)}
            {assignment.declaredByName ? ` por ${assignment.declaredByName}` : ''}
          </span>
        )}
      </summary>
      <div className={styles.grid}>
        {company.length > 0 && (
          <div>
            <p className={styles.title}>Documentos da empresa</p>
            <ul className={styles.list}>
              {company.map((row) => (
                <li key={row.document_type_id}>
                  <span>{row.document_type_name}</span>
                  <StatusBadge label={row.has_document ? 'Tem' : 'Não tem'} tone={row.has_document ? 'success' : 'danger'} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {employeeRows.length > 0 && (
          <div>
            <p className={styles.title}>Colaboradores por documento</p>
            <ul className={styles.list}>
              {employeeRows.map((row) => {
                const sent = sentByType.get(row.document_type_id) ?? 0;
                return (
                  <li key={row.document_type_id}>
                    <span>{row.document_type_name}</span>
                    <span className={sent >= row.employee_count ? styles.done : styles.pending}>
                      {sent} de {row.employee_count} enviados
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
