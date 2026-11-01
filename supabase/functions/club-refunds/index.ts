// One-off club shutdown refunds. Admin-only. Refunds each member's latest
// live charge by a fixed agreed amount (cents), then emails confirmation.
// POST { dryRun?: boolean }
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient } from "../_shared/stripe.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

// Agreed amounts (AUD cents) keyed by lower-cased full name. Total 27488.
const AMOUNTS: Record<string, number> = {
  "chris orman": 500, "codey wilson": 500, "joshua ryan": 500, "aidan hilton": 500,
  "rachel rumery": 500, "jake creber": 500, "brad test": 500,
  "jeandre du preez": 4490, "dylan paten": 4566, "ryan sturgess": 4611,
  "rebecca louise van der maat": 5153, "geoffrey flint": 5168,
};

Deno.serve(async (req) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const { dryRun = true } = await req.json().catch(() => ({}));
  const stripe = createStripeClient("live");

  const { data: subs, error } = await admin
    .from("subscriptions").select("user_id, stripe_customer_id, updated_at")
    .eq("environment", "live").eq("status", "canceled");
  if (error) return json({ error: "query failed" }, 500);

  const seen = new Set<string>();
  const results: Record<string, unknown>[] = [];
  for (const s of subs ?? []) {
    if (seen.has(s.user_id)) continue;
    const { data: p } = await admin.from("profiles").select("full_name").eq("user_id", s.user_id).maybeSingle();
    const name = (p?.full_name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const amount = AMOUNTS[name];
    if (!amount) continue;
    seen.add(s.user_id);
    const r: Record<string, unknown> = { name: p?.full_name, amount: amount / 100 };
    try {
      const charges = await stripe.charges.list({ customer: s.stripe_customer_id, limit: 10 });
      const charge = charges.data.find((c) => c.paid && !c.refunded && c.amount - c.amount_refunded >= amount);
      if (!charge) { r.error = "no refundable charge"; results.push(r); continue; }
      r.charge = charge.id;
      if (!dryRun) {
        const refund = await stripe.refunds.create(
          { charge: charge.id, amount, reason: "requested_by_customer" },
          { idempotencyKey: `club-refund-${s.user_id}` },
        );
        r.refund = refund.id; r.status = refund.status;
        const { data: u } = await admin.auth.admin.getUserById(s.user_id);
        const email = u?.user?.email;
        if (email) {
          const firstName = (p?.full_name ?? "").trim().split(/\s+/)[0] || undefined;
          const res = await sendTemplateEmail("club-refund", email, {
            templateData: { firstName, amount: (amount / 100).toFixed(2) },
            idempotencyKey: `club-refund-${s.user_id}`,
            replyTo: "support@junkyardsurf.com.au",
          });
          r.email = res.sent ? "sent" : "suppressed";
        }
      }
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e);
    }
    results.push(r);
  }
  const total = results.reduce((a, r) => a + (r.error ? 0 : Number(r.amount)), 0);
  return json({ dryRun, count: results.length, total: total.toFixed(2), results });
});
