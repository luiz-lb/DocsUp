import { useNavigate } from 'react-router-dom';
import {
  LuFileText,
  LuExternalLink,
  LuClock,
  LuSend,
  LuTrophy,
  LuCircleAlert,
  LuUpload,
} from 'react-icons/lu';
import { StatusBadge, EmptyState, Banner, Button } from '../../../components/ui/index.js';
import {
  QUOTATION_INVITE_STATUS,
  QUOTATION_STATUS,
} from '../../../constants/enums.js';
import { formatCurrency, formatDateTime } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { getMyQuotations } from '../api/suppliersApi.js';
import SupplierLayout from '../components/SupplierLayout/index.js';
import { ROUTES } from '../../../constants/routes.js';
import { cn } from '../../../utils/cn.js';
import styles from './SupplierPortalPage.module.css';

/**
 * Portal do fornecedor — lista todas as cotações e convites da empresa,
 * dentro de um shell com sidebar (espelha o painel interno da Everest).
 *
 * Ao vencer uma cotação, o fornecedor pode ir direto para a Fase 2
 * clicando no resultado — sem precisar abrir o e-mail (usamos o
 * phase2_token retornado pelo backend).
 */
export default function SupplierPortalPage() {
  const navigate = useNavigate();
  const { data: quotations, isLoading } = useAsyncData(getMyQuotations, []);

  const rows = quotations ?? [];

  // ── Classificação das linhas ──────────────────────────────────────────────
  const now = new Date();

  const isExpired = (r) =>
    r.q_id == null && (r.i_status === 3 || (r.round_deadline && new Date(r.round_deadline) < now));

  const pending  = rows.filter((r) => r.q_id == null && !isExpired(r));
  const sent     = rows.filter((r) => r.q_id != null && r.q_status === 1);
  const resolved = rows.filter((r) => r.q_id != null && r.q_status >= 2);
  const expired  = rows.filter((r) => isExpired(r));

  const wonCount = resolved.filter((r) => r.q_status === 2).length;
  // Vencedoras que ainda têm a Fase 2 em aberto (status 0 = pendente)
  const wonWithPhase2 = resolved.filter((r) => r.q_status === 2 && r.phase2_token);

  const openQuotationLink = (token) => navigate(ROUTES.quotations.submit(token));
  const openPhase2 = (token) => navigate(ROUTES.employees.phase2(token));

  return (
    <SupplierLayout>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Portal do Fornecedor</p>
          <h1 className={styles.pageTitle}>Minhas cotações</h1>
        </div>
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

          {/* Aviso de vitória com atalho para a Fase 2 */}
          {wonWithPhase2.length > 0 && (
            <Banner
              tone="success"
              title={`Você venceu ${wonWithPhase2.length} cotação(ões)!`}
              description="Clique em “Enviar documentos (Fase 2)” no resultado para enviar a documentação dos colaboradores — sem precisar abrir o e-mail."
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
              {resolved.map((row) => {
                const isWinner = row.q_status === 2;
                const canGoPhase2 = isWinner && row.phase2_token;
                return (
                  <div
                    key={row.i_id}
                    className={cn(
                      styles.item,
                      isWinner && styles.itemWinner,
                      canGoPhase2 && styles.itemClickable,
                    )}
                    role={canGoPhase2 ? 'button' : undefined}
                    tabIndex={canGoPhase2 ? 0 : undefined}
                    onClick={canGoPhase2 ? () => openPhase2(row.phase2_token) : undefined}
                    onKeyDown={
                      canGoPhase2
                        ? (e) => (e.key === 'Enter' || e.key === ' ') && openPhase2(row.phase2_token)
                        : undefined
                    }
                  >
                    <div className={styles.itemInfo}>
                      <span className={styles.itemTitle}>{row.labor_request_title}</span>
                      <span className={styles.itemMeta}>
                        Enviada em {formatDateTime(row.q_submitted_at)}
                      </span>
                    </div>
                    <span className={styles.value}>{formatCurrency(row.q_total_value)}</span>
                    <StatusBadge enumMap={QUOTATION_STATUS} value={row.q_status} />
                    {canGoPhase2 && (
                      <Button
                        size="sm"
                        icon={LuUpload}
                        onClick={(e) => {
                          e.stopPropagation();
                          openPhase2(row.phase2_token);
                        }}
                      >
                        Enviar documentos (Fase 2)
                      </Button>
                    )}
                  </div>
                );
              })}
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
    </SupplierLayout>
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
