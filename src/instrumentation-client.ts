type SentryClient = typeof import("@sentry/nextjs");

let sentryPromise: Promise<SentryClient | null> | null = null;

function loadSentry(): Promise<SentryClient | null> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return Promise.resolve(null);
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
      });
      return Sentry;
    });
  }
  return sentryPromise;
}

function warmSentry() {
  void loadSentry();
}

function warmSentryWhenIdle() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warmSentry, { timeout: 5_000 });
  } else {
    setTimeout(warmSentry, 0);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", warmSentry, { once: true, passive: true });
  window.addEventListener("keydown", warmSentry, { once: true });
  window.addEventListener("submit", warmSentry, { once: true });
  if (document.readyState === "complete") {
    warmSentryWhenIdle();
  } else {
    window.addEventListener("load", warmSentryWhenIdle, { once: true });
  }
}

export function onRouterTransitionStart(href: string, navigationType: string) {
  void loadSentry().then((Sentry) => {
    Sentry?.captureRouterTransitionStart(href, navigationType);
  });
}
