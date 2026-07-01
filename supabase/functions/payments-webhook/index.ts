import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@22.0.2";
import { type StripeEnv, verifyWebhook, createStripeClient } from "../_shared/stripe.ts";

// Dynamic import of billing-emails (which pulls in @react-email/components)
// so unit tests can run without that npm tree resolved.
type SendBillingEmailFn = (opts: { userId: string; template: any }) => Promise<unknown>;
type BrevoMarkCancelledFn = (email: string) => Promise<void>;
let _sendBillingEmailFn: SendBillingEmailFn | null = null;
let _brevoMarkCancelledFn: BrevoMarkCancelledFn | null = null;
async function sendBillingEmail(opts: { userId: string; template: any }): Promise<unknown> {
  if (_sendBillingEmailFn) return _sendBillingEmailFn(opts);
  const mod = await import("../_shared/billing-emails.ts" as string);
  return mod.sendBillingEmail(opts);
}
async function brevoMarkCancelled(email: string): Promise<void> {
  if (_brevoMarkCancelledFn) return _brevoMarkCancelledFn(email);
  const mod = await import("../_shared/billing-emails.ts" as string);
  return mod.brevoMarkCancelled(email);
}


// Stripe's typings put period fields on the subscription item starting with
// the Basil (2025-03-31) API version. The installed SDK types still expose
// them on Stripe.Subscription too, but TS doesn't know about the item-level
// fields — extend locally so we get type safety on both shapes.
type SubscriptionItemWithPeriod = Stripe.SubscriptionItem & {
  current_period_start?: number;
  current_period_end?: number;
};

// Typed as `any` because we don't generate the Database typing for edge
// functions; the untyped client returns `never` for from()/update()/etc.
let _supabase: any = null;
function getSupabase(): any {
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
  sendBillingEmailFn?: SendBillingEmailFn;
  brevoMarkCancelledFn?: BrevoMarkCancelledFn;
}) {
  if (opts.supabase !== undefined) _supabase = opts.supabase;
  if (opts.verifyWebhookFn !== undefined) _verifyWebhookFn = opts.verifyWebhookFn;
  if (opts.sendBillingEmailFn !== undefined) _sendBillingEmailFn = opts.sendBillingEmailFn;
  if (opts.brevoMarkCancelledFn !== undefined) _brevoMarkCancelledFn = opts.brevoMarkCancelledFn;
}

export function __resetTestOverrides() {
  _supabase = null;
  _verifyWebhookFn = verifyWebhook;
  _sendBillingEmailFn = null;
  _brevoMarkCancelledFn = null;
}


// Map Stripe's ~8 subscription statuses down to the THREE values the
// Junkyard app actually understands on members.status:
//   - 'active'    -> full portal access, entries accrue
//   - 'past_due'  -> still has access, UI shows a dunning banner, daily
//                    cron will auto-cancel after 7 days if not resolved
//   - 'cancelled' -> access revoked, entries reset to 0
// Anything else flows through unchanged (defensive — shouldn't happen in
// practice, but avoids silently dropping a status we haven't accounted for).
function mapMemberStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
    // 'incomplete' = first payment pending (e.g. 3DS in progress). Per
    // product decision we grant access immediately; if the payment never
    // completes Stripe will transition to incomplete_expired (mapped to
    // cancelled below) within ~23h.
    case "incomplete":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "cancelled";
    case "paused":
      // Junkyard does not offer a "paused" tier — pausing in the Stripe
      // Billing Portal means the customer stops being billed, so we treat
      // it the same as cancellation (access revoked, entries reset).
      return "cancelled";
    default:
      // Defensive: log unknown statuses and fall back to past_due so the
      // member retains access until we can investigate (rather than
      // violating the members_status_check constraint and 400-ing the
      // webhook, which Stripe would then retry forever).
      console.warn("mapMemberStatus: unknown Stripe status", stripeStatus);
      return "past_due";
  }
}

