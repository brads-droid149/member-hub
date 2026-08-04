// TEMPORARY one-off maintenance function.
//
// The app's Stripe webhook endpoint was never subscribed to invoice.* events,
// so receipts, dunning emails and past_due -> active reactivation never fired.
// This function adds the three missing events to the EXISTING endpoint(s)
// without removing anything already enabled. It never creates an endpoint.
//
// Invoke once per environment (sandbox, then live) as an admin, verify the
// before/after output, then delete this function.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const REQUIRED_EVENTS = [
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
];

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = admin();
    const { data: userResp, error: userErr } = await supabase.auth.getUser(token);
    const userId = userResp?.user?.id;
    if (userErr || !userId) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const env = body?.env;
    if (env !== "sandbox" && env !== "live") {
      return json({ error: "env must be 'sandbox' or 'live'" }, 400);
    }

    const stripe = createStripeClient(env as StripeEnv);
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

    // Only the app's own Supabase-hosted handler. The Lovable analytics
    // endpoint (api.lovable.dev/.../payments-webhook/<env>) is managed by
    // the platform and must not be touched.
    const targets = endpoints.data.filter(
      (e) => e.url.includes("payments-webhook") && e.url.includes("supabase.co"),
    );

    if (targets.length === 0) {
      return json({
        env,
        changed: false,
        error: "No matching payments-webhook endpoint found — nothing changed.",
        seen: endpoints.data.map((e) => e.url),
      }, 404);
    }

    const results = [];
    for (const ep of targets) {
      const before = [...(ep.enabled_events ?? [])];
      if (before.includes("*")) {
        results.push({ id: ep.id, url: ep.url, before, after: before, skipped: "wildcard" });
        continue;
      }
      const after = Array.from(new Set([...before, ...REQUIRED_EVENTS]));
      if (after.length === before.length) {
        results.push({ id: ep.id, url: ep.url, before, after, skipped: "already_subscribed" });
        continue;
      }
      const updated = await stripe.webhookEndpoints.update(ep.id, { enabled_events: after as any });
      results.push({ id: ep.id, url: ep.url, before, after: updated.enabled_events });
    }

    console.log("admin-fix-webhook-events", env, JSON.stringify(results));
    return json({ env, changed: true, results });
  } catch (e) {
    console.error("admin-fix-webhook-events failed", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
