import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __resetTestOverrides,
  __setTestOverrides,
  handler,
} from "./index.ts";

Deno.env.set("SUPABASE_URL", "http://stub");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");

const ORIGIN = "https://members.junkyardsurf.com.au";
const VALID_UUID = "11111111-1111-1111-1111-111111111111";

function req(init: RequestInit & { body?: any } = {}) {
  const headers = new Headers(init.headers as any);
  if (!headers.has("origin")) headers.set("origin", ORIGIN);
  const body = init.body && typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return new Request("http://localhost/admin-cancel-member", { ...init, headers, body: body as any });
}

function makeStubSupabase(opts: {
  user?: any;
  isAdmin?: boolean;
  member?: any;
  sub?: any;
  targetEmail?: string;
} = {}) {
  const calls: any[] = [];
  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ?? null },
        error: opts.user ? null : new Error("invalid"),
      }),
      admin: {
        getUserById: async () => ({
          data: { user: opts.targetEmail ? { email: opts.targetEmail } : null },
          error: null,
        }),
      },
    },
    rpc: async (name: string) => {
      calls.push({ op: "rpc", name });
      if (name === "has_role") return { data: !!opts.isAdmin, error: null };
      return { data: null, error: null };
    },
    from(table: string) {
      const chain: any = {
        _table: table,
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        update: (args: any) => {
          calls.push({ op: "update", table, args });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        maybeSingle: async () => {
          if (table === "members") return { data: opts.member ?? null, error: null };
          if (table === "subscriptions") return { data: opts.sub ?? null, error: null };
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

Deno.test("OPTIONS ok", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("non-POST 405", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "GET" }));
  assertEquals(res.status, 405);
  await res.text();
});

Deno.test("missing token → 401", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "POST", body: {} }));
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("non-admin user → 403", async () => {
  const { client } = makeStubSupabase({ user: { id: "u1" }, isAdmin: false });
  __setTestOverrides({ supabase: client });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { userId: VALID_UUID },
  }));
  assertEquals(res.status, 403);
  await res.text();
  __resetTestOverrides();
});

Deno.test("invalid userId format → 400", async () => {
  const { client } = makeStubSupabase({ user: { id: "u1" }, isAdmin: true });
  __setTestOverrides({ supabase: client });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { userId: "not-a-uuid'; DROP TABLE members; --" },
  }));
  assertEquals(res.status, 400);
  await res.text();
  __resetTestOverrides();
});

Deno.test("immediate cancel: calls stripe.cancel, updates member, sends email", async () => {
  const { client, calls } = makeStubSupabase({
    user: { id: "admin" },
    isAdmin: true,
    member: { stripe_subscription_id: "sub_x", status: "active" },
    targetEmail: "t@x.com",
  });
  let stripeCancelCalled = false;
  let emailSent: any = null;
  let brevoCalled: string | null = null;
  __setTestOverrides({
    supabase: client,
    stripeFactory: (() => ({
      subscriptions: {
        cancel: async (id: string) => { stripeCancelCalled = true; return { id }; },
        update: async () => ({}),
      },
    })) as any,
    sendBillingEmailFn: (async (opts: any) => { emailSent = opts; }) as any,
    brevoMarkCancelledFn: (async (email: string) => { brevoCalled = email; }) as any,
  });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { userId: VALID_UUID, immediate: true },
  }));
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(stripeCancelCalled, true);
  assertEquals(emailSent?.template?.kind, "cancelled");
  assertEquals(brevoCalled, "t@x.com");
  const update = calls.find((c) => c.op === "update" && c.table === "members");
  assertEquals(update?.args?.status, "cancelled");
  assertEquals(update?.args?.entries, 0);
  __resetTestOverrides();
});

Deno.test("cancel-at-period-end: no immediate email, no immediate members update", async () => {
  const { client, calls } = makeStubSupabase({
    user: { id: "admin" },
    isAdmin: true,
    member: { stripe_subscription_id: "sub_x", status: "active" },
  });
  let updateCalled = false;
  let emailSent = false;
  __setTestOverrides({
    supabase: client,
    stripeFactory: (() => ({
      subscriptions: {
        cancel: async () => ({}),
        update: async () => { updateCalled = true; return {}; },
      },
    })) as any,
    sendBillingEmailFn: (async () => { emailSent = true; }) as any,
    brevoMarkCancelledFn: (async () => {}) as any,
  });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { userId: VALID_UUID, immediate: false },
  }));
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(updateCalled, true);
  assertEquals(emailSent, false);
  assertEquals(calls.find((c) => c.op === "update" && c.table === "members"), undefined);
  __resetTestOverrides();
});
