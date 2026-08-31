import { useEffect, useMemo, useState } from 'react';

/**
 * Contagem regressiva ate `deadline` (Date | ISO string). Usada no SLA de
 * Fase 2 (upload de colaboradores) e no prazo de resposta de cotacao.
 */
export function useCountdown(deadline) {
  const target = useMemo(() => new Date(deadline).getTime(), [deadline]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, target - now);
  const isExpired = remainingMs <= 0;

  return { remainingMs, isExpired, now, target };
}
