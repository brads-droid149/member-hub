/**
 * Integration test for the `has_active_subscription` Postgres function.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (e.g. .env). Skipped
 * automatically when the key is not present so CI without secrets still passes.
 *
 * WARNING: this test writes to the real backend (creates and deletes a
 * throwaway auth user + subscription rows under the 'sandbox' environment).
 */
import { afterAll, describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const runIf = url && serviceKey ? describe : describe.skip;

runIf("has_active_subscription RPC", () => {
  const admin = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `test-${crypto.randomUUID()}@example.test`;
  let userId: string;
  const subIds: string[] = [];

  const seed = async (
    status: string,
    periodEnd: Date | null,
    stripeSubId: string,
  ) => {
    const { error } = await admin.from("subscriptions").insert({
      user_id: userId,
      stripe_subscription_id: stripeSubId,
      stripe_customer_id: "cus_test",
      product_id: "prod_test",
      price_id: "price_test",
      status,
      current_period_end: periodEnd?.toISOString() ?? null,
      environment: "sandbox",
    });
    if (error) throw error;
    subIds.push(stripeSubId);
  };

  const callRpc = () =>
    admin.rpc("has_active_subscription", {
      user_uuid: userId,
      check_env: "sandbox",
    });

  const cleanupSubs = async () => {
    await admin.from("subscriptions").delete().eq("user_id", userId);
    subIds.length = 0;
  };

  afterAll(async () => {
    if (userId) {
      await cleanupSubs();
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("creates the throwaway user", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    expect(error).toBeNull();
    userId = data.user!.id;
    expect(userId).toBeTruthy();
  });

  it("returns true for an active subscription", async () => {
    await cleanupSubs();
    const future = new Date(Date.now() + 7 * 86_400_000);
    await seed("active", future, `sub_active_${crypto.randomUUID()}`);
    const { data, error } = await callRpc();
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("returns true for a past_due subscription", async () => {
    await cleanupSubs();
    const future = new Date(Date.now() + 7 * 86_400_000);
    await seed("past_due", future, `sub_pd_${crypto.randomUUID()}`);
    const { data, error } = await callRpc();
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("returns false for a cancelled subscription past its period end", async () => {
    await cleanupSubs();
    const past = new Date(Date.now() - 86_400_000);
    await seed("canceled", past, `sub_cancel_${crypto.randomUUID()}`);
    const { data, error } = await callRpc();
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});
