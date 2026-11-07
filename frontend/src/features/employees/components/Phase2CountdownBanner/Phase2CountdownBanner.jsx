import Banner from '../../../../components/ui/Banner/index.js';
import CountdownTimer from '../../../../components/ui/CountdownTimer/index.js';
import { useCountdown } from '../../../../hooks/useCountdown.js';
import styles from './Phase2CountdownBanner.module.css';

/**
 * Faixa do prazo dos documentos iniciais (definido por Compras ao indicar o fornecedor).
 * Depois dele, só dá para reenviar o que o RH reprovar ou pedir reenvio.
 */
export default function Phase2CountdownBanner({ deadline }) {
  // O backend retorna os campos em snake_case (expires_at / started_at).
  // Mantemos fallback para camelCase caso a origem dos dados mude.
  const expiresAt = deadline.expires_at ?? deadline.expiresAt;
  const startedAt = deadline.started_at ?? deadline.startedAt;

  const { isExpired } = useCountdown(expiresAt);

  return (
    <Banner
      tone={isExpired ? 'danger' : 'info'}
      title={isExpired ? 'Prazo encerrado' : 'Envie os documentos dentro do prazo'}
      description={
        isExpired
          ? 'O prazo dos documentos iniciais acabou. O setor de Compras acompanha as pendências.'
          : 'Depois do prazo, novos envios ficam bloqueados: só dá para reenviar o que o RH reprovar ou pedir reenvio.'
      }
      actions={
        <div className={styles.timer}>
          <CountdownTimer deadline={expiresAt} startedAt={startedAt} expiredLabel="Encerrado" />
        </div>
      }
    />
  );
}
