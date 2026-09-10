import { useEffect, useState } from 'react';
import { Modal, Banner } from '../../../../components/ui/index.js';
import { formatCurrency } from '../../../../utils/formatters.js';
import { compareQuotations } from '../../api/quotationsApi.js';
import styles from './QuotationCompareModal.module.css';

// Paleta fixa por índice de fornecedor (consistente entre todos os gráficos)
const SERIES_COLORS = ['#4f46e5', '#2f9e44', '#f5a524', '#e5484d', '#0ea5e9', '#a855f7'];

/**
 * Modal de comparação de cotações.
 * Busca os dados agregados no backend e renderiza gráficos leves (barras em
 * CSS/SVG — sem dependência externa) para: preço, nº de colaboradores por NR,
 * documentação declarada e total de colaboradores.
 */
export default function QuotationCompareModal({ open, onClose, roundId, quotationIds }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !roundId || !quotationIds?.length) return;
    let active = true;

    setIsLoading(true);
    setError('');
    compareQuotations(roundId, quotationIds).then((result) => {
      if (!active) return;
      if (!result) {
        setError('Não foi possível carregar a comparação.');
        setData(null);
      } else {
        setData(result);
      }
      setIsLoading(false);
    });

    return () => { active = false; };
  }, [open, roundId, quotationIds]);

  const quotations = data?.quotations ?? [];
  const nrTypes = data?.axes?.nrTypes ?? [];
  const docTypes = data?.axes?.documentTypes ?? [];

  const colorFor = (index) => SERIES_COLORS[index % SERIES_COLORS.length];

  // menor preço destacado
  const minPrice = quotations.length
    ? Math.min(...quotations.map((q) => Number(q.totalValue) || Infinity))
    : 0;

  return (
    <Modal open={open} onClose={onClose} title="Comparar cotações" maxWidth="lg">
      {isLoading ? (
        <p className={styles.loading}>Carregando comparação…</p>
      ) : error ? (
        <Banner tone="danger" description={error} />
      ) : !data ? null : (
        <div className={styles.wrapper}>
          {/* Legenda de fornecedores */}
          <div className={styles.legend}>
            {quotations.map((q, i) => (
              <span key={q.id} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: colorFor(i) }} />
                {q.supplierName ?? `Cotação #${q.id}`}
              </span>
            ))}
          </div>

          {/* ── Preço proposto ── */}
          <ChartBlock title="Preço proposto" hint="Menor preço destacado.">
            <HBarChart
              items={quotations.map((q, i) => ({
                label: q.supplierName ?? `#${q.id}`,
                value: Number(q.totalValue) || 0,
                color: colorFor(i),
                highlight: Number(q.totalValue) === minPrice,
                display: formatCurrency(q.totalValue, q.currency),
              }))}
            />
          </ChartBlock>

          {/* ── Total de colaboradores declarados ── */}
          <ChartBlock title="Colaboradores declarados (total)">
            <HBarChart
              items={quotations.map((q, i) => ({
                label: q.supplierName ?? `#${q.id}`,
                value: q.totalDeclaredEmployees ?? 0,
                color: colorFor(i),
                display: String(q.totalDeclaredEmployees ?? 0),
              }))}
            />
          </ChartBlock>

          {/* ── Documentação declarada ── */}
          <ChartBlock
            title="Documentação declarada"
            hint={`De ${docTypes.length} documento(s) considerado(s).`}
          >
            <HBarChart
              items={quotations.map((q, i) => ({
                label: q.supplierName ?? `#${q.id}`,
                value: q.declaredDocumentsCount ?? 0,
                max: docTypes.length || 1,
                color: colorFor(i),
                display: `${q.declaredDocumentsCount ?? 0}/${docTypes.length}`,
              }))}
            />
          </ChartBlock>

          {/* ── Colaboradores por NR (grouped) ── */}
          {nrTypes.length > 0 && (
            <ChartBlock title="Colaboradores por NR">
              <GroupedBarChart
                groups={nrTypes.map((nr, gi) => ({
                  label: nr.code,
                  bars: quotations.map((q, i) => ({
                    value: q.employeesByNr?.[gi] ?? 0,
                    color: colorFor(i),
                  })),
                }))}
              />
            </ChartBlock>
          )}

          {/* ── Matriz de documentos declarados ── */}
          {docTypes.length > 0 && (
            <ChartBlock title="Documentos declarados por fornecedor">
              <div className={styles.matrixWrap}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th className={styles.matrixCorner}>Documento</th>
                      {quotations.map((q, i) => (
                        <th key={q.id}>
                          <span className={styles.legendDot} style={{ background: colorFor(i) }} />
                          {q.supplierName ?? `#${q.id}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docTypes.map((dt, di) => (
                      <tr key={dt.id}>
                        <td className={styles.matrixLabel}>{dt.name}</td>
                        {quotations.map((q) => (
                          <td key={q.id} className={styles.matrixCell}>
                            {q.documentsPresence?.[di] ? (
                              <span className={styles.yes}>Sim</span>
                            ) : (
                              <span className={styles.no}>Não</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartBlock>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Blocos ──────────────────────────────────────────────────────────────────
function ChartBlock({ title, hint, children }) {
  return (
    <section className={styles.block}>
      <h4 className={styles.blockTitle}>{title}</h4>
      {hint && <p className={styles.blockHint}>{hint}</p>}
      {children}
    </section>
  );
}

// Barras horizontais (uma por fornecedor)
function HBarChart({ items }) {
  const max = Math.max(...items.map((it) => it.max ?? it.value), 1);
  return (
    <div className={styles.hbar}>
      {items.map((it, i) => (
        <div key={i} className={styles.hbarRow}>
          <span className={styles.hbarLabel} title={it.label}>{it.label}</span>
          <div className={styles.hbarTrack}>
            <div
              className={styles.hbarFill}
              style={{
                width: `${Math.max((it.value / max) * 100, 2)}%`,
                background: it.color,
                outline: it.highlight ? '2px solid #fffae4' : 'none',
              }}
            />
          </div>
          <span className={styles.hbarValue}>{it.display}</span>
        </div>
      ))}
    </div>
  );
}

// Barras agrupadas (grupos no eixo X = NRs; barras por fornecedor)
function GroupedBarChart({ groups }) {
  const max = Math.max(...groups.flatMap((g) => g.bars.map((b) => b.value)), 1);
  return (
    <div className={styles.grouped}>
      {groups.map((g, gi) => (
        <div key={gi} className={styles.group}>
          <div className={styles.groupBars}>
            {g.bars.map((b, bi) => (
              <div
                key={bi}
                className={styles.groupBar}
                style={{ height: `${Math.max((b.value / max) * 100, 3)}%`, background: b.color }}
                title={String(b.value)}
              >
                {b.value > 0 && <span className={styles.groupBarValue}>{b.value}</span>}
              </div>
            ))}
          </div>
          <span className={styles.groupLabel}>{g.label}</span>
        </div>
      ))}
    </div>
  );
}
