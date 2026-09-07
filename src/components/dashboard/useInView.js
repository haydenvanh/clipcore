"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fire once when an element scrolls into view.
 *
 * IntersectionObserver rather than a scroll listener: a scroll handler runs on
 * every frame of every scroll on the page, and this only needs to know one
 * thing, once. `once` keeps animations from replaying every time the user
 * scrolls back past them, which reads as a glitch rather than a flourish.
 */
export default function useInView({ threshold = 0.25, once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    // No observer (old browser, jsdom) — reveal rather than leaving content
    // invisible forever. Deferred to a callback so the effect body itself never
    // sets state synchronously.
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, once]);

  return [ref, inView];
}
