import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@22.0.2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

// Stripe's typings put period fields on the subscription item starting with
// the Basil (2025-03-31) API version. The installed SDK types still expose
// them on Stripe.Subscription too, but TS doesn't know about the item-level
// fields — extend locally so we get type safety on both shapes.
type SubscriptionItemWithPeriod = Stripe.SubscriptionItem & {
  current_period_start?: number;
  current_period_end?: number;
};

let _supabase: any = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

let _verifyWebhookFn: typeof verifyWebhook = verifyWebhook;

// Test-only seam — allows unit tests to inject stubs without spinning up
// real Supabase/Stripe clients. Not used in production.
export function __setTestOverrides(opts: {
  supabase?: any;
  verifyWebhookFn?: typeof verifyWebhook;
}) {
  if (opts.supabase !== undefined) _supabase = opts.supabase;
  if (opts.verifyWebhookFn !== undefined) _verifyWebhookFn = opts.verifyWebhookFn;
}

export function __resetTestOverrides() {
  _supabase = null;
  _verifyWebhookFn = verifyWebhook;
}

// Map Stripe subscription status -> Junkyard members.status.
// 'active' / 'trialing' / 'past_due' all grant portal access (past_due shows
// a dunning banner). 'canceled' or 'unpaid' revoke access.
function mapMemberStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "cancelled";
    case "paused":
      return "paused";
    default:
      return stripeStatus;
  }
}

async function syncMember(opts: {
  userId: string;
  subscription: Stripe.Subscription;
}) {
  const supa = getSupabase();
  const { userId, subscription } = opts;
  const memberStatus = mapMemberStatus(subscription.status);

  const { data: existing } = await supa
    .from("members")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    // New member — first month active, first entry. Anchor the monthly
    // credit cron to now so the next +1 happens ~1 month from today.
    await supa.from("members").insert({
      user_id: userId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      status: memberStatus,
      months_active: 1,
      entries: 1,
      last_entry_credited_at: new Date().toISOString(),
    });
  } else {
    const isReactivation =
      ["cancelled", "paused"].includes(existing.status) && memberStatus === "active";

    const update: Record<string, unknown> = {
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      status: memberStatus,
      updated_at: new Date().toISOString(),
    };
    // Track when past_due began so the daily job can auto-cancel after 7 days.
    if (memberStatus === "past_due" && existing.status !== "past_due") {
      update.past_due_since = new Date().toISOString();
    } else if (memberStatus !== "past_due" && existing.status === "past_due") {
      update.past_due_since = null;
    }
    if (isReactivation) {
      update.months_active = 1;
      update.entries = 1;
      update.last_entry_credited_at = new Date().toISOString();
    }
    await supa.from("members").update(update).eq("user_id", userId);
  }
}

// NOTE: Monthly entry crediting is handled by the `credit_monthly_entries`
// pg_cron job (runs daily). It applies uniformly to monthly AND annual
// subscribers — +1 entry per calendar month active, regardless of billing
// frequency. We intentionally do NOT increment entries on invoice.paid.

// Monthly renewal: invoice.paid (billing_reason=subscription_cycle) increments
// entries and months_active by 1. We skip the first invoice (billing_reason=
// subscription_create) because syncMember already initializes those to 1.
// Renewals no longer mutate entries — the daily pg_cron handles monthly
// credits uniformly for monthly and annual plans. We still ensure status
// flips back to 'active' on a successful renewal payment.
async function handleInvoicePaid(invoice: any) {
  const reason = invoice.billing_reason;
  if (reason !== "subscription_cycle" && reason !== "subscription_update") return;

  const subscriptionId = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  const supa = getSupabase();
  const { data: sub } = await supa
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!sub?.user_id) return;

  await supa
    .from("members")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("user_id", sub.user_id);
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  await syncMember({ userId, subscription });
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  const userId = subscription.metadata?.userId;
  if (userId) {
    // Cancellation -> revoke access and reset entries to 0 per club rules.
    await getSupabase()
      .from("members")
      .update({
        status: "cancelled",
        entries: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }
}

export async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await _verifyWebhookFn(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook received with invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
