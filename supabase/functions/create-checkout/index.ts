import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { getCorsHeaders, isAllowedReturnUrl } from "../_shared/cors.ts";

// Lazy supabase client — env vars may not be present at module load (e.g. tests).
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

// Test-only seam — lets unit tests inject stubbed supabase + stripe clients.
export function __setTestOverrides(opts: {
  supabase?: any;
  stripeFactory?: typeof createStripeClient;
}) {
  if (opts.supabase !== undefined) _supabase = opts.supabase;
  if (opts.stripeFactory !== undefined) _stripeFactory = opts.stripeFactory;
}

export function __resetTestOverrides() {
  _supabase = null;
  _stripeFactory = createStripeClient;
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export async function createCheckoutSession(options: {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  returnUrl: string;
  environment: StripeEnv;
}) {
  const ALLOWED_PRICE_IDS = new Set(["membership_monthly", "membership_yearly"]);
  if (!ALLOWED_PRICE_IDS.has(options.priceId)) throw new Error("Invalid priceId");
  const stripe = _stripeFactory(options.environment);

  const prices = await stripe.prices.list({ lookup_keys: [options.priceId] });
  if (!prices.data.length) throw new Error("Price not found");
  const stripePrice = prices.data[0];
  const isRecurring = stripePrice.type === "recurring";

  const customerId = (options.customerEmail || options.userId)
    ? await resolveOrCreateCustomer(stripe, {
        email: options.customerEmail,
        userId: options.userId,
      })
    : undefined;

  // Tax handling: Stripe automatically calculates GST for Australian customers.
  // The Price has `tax_behavior: inclusive`, so the A$5 shown to customers
  // already includes GST rather than adding it on top.
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: stripePrice.id, quantity: options.quantity || 1 }],
    mode: isRecurring ? "subscription" : "payment",
    ui_mode: "embedded_page",
    return_url: options.returnUrl,
    automatic_tax: { enabled: true },
    ...(customerId && { customer: customerId }),
    ...(options.userId && {
      metadata: { userId: options.userId },
      ...(isRecurring && { subscription_data: { metadata: { userId: options.userId } } }),
    }),
  } as any);

  return session.client_secret;
}

export async function handler(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    if (!isAllowedReturnUrl(body.returnUrl)) {
      return new Response(JSON.stringify({ error: "Invalid returnUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clientSecret = await createCheckoutSession({
      priceId: body.priceId,
      quantity: body.quantity,
      // Always use the authenticated user's email from the JWT — never trust
      // a client-supplied email, which could let an attacker attach their
      // checkout session to another user's Stripe customer record.
      customerEmail: user.email,
      userId: user.id,
      returnUrl: body.returnUrl,
      environment: env,
    });
    return new Response(JSON.stringify({ clientSecret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
