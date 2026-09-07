"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to the user's motion preference.
 *
 * useSyncExternalStore rather than useEffect + setState: a media query is an
 * external store, and reading it in an effect means a first paint with motion
 * on for someone who asked for it off, plus a cascading re-render.
 * The server snapshot returns true, so SSR renders the still version.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true
  );
}
