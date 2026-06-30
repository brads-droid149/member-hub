import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __resetTestOverrides,
  __setTestOverrides,
  handler,
} from "./index.ts";

Deno.env.set("SUPABASE_URL", "http://stub");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");

const ORIGIN = "https://members.junkyardsurf.com.au";

function req(init: RequestInit & { body?: any } = {}) {
  const headers = new Headers(init.headers as any);
  if (!headers.has("origin")) headers.set("origin", ORIGIN);
  const body = init.body && typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  return new Request("http://localhost/create-portal-session", { ...init, headers, body: body as any });
}

function makeStubSupabase(opts: {
  user?: any;
  authError?: any;
  subRow?: any;
} = {}) {
  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: opts.user ?? null },
        error: opts.authError ?? (opts.user ? null : new Error("invalid")),
      }),
    },
    from(_t: string) {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: opts.subRow ?? null, error: null }),
      };
      return chain;
    },
  };
  return client;
}

Deno.test("OPTIONS returns ok", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("non-POST → 405", async () => {
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

Deno.test("invalid returnUrl → 400", async () => {
  __setTestOverrides({ supabase: makeStubSupabase({ user: { id: "u1" } }) });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { returnUrl: "http://attacker.example" },
  }));
  assertEquals(res.status, 400);
  await res.text();
  __resetTestOverrides();
});

Deno.test("no subscription → 404", async () => {
  __setTestOverrides({ supabase: makeStubSupabase({ user: { id: "u1" }, subRow: null }) });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { returnUrl: ORIGIN },
  }));
  assertEquals(res.status, 404);
  await res.text();
  __resetTestOverrides();
});

Deno.test("happy path returns portal url", async () => {
  __setTestOverrides({
    supabase: makeStubSupabase({ user: { id: "u1" }, subRow: { stripe_customer_id: "cus_x" } }),
    stripeFactory: (() => ({
      billingPortal: {
        sessions: { create: async () => ({ url: "https://billing.stripe.test/abc" }) },
      },
    })) as any,
  });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
    body: { returnUrl: ORIGIN },
  }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.url, "https://billing.stripe.test/abc");
  __resetTestOverrides();
});
