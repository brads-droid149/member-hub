import { createStripeClient } from "../_shared/stripe.ts";

Deno.serve(async () => {
  const results: any = {};
  for (const env of ["sandbox", "live"] as const) {
    try {
      const stripe = createStripeClient(env);
      const out: any = {};
      for (const key of ["membership_monthly", "membership_yearly"]) {
        const prices = await stripe.prices.list({ lookup_keys: [key], limit: 1 });
        out[key] = prices.data.map((p) => ({
          id: p.id,
          unit_amount: p.unit_amount,
          currency: p.currency,
          tax_behavior: p.tax_behavior,
          active: p.active,
        }));
      }
      results[env] = out;
    } catch (e) {
      results[env] = { error: (e as Error).message };
    }
  }
  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