// Shared writer for the public.members row. Both the subscription event
// handlers (create/update) and reactivation paths funnel through here so
// there's exactly one place that knows the members-row contract:
//   - first-time member: seed months_active=1, entries=1, anchor the
//     monthly credit cron
//   - reactivation (cancelled -> active): reset counters back to 1
//   - past_due transitions: stamp/clear past_due_since for the auto-cancel cron
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
      existing.status === "cancelled" && memberStatus === "active";

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
// Resolve a userId from an invoice via (1) subscription metadata,
// (2) local subscriptions table, or (3) Stripe customer metadata. The
// fallback chain handles the case where invoice.paid arrives before
// customer.subscription.created (Stripe doesn't guarantee event order).
async function userIdFromInvoice(invoice: Stripe.Invoice, env: StripeEnv): Promise<string | null> {
  // Subscription id from either legacy or new invoice shape.
  const legacySub = (invoice as unknown as { subscription?: string | Stripe.Subscription | null })
    .subscription;
  const parentSub = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } };
  }).parent?.subscription_details?.subscription;
  const rawSub = legacySub ?? parentSub;
  const subscriptionId = typeof rawSub === "string" ? rawSub : rawSub?.id;

  if (subscriptionId) {
    const { data: sub } = await getSupabase()
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (sub?.user_id) return sub.user_id as string;
  }

  // Fallback: pull userId from the Stripe Customer metadata. Avoids a
  // race where invoice.paid arrives before subscription.created has
  // populated the local subscriptions table.
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;
  if (customerId) {
    try {
      const { createStripeClient } = await import("../_shared/stripe.ts");
      const stripe = createStripeClient(env);
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !("deleted" in customer && customer.deleted)) {
        const uid = (customer as Stripe.Customer).metadata?.userId;
        if (uid) return uid;
      }
    } catch (e) {
      console.error("userIdFromInvoice: customer lookup failed", e);
    }
  }
  return null;
}

