import { useEffect, useState } from 'react';

/**
 * Atrasa a propagacao de um valor (ex.: texto de busca) para evitar
 * disparar uma requisicao a cada tecla digitada.
 */
export function useDebouncedValue(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
