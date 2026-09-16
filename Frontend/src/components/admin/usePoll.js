/**
 * usePoll — shared admin polling hook.
 * Fetches instantly, then auto-refreshes every `intervalMs`. Keeps the last
 * good payload on transient failures and exposes a `refreshing` flag so the
 * UI can show a subtle "live" indicator instead of a full reload flash.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export default function usePoll(fetcher, deps = [], intervalMs = 30_000) {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await fetcher();
      if (alive.current) {
        setData(d);
        setLastUpdated(new Date());
      }
    } catch {
      // keep last good data on transient failures
    } finally {
      if (alive.current) setLoaded(true);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true;
    setLoaded(false);
    setData(null);
    load();
    const t = setInterval(load, intervalMs);
    return () => { alive.current = false; clearInterval(t); };
  }, [load, intervalMs]);

  // Expose a "silent" refresh for the manual refresh button.
  const silentRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => alive.current && setRefreshing(false));
  }, [load]);

  return { data, loaded, refreshing, lastUpdated, refresh: silentRefresh };
}