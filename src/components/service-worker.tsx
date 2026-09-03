"use client";

import { useEffect } from "react";

/** Registers the PWA service worker so the app is installable to a home screen. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing (e.g. unsupported browser) must not break the app.
    });
  }, []);
  return null;
}
