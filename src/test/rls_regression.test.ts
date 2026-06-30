/**
 * RLS regression tests.
 *
 * Asserts that an authenticated non-admin user cannot write to the
 * service-role-only tables. Guards against re-introducing the JC-02 class
 * of vulnerability where self-write policies on `public.members` (and peers)
 * allowed clients to forge their own membership / entries / status.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment. Skipped automatically
 * when the key is not present so CI without secrets still passes.
 *
 * WARNING: writes to the real backend (creates and deletes a throwaway auth
 * user plus a members row seeded by the admin client).
 */
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const runIf = url && anonKey && serviceKey ? describe : describe.skip;

runIf("RLS regression: non-admin writes are blocked", () => {
  const admin = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let user: SupabaseClient;

  const email = `rls-${crypto.randomUUID()}@example.test`;
  const password = `P${crypto.randomUUID()}!a9`;
  let userId: string;

  beforeAll(async () => {
    // Create + sign in a regular (non-admin, non-service-role) user.
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createErr) throw createErr;
    userId = created.user!.id;

    user = createClient(url!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await user.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) throw signInErr;

    // Seed a members row owned by this user (only admin/service-role can do
    // this) so the UPDATE/DELETE checks below have a concrete target.
    const { error: seedErr } = await admin.from("members").insert({
      user_id: userId,
      status: "active",
      entries: 1,
      months_active: 1,
    });
    if (seedErr) throw seedErr;
  });

  afterAll(async () => {
    if (userId) {
      await admin.from("subscriptions").delete().eq("user_id", userId);
      await admin.from("members").delete().eq("user_id", userId);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });

  // ---- members ----------------------------------------------------------

  it("blocks INSERT on members (no self-write policy)", async () => {
    const { error } = await user.from("members").insert({
      user_id: userId,
      status: "active",
      entries: 999,
      months_active: 999,
    });
    expect(error).not.toBeNull();
  });

  it("blocks UPDATE on members (cannot inflate own entries)", async () => {
    const { data, error } = await user
      .from("members")
      .update({ entries: 9999, status: "active" })
      .eq("user_id", userId)
      .select();
    // RLS either returns an error or silently affects zero rows.
    expect(error === null ? data?.length ?? 0 : 0).toBe(0);

    const { data: row } = await admin
      .from("members")
      .select("entries")
      .eq("user_id", userId)
      .single();
    expect(row?.entries).toBe(1);
  });

  it("blocks DELETE on members", async () => {
    await user.from("members").delete().eq("user_id", userId);
    const { data } = await admin
      .from("members")
      .select("user_id")
      .eq("user_id", userId);
    expect(data?.length).toBe(1);
  });

  // ---- subscriptions ----------------------------------------------------

  it("blocks INSERT on subscriptions", async () => {
    const { error } = await user.from("subscriptions").insert({
      user_id: userId,
      stripe_subscription_id: `sub_rls_${crypto.randomUUID()}`,
      stripe_customer_id: "cus_rls",
      product_id: "prod_rls",
      price_id: "price_rls",
      status: "active",
      environment: "sandbox",
    });
    expect(error).not.toBeNull();
  });

  // ---- user_roles (privilege escalation surface) ------------------------

  it("blocks INSERT on user_roles (no self-promotion to admin)", async () => {
    const { error } = await user
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    expect(error).not.toBeNull();

    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    expect(data?.length ?? 0).toBe(0);
  });

  // ---- admin-managed content tables -------------------------------------

  it.each([
    ["banners", { image_url: "x", link_url: "x", is_active: true }],
    [
      "giveaways",
      {
        name: "rls",
        image_url: "x",
        prize_value: 1,
        is_active: false,
      },
    ],
    ["partners", { name: "rls", logo_url: "x" }],
    [
      "past_winners",
      { name: "rls", prize: "rls", won_at: new Date().toISOString() },
    ],
  ] as const)("blocks INSERT on %s for non-admins", async (table, payload) => {
    const { error } = await user.from(table).insert(payload as never);
    expect(error).not.toBeNull();
  });

  // ---- internal/system tables -------------------------------------------

  it("blocks INSERT on suppressed_emails", async () => {
    const { error } = await user
      .from("suppressed_emails")
      .insert({ email: `x-${crypto.randomUUID()}@example.test`, reason: "rls" });
    expect(error).not.toBeNull();
  });

  it("blocks INSERT on stripe_webhook_events", async () => {
    const { error } = await user
      .from("stripe_webhook_events")
      .insert({ event_id: `evt_rls_${crypto.randomUUID()}` });
    expect(error).not.toBeNull();
  });

  it("blocks INSERT on email_send_log", async () => {
    const { error } = await user.from("email_send_log").insert({
      recipient: "rls@example.test",
      template: "rls",
      status: "sent",
    });
    expect(error).not.toBeNull();
  });
});
