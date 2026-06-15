import { createStripeClient } from "../_shared/stripe.ts";

Deno.serve(async () => {
  try {
    const stripe = createStripeClient("sandbox");
    const monthly = await stripe.prices.list({ lookup_keys: ["membership_monthly"], expand: ["data.product"] });
    const yearly = await stripe.prices.list({ lookup_keys: ["membership_yearly"], expand: ["data.product"] });
    const summarize = (p: any) => p.data.map((x: any) => ({
      id: x.id, lookup_key: x.lookup_key, unit_amount: x.unit_amount, currency: x.currency,
      recurring: x.recurring, product: { id: x.product?.id, name: x.product?.name, tax_code: x.product?.tax_code },
    }));
    return new Response(JSON.stringify({ monthly: summarize(monthly), yearly: summarize(yearly) }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
});
