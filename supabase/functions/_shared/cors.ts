// Shared CORS helper — restricts Access-Control-Allow-Origin to the
// production domain and Lovable preview domains. Use getCorsHeaders(req) in
// every browser-callable edge function.

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if (host === "members.junkyardsurf.com.au") return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".lovable.app")) return true;
    if (host.endsWith(".lovableproject.com")) return true;
    if (host.endsWith(".lovable.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
