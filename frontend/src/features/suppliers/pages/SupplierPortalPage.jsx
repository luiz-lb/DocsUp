import { useNavigate } from 'react-router-dom';
import {
  LuLogOut,
  LuFileText,
  LuExternalLink,
  LuClock,
  LuSend,
  LuTrophy,
  LuCircleAlert,
} from 'react-icons/lu';
import { Card, Button, StatusBadge, EmptyState, Banner } from '../../../components/ui/index.js';
import {
  QUOTATION_INVITE_STATUS,
  QUOTATION_STATUS,
} from '../../../constants/enums.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getMyQuotations } from '../api/suppliersApi.js';
import { useSupplierAuth } from '../../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import authStyles from '../../../styles/authCard.module.css';
import styles from './SupplierPortalPage.module.css';

/**
 * Portal do fornecedor — lista todas as cotações e convites da empresa.
 *
 * Um convite pode chegar de duas formas:
 *   - vinculado ao supplier_id, ou
 *   - apenas pelo invite_email (casado no backend com os contatos do fornecedor).
 *
 * As linhas são agrupadas por estado do processo:
 *   - Pendentes de resposta  (convite aberto, ainda sem cotação enviada)
 *   - Enviadas (em avaliação) (cotação submetida, status 1)
 *   - Resultado              (vencedora / perdedora / desclassificada)
 *   - Expiradas              (prazo encerrado sem resposta)
 */
export default function SupplierPortalPage() {
  const navigate = useNavigate();
  const { supplier, logout } = useSupplierAuth();
  const { data: quotations, isLoading, reload } = useAsyncData(getMyQuotations, []);

  const rows = quotations ?? [];

  // ── Classificação das linhas ──────────────────────────────────────────────
  const now = new Date();

  const isExpired = (r) =>
    r.q_id == null && (r.i_status === 3 || (r.round_deadline && new Date(r.round_deadline) < now));

  // Pendentes: sem cotação, convite não respondido e ainda dentro do prazo
  const pending  = rows.filter((r) => r.q_id == null && !isExpired(r));
  // Enviadas: cotação submetida aguardando decisão
  const sent     = rows.filter((r) => r.q_id != null && r.q_status === 1);
  // Resultado: cotações já decididas
  const resolved = rows.filter((r) => r.q_id != null && r.q_status >= 2);
  // Expiradas: convite venceu sem resposta
  const expired  = rows.filter((r) => isExpired(r));

  const wonCount = resolved.filter((r) => r.q_status === 2).length;

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.suppliers.login);
  };

  const openQuotationLink = (token) => navigate(ROUTES.quotations.submit(token));

  return (
    <Card tone="dark" className={cn(authStyles.card, authStyles.wide)}>
      <Card.Body>
        {/* Cabeçalho */}
        <div className={styles.header}>
          <div>
            <p className={authStyles.eyebrow}>Portal do Fornecedor</p>
            <h1 className={authStyles.title}>{supplier?.razaoSocial ?? 'Minhas cotações'}</h1>
            {supplier?.cnpj && <p className={styles.cnpj}>CNPJ: {supplier.cnpj}</p>}
          </div>
          <Button variant="ghost" className={styles.logoutBtn} icon={LuLogOut} size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>

        {isLoading ? (
          <p className={styles.loading}>Carregando cotações…</p>
        ) : (
          <>
            {/* Resumo em cards */}
            <div className={styles.statsRow}>
              <StatCard icon={LuClock}       label="Pendentes"   value={pending.length}  tone="warning" />
              <StatCard icon={LuSend}        label="Enviadas"    value={sent.length}     tone="info" />
              <StatCard icon={LuTrophy}      label="Vencedoras"  value={wonCount}        tone="success" />
              <StatCard icon={LuCircleAlert} label="Expiradas"   value={expired.length}  tone="danger" />
            </div>

            {rows.length === 0 && (
              <EmptyState
                title="Nenhuma cotação encontrada"
                description="Quando você for convidado para uma cotação, ela aparecerá aqui. Confira também o e-mail cadastrado."
              />
            )}

            {/* Aviso de vitória */}
            {wonCount > 0 && (
              <Banner
                tone="success"
                title={`Você venceu ${wonCount} cotação(ões)!`}
                description="Verifique seu e-mail para o link de envio dos documentos dos colaboradores (Fase 2)."
              />
            )}

            {/* ── Pendentes de resposta ── */}
            {pending.length > 0 && (
              <Section title="Pendentes de resposta" count={pending.length}>
                {pending.map((row) => (
                  <div key={row.i_id} className={styles.item}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{row.labor_request_title}</span>
                      <span className={styles.itemMeta}>
                        {row.labor_request_location ?? '—'} · Prazo:{' '}
                        {formatDateTime(row.round_deadline)}
                      </span>
                    </div>
                    <StatusBadge enumMap={QUOTATION_INVITE_STATUS} value={row.i_status} />
                    <Button
                      size="sm"
                      icon={LuExternalLink}
                      onClick={() => openQuotationLink(row.i_invite_token)}
                    >
                      Responder
                    </Button>
                  </div>
                ))}
              </Section>
            )}

            {/* ── Enviadas ── */}
            {sent.length > 0 && (
              <Section title="Enviadas (em avaliação)" count={sent.length}>
                {sent.map((row) => (
                  <div key={row.i_id} className={styles.item}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{row.labor_request_title}</span>
                      <span className={styles.itemMeta}>
                        Enviada em {formatDateTime(row.q_submitted_at)}
                      </span>
                    </div>
                    <span className={styles.value}>{formatCurrency(row.q_total_value)}</span>
                    <StatusBadge enumMap={QUOTATION_STATUS} value={row.q_status} />
                  </div>
                ))}
              </Section>
            )}

            {/* ── Resultado ── */}
            {resolved.length > 0 && (
              <Section title="Resultado" count={resolved.length}>
                {resolved.map((row) => (
                  <div
                    key={row.i_id}
                    className={cn(styles.item, row.q_status === 2 && styles.itemWinner)}
                  >
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{row.labor_request_title}</span>
                      <span className={styles.itemMeta}>
                        Enviada em {formatDateTime(row.q_submitted_at)}
                      </span>
                    </div>
                    <span className={styles.value}>{formatCurrency(row.q_total_value)}</span>
                    <StatusBadge enumMap={QUOTATION_STATUS} value={row.q_status} />
                  </div>
                ))}
              </Section>
            )}

            {/* ── Expiradas ── */}
            {expired.length > 0 && (
              <Section title="Expiradas" count={expired.length}>
                {expired.map((row) => (
                  <div key={row.i_id} className={cn(styles.item, styles.itemExpired)}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{row.labor_request_title}</span>
                      <span className={styles.itemMeta}>
                        Prazo encerrado em {formatDateTime(row.round_deadline)}
                      </span>
                    </div>
                    <StatusBadge enumMap={QUOTATION_INVITE_STATUS} value={3} />
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}

// ── Card de estatística ──────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className={cn(styles.stat, styles[`stat_${tone}`])}>
      <Icon className={styles.statIcon} aria-hidden="true" />
      <div className={styles.statBody}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </div>
  );
}

// ── Seção de lista ─────────────────────────────────────────────────────────
function Section({ title, count, children }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <LuFileText aria-hidden="true" />
        {title}
        <span className={styles.sectionCount}>{count}</span>
      </h3>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  );
}
