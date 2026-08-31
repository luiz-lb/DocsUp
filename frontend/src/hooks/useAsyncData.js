import { useCallback, useEffect, useState } from 'react';

/**
 * Padroniza loading/error/data para chamadas de api/*.js (hoje mocks locais,
 * amanha fetch real - o hook nao muda). `deps` re-dispara o fetcher.
 */
export function useAsyncData(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, error: null, isLoading: true });

  const reload = useCallback(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, error, isLoading: false });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => reload(), [reload]);

  return { ...state, reload };
}
