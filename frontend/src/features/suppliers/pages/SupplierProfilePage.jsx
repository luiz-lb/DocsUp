import { useParams } from 'react-router-dom';
import { Card, PageHeader, StatusBadge, EmptyState } from '../../../components/ui/index.js';
import { SUPPLIER_STATUS, SUPPLIER_USER_ROLE } from '../../../constants/enums.js';
import { formatCnpj, formatDate } from '../../../utils/formatters.js';
import { useSupplier } from '../hooks/useSuppliers.js';
import styles from './SupplierProfilePage.module.css';

/** Detalhe do fornecedor (Suprimentos): dados da empresa e os dois usuários do portal. */
export default function SupplierProfilePage() {
  const { id } = useParams();
  const { data, isLoading } = useSupplier(id);

  if (isLoading) return null;
  if (!data?.supplier) return <EmptyState title="Fornecedor não encontrado" />;

  const { supplier, users = [] } = data;

  return (
    <div>
      <PageHeader
        eyebrow={formatCnpj(supplier.cnpj)}
        title={supplier.razao_social}
        description={[
          supplier.nome_fantasia,
          supplier.created_at ? `Cadastrado em ${formatDate(supplier.created_at)}` : null,
        ].filter(Boolean).join(' · ')}
        actions={<StatusBadge enumMap={SUPPLIER_STATUS} value={supplier.status} />}
      />

      <Card>
        <Card.Body>
          <h3 className={styles.sectionTitle}>Usuários do portal</h3>
          {users.length === 0 ? (
            <p className={styles.emptyMsg}>Nenhum usuário cadastrado.</p>
          ) : (
            <ul className={styles.contactList}>
              {users.map((user) => (
                <li key={user.id}>
                  <StatusBadge enumMap={SUPPLIER_USER_ROLE} value={user.role} />
                  <span>{user.name || user.email}</span>
                  <span className={styles.contactEmail}>{user.email}</span>
                  {!user.is_active && <StatusBadge label="Inativo" tone="neutral" />}
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
