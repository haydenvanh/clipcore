"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal fetch-with-polling hook.
 *
 * Deliberately not SWR or React Query: this app needs "fetch JSON, optionally
 * poll, cancel on unmount" in four places, and a dependency for that is weight
 * the bundle does not need to carry.
 *
 * @param {string|null} url          null pauses fetching entirely
 * @param {{pollMs?: number, refreshKey?: unknown}} options
 *   pollMs polls while the tab is visible; refreshKey forces a refetch.
 */
export default function useSWRish(url, { pollMs = 0, refreshKey } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(url) });
  const activeRef = useRef(true);
  const [manualKey, setManualKey] = useState(0);

  useEffect(() => {
    if (!url) return undefined;

    activeRef.current = true;

    // The request lives inside the effect and every setState happens after an
    // await, so the effect body never sets state synchronously.
    const fetchOnce = async () => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (!activeRef.current) return;
        if (!res.ok) throw new Error(json.error || "Request failed");
        setState({ data: json, error: null, loading: false });
      } catch (err) {
        if (activeRef.current) {
          setState((prev) => ({ ...prev, error: err, loading: false }));
        }
      }
    };

    fetchOnce();

    let timer = null;
    if (pollMs > 0) {
      timer = setInterval(() => {
        // Polling a hidden tab burns the user's battery and our database for
        // an answer nobody is looking at.
        if (document.visibilityState === "visible") fetchOnce();
      }, pollMs);
    }

    return () => {
      activeRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [url, pollMs, refreshKey, manualKey]);

  /** Force a refetch from an event handler. */
  const reload = useCallback(() => setManualKey((n) => n + 1), []);

  return { ...state, reload };
}
