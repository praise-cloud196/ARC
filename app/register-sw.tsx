"use client";

import { useEffect } from "react";

/** Registers public/sw.js — see that file for why it exists and what it deliberately doesn't do. */
export function RegisterServiceWorker(): null {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have, not a data-integrity concern; nothing to recover here.
      });
    }
  }, []);
  return null;
}