// We listen to BOTH customer.subscription.* AND invoice.* events because
// they cover different lifecycle moments:
//   - subscription.created/updated -> status transitions (new sub, cancel,
//     plan change, cancel_at_period_end toggle). syncMember writes status.
//   - invoice.paid                 -> a renewal payment actually cleared.
//     This is what flips a past_due member back to active after Stripe
//     successfully retries their card. Subscription events alone don't
//     reliably fire on every successful retry, so we anchor reactivation
//     on the invoice instead.
async function handleInvoicePaid(invoice: Stripe.Invoice, env: StripeEnv) {
  const reason = invoice.billing_reason;
  // Only renewals and mid-cycle updates re-activate. The very first
  // invoice (subscription_create) is already handled by syncMember.
  if (reason !== "subscription_cycle" && reason !== "subscription_update") return;
  const userId = await userIdFromInvoice(invoice, env);
  if (!userId) return;
  await getSupabase()
    .from("members")
    .update({ status: "active", past_due_since: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  // Receipt — fire-and-forget. Sent on the initial signup invoice
  // (subscription_create) and on genuine renewals (subscription_cycle),
  // but NOT on subscription_update (proration / mid-cycle change).
  if (reason === "subscription_cycle" || reason === "subscription_create") {
    const amount = (invoice.amount_paid ?? 0) / 100;
    const currency = (invoice.currency ?? "aud").toUpperCase();
    const amountFormatted = `${currency} ${amount.toFixed(2)}`;
    const invoiceDate = new Date((invoice.created ?? Date.now() / 1000) * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const subEnd = (invoice.lines?.data?.[0]?.period?.end ?? 0) * 1000;
    const nextBillingDate = subEnd ? new Date(subEnd).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : undefined;
    await sendBillingEmail({
      userId,
      template: {
        kind: "receipt",
        amountFormatted,
        invoiceDate,
        invoiceNumber: invoice.number ?? undefined,
        invoiceUrl: invoice.hosted_invoice_url ?? undefined,
        nextBillingDate,
      },
    });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, env: StripeEnv) {
  const userId = await userIdFromInvoice(invoice, env);
  if (!userId) return;
  // Mark past_due immediately; the daily cron auto-cancels after 7 days.
  const supa = getSupabase();
  const { data: existing } = await supa
    .from("members")
    .select("status, past_due_since")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return;
  const isFirstFailure = !existing.past_due_since;
  const update: Record<string, unknown> = {
    status: "past_due",
    updated_at: new Date().toISOString(),
  };
  if (isFirstFailure) update.past_due_since = new Date().toISOString();
  await supa.from("members").update(update).eq("user_id", userId);

  // Only send a dunning email on the first payment failure in this billing
  // cycle. Subsequent retry failures still update status but stay silent.
  if (isFirstFailure) {
    // Generate a one-shot Billing Portal link so the dunning email's CTA
    // takes the member straight to "update card" without needing to log in
    // first. Falls back to dashboard URL if portal creation fails.
    let portalUrl = "https://members.junkyardsurf.com.au/";
    try {
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const stripe = createStripeClient(env);
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: "https://members.junkyardsurf.com.au/",
        });
        portalUrl = portal.url;
      }
    } catch (e) {
      console.error("dunning portal session create failed", e);
    }
    await sendBillingEmail({ userId, template: { kind: "dunning", portalUrl } });
  }
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }

  const item = subscription.items?.data?.[0] as SubscriptionItemWithPeriod | undefined;
  const price = item?.price;
  const priceId = price?.lookup_key
    || (price?.metadata as Record<string, string> | undefined)?.lovable_external_id
    || price?.id;
  const productId = typeof price?.product === "string" ? price.product : price?.product?.id;
  const subWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart = item?.current_period_start ?? subWithPeriod.current_period_start;
  const periodEnd = item?.current_period_end ?? subWithPeriod.current_period_end;

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

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, env: StripeEnv) {
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
    // Check whether the member was already cancelled — if so, skip the
    // email (admin-cancel-member / delete-account already sent one).
    const supa = getSupabase();
    const { data: prior } = await supa
      .from("members")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    // Cancellation -> revoke access and reset entries to 0 per club rules.
    await supa
      .from("members")
      .update({
        status: "cancelled",
        entries: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const wasAlreadyCancelled = (prior as { status?: string } | null)?.status === "cancelled";
    if (!wasAlreadyCancelled) {
      // 'portal' covers Billing Portal cancellations and any other
      // Stripe-driven cancel that wasn't routed through admin-cancel.
      await sendBillingEmail({ userId, template: { kind: "cancelled", reason: "portal" } });
      const { data: userResp } = await supa.auth.admin.getUserById(userId);
      const email = (userResp as { user?: { email?: string } } | null)?.user?.email;
      if (email) await brevoMarkCancelled(email);
    }
  }
}

export async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await _verifyWebhookFn(req, env);

  // Idempotency guard. Stripe retries deliveries for up to 3 days and may
  // also send overlapping events (notably invoice.paid + invoice.payment_succeeded
  // from different API versions). We dedup on event.id by recording every
  // processed event in stripe_webhook_events; the PK on event_id ensures
  // exactly-once handling. We use `ignoreDuplicates` + `.select()` so we can
  // tell whether the insert actually happened — empty data array == duplicate.
  const eventId = (event as { id?: string }).id;
  if (eventId) {
    const { data: inserted, error: dedupError } = await getSupabase()
      .from("stripe_webhook_events")
      .upsert(
        { event_id: eventId, event_type: event.type },
        { onConflict: "event_id", ignoreDuplicates: true },
      )
      .select();
    if (dedupError) {
      console.error("stripe_webhook_events insert error", dedupError);
      // Fall through and process — better to risk a dup than drop an event.
    } else if (Array.isArray(inserted) && inserted.length === 0) {
      console.log("Duplicate Stripe webhook event, skipping:", eventId, event.type);
      return;
    }
  } else {
    console.warn("Stripe webhook event missing id, cannot dedup", event.type);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, env);
      break;
    // invoice.paid and invoice.payment_succeeded both map to the same handler
    // because different Stripe API versions emit different event names for
    // the same underlying state change. The event_id dedup above prevents
    // double-processing if Stripe somehow sends both for the same invoice.
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object as Stripe.Invoice, env);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, env);
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
