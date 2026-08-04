// TEMPORARY test harness — dunning + reactivation-on-retry verification.
// Sandbox only. Delete this function once the test is complete.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient } from "../_shared/stripe.ts";

const TEST_EMAIL = "connect+dunningtest@junkyardsurf.com.au";

function supa() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const key = req.headers.get("x-test-key");
  if (!key || key !== Deno.env.get("DUNNING_TEST_KEY")) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* empty body ok */ }

  const action = String(body.action ?? "");
  // Hard-locked to sandbox — this harness must never touch live.
  const stripe = createStripeClient("sandbox");

  try {
    switch (action) {
      case "probe": {
        const clock = await stripe.testHelpers.testClocks.create({
          frozen_time: Math.floor(Date.now() / 1000),
          name: "jysc-probe",
        });
        await stripe.testHelpers.testClocks.del(clock.id);
        return json({ ok: true, testClocksAvailable: true, probedId: clock.id });
      }

      case "setup-user": {
        const client = supa();
        const { data, error } = await client.auth.admin.createUser({
          email: TEST_EMAIL,
          password: crypto.randomUUID() + "Aa1!",
          email_confirm: true,
          user_metadata: { full_name: "Dunning Test", phone: "0400000000", state: "WA" },
        });
        if (error) return json({ ok: false, error: error.message }, 400);
        return json({ ok: true, userId: data.user?.id, email: data.user?.email });
      }

      case "setup-stripe": {
        const userId = String(body.userId);
        const clock = await stripe.testHelpers.testClocks.create({
          frozen_time: Math.floor(Date.now() / 1000),
          name: "jysc-dunning-test",
        });
        const customer = await stripe.customers.create({
          email: TEST_EMAIL,
          test_clock: clock.id,
          metadata: { userId },
        });
        const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
        await stripe.customers.update(customer.id, {
          invoice_settings: { default_payment_method: pm.id },
        });
        return json({ ok: true, clockId: clock.id, customerId: customer.id, pmId: pm.id });
      }

      case "subscribe": {
        const customerId = String(body.customerId);
        const userId = String(body.userId);
        const prices = await stripe.prices.list({ lookup_keys: ["membership_monthly"] });
        if (!prices.data.length) return json({ ok: false, error: "price not found" }, 400);
        const rates = await stripe.taxRates.list({ active: true, limit: 100 });
        const gst = rates.data.find(
          (r) => r.inclusive === true && Number(r.percentage) === 10 && r.country === "AU",
        );
        const sub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: prices.data[0].id }],
          metadata: { userId },
          ...(gst && { default_tax_rates: [gst.id] }),
        });
        return json({
          ok: true,
          subscriptionId: sub.id,
          status: sub.status,
          currentPeriodEnd: (sub.items.data[0] as unknown as { current_period_end?: number })
            .current_period_end,
        });
      }

      case "set-card": {
        const customerId = String(body.customerId);
        const subscriptionId = String(body.subscriptionId);
        const card = String(body.card); // pm_card_visa | pm_card_chargeCustomerFail
        const pm = await stripe.paymentMethods.attach(card, { customer: customerId });
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: pm.id },
        });
        await stripe.subscriptions.update(subscriptionId, { default_payment_method: pm.id });
        return json({ ok: true, pmId: pm.id, card });
      }

      case "advance": {
        const clockId = String(body.clockId);
        const to = Number(body.to);
        const clock = await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: to });
        return json({ ok: true, status: clock.status, frozenTime: clock.frozen_time });
      }

      case "clock-status": {
        const clock = await stripe.testHelpers.testClocks.retrieve(String(body.clockId));
        return json({ ok: true, status: clock.status, frozenTime: clock.frozen_time });
      }

      case "invoices": {
        const list = await stripe.invoices.list({ customer: String(body.customerId), limit: 10 });
        return json({
          ok: true,
          invoices: list.data.map((i) => ({
            id: i.id,
            status: i.status,
            billing_reason: i.billing_reason,
            amount_due: i.amount_due,
            amount_paid: i.amount_paid,
            attempt_count: i.attempt_count,
            hosted_invoice_url: i.hosted_invoice_url,
            created: i.created,
          })),
        });
      }

      case "pay-invoice": {
        const inv = await stripe.invoices.pay(String(body.invoiceId));
        return json({ ok: true, id: inv.id, status: inv.status, paid: inv.amount_paid });
      }

      case "teardown": {
        const out: Record<string, unknown> = {};
        if (body.subscriptionId) {
          try {
            await stripe.subscriptions.cancel(String(body.subscriptionId));
            out.subscription = "cancelled";
          } catch (e) { out.subscription = String(e); }
        }
        if (body.clockId) {
          try {
            await stripe.testHelpers.testClocks.del(String(body.clockId));
            out.clock = "deleted";
          } catch (e) { out.clock = String(e); }
        }
        if (body.userId) {
          const client = supa();
          await client.from("subscriptions").delete().eq("user_id", String(body.userId));
          await client.from("members").delete().eq("user_id", String(body.userId));
          await client.from("profiles").delete().eq("user_id", String(body.userId));
          const { error } = await client.auth.admin.deleteUser(String(body.userId));
          out.user = error ? String(error.message) : "deleted";
        }
        return json({ ok: true, ...out });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error("admin-dunning-test error", action, e);
    return json({ ok: false, action, error: String(e) }, 500);
  }
});
