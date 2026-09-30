"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal fetch-with-polling hook.
 *
 * @param {string|null} url     null pauses fetching entirely
 * @param {object} options
 * @param {number}   [options.pollMs]     interval between refetches
 * @param {Function} [options.pollWhile]  (data) => boolean; polling continues
 *   only while this returns true for the latest data, so a page stops
 *   refetching the moment its job finishes rather than polling forever
 * @param {unknown}  [options.refreshKey] change to force a refetch
 */
export default function useSWRish(url, { pollMs = 0, pollWhile, refreshKey } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) });
  const [manualKey, setManualKey] = useState(0);

  // Kept in a ref so a new inline predicate each render doesn't restart the effect.
  const pollWhileRef = useRef(pollWhile);
  useEffect(() => {
    pollWhileRef.current = pollWhile;
  });

  useEffect(() => {
    if (!url) return undefined;

    let active = true;
    let timer = null;

    // Every setState happens after an await or in a timer callback, so the
    // effect body never sets state synchronously.
    const fetchOnce = async () => {
      let data = null;
      try {
        const res = await fetch(url, { cache: "no-store" });
        data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        setState({ data, error: null, loading: false });
      } catch (err) {
        if (!active) return;
        setState((prev) => ({ ...prev, error: err, loading: false }));
      }

      if (!active || pollMs <= 0) return;
      const keepGoing = pollWhileRef.current ? pollWhileRef.current(data) : true;
      if (!keepGoing) return;

      timer = setTimeout(() => {
        // A hidden tab isn't looking; check again shortly instead of fetching.
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          timer = setTimeout(fetchOnce, pollMs);
          return;
        }
        fetchOnce();
      }, pollMs);
    };

    fetchOnce();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [url, pollMs, refreshKey, manualKey]);

  const reload = useCallback(() => setManualKey((n) => n + 1), []);
  return { ...state, reload };
}
