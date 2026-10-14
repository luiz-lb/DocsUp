import { useParams } from 'react-router-dom';
import { Card, PageHeader, StatusBadge, ScoreGauge, EmptyState } from '../../../components/ui/index.js';
import { SUPPLIER_STATUS, CONTACT_TYPE } from '../../../constants/enums.js';
import { formatCnpj } from '../../../utils/formatters.js';
import { useSupplier } from '../hooks/useSuppliers.js';
import styles from './SupplierProfilePage.module.css';

export default function SupplierProfilePage() {
  const { id } = useParams();
  const { data, isLoading } = useSupplier(id);

  if (isLoading) return null;
  if (!data?.supplier) return <EmptyState title="Fornecedor não encontrado" />;

  const { supplier, contacts = [], regions = [], categories = [] } = data;

  const localidade = supplier.city
    ? `${supplier.city}/${supplier.state ?? ''}`.replace(/\/$/, '')
    : '—';

  return (
    <div>
      <PageHeader
        eyebrow={formatCnpj(supplier.cnpj)}
        title={supplier.razao_social}
        description={`${localidade} · ${supplier.employee_count ?? 0} funcionários`}
        actions={<StatusBadge enumMap={SUPPLIER_STATUS} value={supplier.status} />}
      />

      <div className={styles.layout}>
        <Card>
          <Card.Body className={styles.scoreBody}>
            <ScoreGauge score={Number(supplier.overall_score ?? 0)} size={120} label="Score geral" />
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <h3 className={styles.sectionTitle}>Contatos</h3>
            {contacts.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhum contato cadastrado.</p>
            ) : (
              <ul className={styles.contactList}>
                {contacts.map((contact) => (
                  <li key={contact.email}>
                    <StatusBadge enumMap={CONTACT_TYPE} value={contact.contact_type} />
                    <span>{contact.name || contact.email}</span>
                    <span className={styles.contactEmail}>{contact.email}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className={styles.sectionTitle}>Atuação</h3>
            {categories.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhuma atividade cadastrada.</p>
            ) : (
              <div className={styles.tagRow}>
                {categories.map((category) => (
                  <span key={category.id} className={styles.tag}>{category.name}</span>
                ))}
              </div>
            )}

            <h3 className={styles.sectionTitle}>Regiões atendidas</h3>
            {regions.length === 0 ? (
              <p className={styles.emptyMsg}>Nenhuma região cadastrada.</p>
            ) : (
              <div className={styles.tagRow}>
                {regions.map((region) => (
                  <span key={region.id} className={styles.tag}>
                    {region.city ? `${region.city}/${region.state}` : region.state}
                  </span>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
