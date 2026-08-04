// Minimal GTM/dataLayer helper. The Tolt script in index.html is the only
// other third-party tag; there was no existing dataLayer wrapper, so this
// keeps pushes safe when GTM isn't present (dataLayer undefined).
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type PaywallLocation = "partner_card" | "entries_card" | "sidebar";

export function trackPaywallClick(location: PaywallLocation) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "paywall_click", location });
  } catch {
    // analytics must never break navigation
  }
}
