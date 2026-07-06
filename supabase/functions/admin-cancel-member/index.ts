import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Dynamic import of billing-emails (which pulls in @react-email/components) so
// unit tests can run without that npm tree resolved.
type SendBillingEmailFn = (opts: { userId: string; template: any }) => Promise<void>;
type BrevoMarkCancelledFn = (email: string) => Promise<void>;

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

let _stripeFactory: typeof createStripeClient = createStripeClient;
let _sendBillingEmailFn: SendBillingEmailFn | null = null;
let _brevoMarkCancelledFn: BrevoMarkCancelledFn | null = null;

async function getSendBillingEmail(): Promise<SendBillingEmailFn> {
  if (_sendBillingEmailFn) return _sendBillingEmailFn;
  const mod = await import("../_shared/billing-emails.ts");
  return mod.sendBillingEmail;
}
async function getBrevoMarkCancelled(): Promise<BrevoMarkCancelledFn> {
  if (_brevoMarkCancelledFn) return _brevoMarkCancelledFn;
  const mod = await import("../_shared/billing-emails.ts");
  return mod.brevoMarkCancelled;
}

export function __setTestOverrides(opts: {
  supabase?: any;
  stripeFactory?: typeof createStripeClient;
  sendBillingEmailFn?: SendBillingEmailFn;
  brevoMarkCancelledFn?: BrevoMarkCancelledFn;
}) {
  if (opts.supabase !== undefined) _supabase = opts.supabase;
  if (opts.stripeFactory !== undefined) _stripeFactory = opts.stripeFactory;
  if (opts.sendBillingEmailFn !== undefined) _sendBillingEmailFn = opts.sendBillingEmailFn;
  if (opts.brevoMarkCancelledFn !== undefined) _brevoMarkCancelledFn = opts.brevoMarkCancelledFn;
}

export function __resetTestOverrides() {
  _supabase = null;
  _stripeFactory = createStripeClient;
  _sendBillingEmailFn = null;
  _brevoMarkCancelledFn = null;
}


export async function handler(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.userId;
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const immediate: boolean = body.immediate === true;
    if (!targetUserId || !/^[a-f0-9-]{36}$/i.test(targetUserId)) {
      return new Response(JSON.stringify({ error: "Invalid userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member } = await supabase
      .from("members")
      .select("stripe_subscription_id, stripe_customer_id, status")
      .eq("user_id", targetUserId)
      .maybeSingle();

    let stripeSubId = member?.stripe_subscription_id as string | null | undefined;

    // Fallback: look up the most recent subscription row for this user/env.
    if (!stripeSubId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", targetUserId)
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      stripeSubId = sub?.stripe_subscription_id;
    }

    if (stripeSubId) {
      const stripe = _stripeFactory(environment);
      if (immediate) {
        await stripe.subscriptions.cancel(stripeSubId);
      } else {
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
      }
    }

    // Webhook will sync members.status, but also write immediately so admin UI
    // reflects the change without waiting for Stripe round-trip.
    if (immediate || !stripeSubId) {
      await supabase
        .from("members")
        .update({ status: "cancelled", entries: 0, updated_at: new Date().toISOString() })
        .eq("user_id", targetUserId);
    }

    // Notify the cancelled member + flip Brevo marketing flag. Best-effort.
    // For cancel-at-period-end (immediate=false), defer the email until
    // Stripe fires subscription.deleted at the actual end date — the
    // webhook (handleSubscriptionDeleted) sends it then so the member's
    // experience matches the email.
    if (immediate || !stripeSubId) {
      const sendBillingEmailFn = await getSendBillingEmail();
      await sendBillingEmailFn({
        userId: targetUserId,
        template: { kind: "cancelled", reason: "admin" },
      });
      const { data: userResp } = await supabase.auth.admin.getUserById(targetUserId);
      const targetEmail = userResp?.user?.email;
      if (targetEmail) {
        const brevoMarkCancelledFn = await getBrevoMarkCancelled();
        await brevoMarkCancelledFn(targetEmail);
      }
    }

    return new Response(JSON.stringify({ ok: true, immediate, hadSubscription: !!stripeSubId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-cancel-member error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
