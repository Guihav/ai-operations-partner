import { useEffect, useRef } from "react";

// Cloudflare Turnstile - always-pass test key by default.
// Replace VITE_TURNSTILE_SITE_KEY in .env with your real site key for production.
const TEST_SITE_KEY = "1x00000000000000000000AA";
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || TEST_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

let scriptLoading: Promise<void> | null = null;
function loadScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Turnstile"));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export function TurnstileWidget({
  onToken,
  onError,
}: {
  onToken: (token: string) => void;
  onError?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        // Clear any previously rendered widget in this container (StrictMode / remount safety)
        ref.current.innerHTML = "";
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme: "light",
          appearance: "always",
          callback: (token) => onToken(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => onError?.(),
        });
      })
      .catch(() => onError?.());
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* noop */
        }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Note: do NOT add the `cf-turnstile` class — that triggers Cloudflare's
  // implicit render and conflicts with our explicit render() call.
  return <div ref={ref} />;
}
