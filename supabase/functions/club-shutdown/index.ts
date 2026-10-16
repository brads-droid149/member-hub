// One-off club shutdown: cancels every active live subscription immediately
// (no refunds here — those run separately once funds land), marks members
// cancelled, and sends the club-closure notice. Service-role only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient } from "../_shared/stripe.ts";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token || token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripe = createStripeClient("live");

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("user_id, stripe_subscription_id")
    .eq("environment", "live")
    .in("status", ["active", "trialing", "past_due"]);
  if (error) return json({ error: "query failed" }, 500);

  const results: Record<string, unknown>[] = [];
  for (const s of subs ?? []) {
    const r: Record<string, unknown> = { user_id: s.user_id, sub: s.stripe_subscription_id };
    // Mark member cancelled FIRST so the webhook skips the generic "rejoin" email.
    await supabase.from("members").update({ status: "cancelled", entries: 0 }).eq("user_id", s.user_id);
    try {
      await stripe.subscriptions.cancel(s.stripe_subscription_id);
      r.cancelled = true;
    } catch (e) {
      r.cancelled = false;
      r.cancel_error = e instanceof Error ? e.message : String(e);
    }
    await supabase.from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", s.stripe_subscription_id);

    try {
      const { data: u } = await supabase.auth.admin.getUserById(s.user_id);
      const email = u?.user?.email;
      const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", s.user_id).maybeSingle();
      const firstName = (p?.full_name ?? "").trim().split(/\s+/)[0] || undefined;
      if (email) {
        const res = await sendTemplateEmail("club-closure", email, {
          templateData: { firstName },
          idempotencyKey: `club-closure-${s.user_id}`,
          replyTo: "support@junkyardsurf.com.au",
        });
        r.email = res.sent ? "sent" : "suppressed";
        await supabase.from("email_send_log").insert({
          template_name: "club-closure", recipient_email: email, status: res.sent ? "sent" : "suppressed",
        });
      }
    } catch (e) {
      r.email = "failed";
      r.email_error = e instanceof Error ? e.message : String(e);
    }
    results.push(r);
  }
  return json({ count: results.length, results });
});
