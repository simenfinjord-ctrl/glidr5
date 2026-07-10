import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE });
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    person_profiles: "identified_only",
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Actively check for new deploys: on load, whenever the app regains
        // focus, and every 30 min. Without this a device (PWA/phone) can keep
        // running a stale cached bundle for a long time and miss new features
        // like the terms gate.
        reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
