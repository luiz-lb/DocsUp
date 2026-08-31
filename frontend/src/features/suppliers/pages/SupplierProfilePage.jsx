import { useParams } from 'react-router-dom';
import { Card, PageHeader, StatusBadge, ScoreGauge, EmptyState } from '../../../components/ui/index.js';
import { SUPPLIER_STATUS, CONTACT_TYPE } from '../../../constants/enums.js';
import { SERVICE_CATEGORIES, REGIONS } from '../../../mocks/catalog.js';
import { useSupplier } from '../hooks/useSuppliers.js';
import styles from './SupplierProfilePage.module.css';

export default function SupplierProfilePage() {
  const { id } = useParams();
  const { data: supplier, isLoading } = useSupplier(id);

  if (isLoading) return null;
  if (!supplier) return <EmptyState title="Fornecedor nao encontrado" />;

  return (
    <div>
      <PageHeader
        eyebrow={supplier.cnpj}
        title={supplier.razaoSocial}
        description={`${supplier.city}/${supplier.state} · ${supplier.employeeCount} funcionarios`}
        actions={<StatusBadge enumMap={SUPPLIER_STATUS} value={supplier.status} />}
      />

      <div className={styles.layout}>
        <Card>
          <Card.Body className={styles.scoreBody}>
            <ScoreGauge score={supplier.overallScore} size={120} label="Score geral" />
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <h3 className={styles.sectionTitle}>Contatos</h3>
            <ul className={styles.contactList}>
              {supplier.contacts.map((contact) => (
                <li key={contact.email}>
                  <StatusBadge enumMap={CONTACT_TYPE} value={contact.type} />
                  <span>{contact.name || contact.email}</span>
                  <span className={styles.contactEmail}>{contact.email}</span>
                </li>
              ))}
            </ul>

            <h3 className={styles.sectionTitle}>Atuacao</h3>
            <div className={styles.tagRow}>
              {supplier.categoryIds.map((categoryId) => (
                <span key={categoryId} className={styles.tag}>
                  {SERVICE_CATEGORIES.find((category) => category.id === categoryId)?.name}
                </span>
              ))}
            </div>
            <div className={styles.tagRow}>
              {supplier.regionIds.map((regionId) => {
                const region = REGIONS.find((item) => item.id === regionId);
                return <span key={regionId} className={styles.tag}>{region?.city}/{region?.state}</span>;
              })}
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
