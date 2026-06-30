import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __resetTestOverrides,
  __setTestOverrides,
  handler,
} from "./index.ts";

Deno.env.set("SUPABASE_URL", "http://stub");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");

function makeStubSupabase(opts: {
  user?: any;
  authError?: any;
} = {}) {
  const calls: any[] = [];
  const client: any = {
    auth: {
      getUser: async (_t: string) => ({
        data: { user: opts.user ?? null },
        error: opts.authError ?? (opts.user ? null : new Error("invalid")),
      }),
    },
  };
  return { client, calls };
}

function makeStubStripe(checkoutSession: any = { client_secret: "cs_test_secret" }) {
  const calls: any[] = [];
  return {
    factory: (_env: any) => ({
      prices: {
        list: async (args: any) => {
          calls.push({ op: "prices.list", args });
          return { data: [{ id: "price_123", type: "recurring" }] };
        },
      },
      customers: {
        search: async () => ({ data: [] }),
        list: async () => ({ data: [] }),
        create: async () => ({ id: "cus_new" }),
        update: async () => ({}),
      },
      checkout: {
        sessions: {
          create: async (args: any) => {
            calls.push({ op: "checkout.create", args });
            return checkoutSession;
          },
        },
      },
    }) as any,
    calls,
  };
}

const ORIGIN = "https://members.junkyardsurf.com.au";

function req(init: any = {}, url = "http://localhost/create-checkout") {
  const headers = new Headers(init.headers as any);
  if (!headers.has("origin")) headers.set("origin", ORIGIN);
  const body = init.body && typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return new Request(url, { ...init, headers, body: body as any });
}

Deno.test("OPTIONS returns ok with CORS headers", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  await res.text();
});

Deno.test("GET returns 405", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "GET" }));
  assertEquals(res.status, 405);
  await res.text();
});

Deno.test("missing Authorization → 401", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "POST", body: {} }));
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("invalid auth token → 401", async () => {
  const { client } = makeStubSupabase({ authError: new Error("invalid") });
  __setTestOverrides({ supabase: client });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer bad", "Content-Type": "application/json" },
    body: { priceId: "membership_monthly", returnUrl: ORIGIN },
  }));
  assertEquals(res.status, 401);
  await res.text();
  __resetTestOverrides();
});

Deno.test("invalid returnUrl → 400", async () => {
  const { client } = makeStubSupabase({ user: { id: "u1", email: "a@b.c" } });
  __setTestOverrides({ supabase: client });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { priceId: "membership_monthly", returnUrl: "https://evil.example.com" },
  }));
  assertEquals(res.status, 400);
  const j = await res.json();
  assertEquals(j.error, "Invalid returnUrl");
  __resetTestOverrides();
});

Deno.test("priceId NOT in allowlist → 500 Invalid priceId", async () => {
  const { client } = makeStubSupabase({ user: { id: "u1", email: "a@b.c" } });
  const { factory } = makeStubStripe();
  __setTestOverrides({ supabase: client, stripeFactory: factory });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { priceId: "evil_price", returnUrl: ORIGIN },
  }));
  assertEquals(res.status, 500);
  const j = await res.json();
  assertEquals(j.error, "Invalid priceId");
  __resetTestOverrides();
});

Deno.test("happy path returns clientSecret", async () => {
  const { client } = makeStubSupabase({ user: { id: "u1", email: "a@b.c" } });
  const { factory, calls } = makeStubStripe();
  __setTestOverrides({ supabase: client, stripeFactory: factory });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { priceId: "membership_monthly", returnUrl: ORIGIN },
  }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.clientSecret, "cs_test_secret");
  // Verify auth email from JWT was used, not client-supplied
  const checkout = calls.find((c) => c.op === "checkout.create");
  assertExists(checkout);
  assertEquals(checkout.args.metadata?.userId, "u1");
  __resetTestOverrides();
});
