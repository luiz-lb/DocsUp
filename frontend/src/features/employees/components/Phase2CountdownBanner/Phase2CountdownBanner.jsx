import Banner from '../../../../components/ui/Banner/index.js';
import CountdownTimer from '../../../../components/ui/CountdownTimer/index.js';
import { useCountdown } from '../../../../hooks/useCountdown.js';
import styles from './Phase2CountdownBanner.module.css';

/**
 * Faixa de prazo da Fase 2: se o tempo acabar sem envio, o fornecedor e'
 * desclassificado por documentacao e Suprimentos e' alertado a chamar o
 * 2o colocado - a mesma consequencia descrita no fluxo de SLA da cotacao.
 */
export default function Phase2CountdownBanner({ deadline }) {
  const { isExpired } = useCountdown(deadline.expiresAt);

  return (
    <Banner
      tone={isExpired ? 'danger' : 'info'}
      title={isExpired ? 'Prazo estourado' : 'Envie os colaboradores dentro do prazo'}
      description={
        isExpired
          ? 'O fornecedor sera marcado como DESCLASSIFICADO POR DOC. Suprimentos foi alertado para considerar o 2o colocado.'
          : 'Apos o prazo, o fornecedor e desclassificado por documentacao e perde pontos no score de qualificacao.'
      }
      actions={
        <div className={styles.timer}>
          <CountdownTimer deadline={deadline.expiresAt} startedAt={deadline.startedAt} expiredLabel="Expirado" />
        </div>
      }
    />
  );
}
