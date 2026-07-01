import { createStripeClient } from "../_shared/stripe.ts";

Deno.serve(async () => {
  const stripe = createStripeClient("sandbox");
  // Find existing sandbox yearly price
  const existing = await stripe.prices.list({ lookup_keys: ["membership_yearly"], limit: 1 });
  if (!existing.data.length) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }
  const old = existing.data[0];
  const productId = typeof old.product === "string" ? old.product : old.product.id;

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: old.unit_amount!,
    currency: old.currency,
    recurring: old.recurring ? { interval: old.recurring.interval } : undefined,
    tax_behavior: "inclusive",
    lookup_key: "membership_yearly",
    transfer_lookup_key: true,
    nickname: old.nickname ?? undefined,
  } as any);

  // Deactivate the old one
  await stripe.prices.update(old.id, { active: false });

  return new Response(JSON.stringify({ created: { id: created.id, tax_behavior: created.tax_behavior }, deactivated: old.id }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
