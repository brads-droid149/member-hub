import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __resetTestOverrides,
  __setTestOverrides,
  getRetryAfterSeconds,
  handler,
  isForbidden,
  isRateLimited,
  parseJwtClaims,
} from "./index.ts";

Deno.env.set("SUPABASE_URL", "http://stub");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
Deno.env.set("LOVABLE_API_KEY", "stub");

// ---- Pure helpers ----

Deno.test("isRateLimited recognises structured 429", () => {
  assertEquals(isRateLimited({ status: 429 }), true);
  assertEquals(isRateLimited({ status: 500 }), false);
});

Deno.test("isRateLimited falls back to message", () => {
  assertEquals(isRateLimited(new Error("HTTP 429 too many")), true);
  assertEquals(isRateLimited(new Error("HTTP 500 internal")), false);
});

Deno.test("isForbidden recognises 403", () => {
  assertEquals(isForbidden({ status: 403 }), true);
  assertEquals(isForbidden(new Error("HTTP 403")), true);
  assertEquals(isForbidden(new Error("HTTP 404")), false);
});

Deno.test("getRetryAfterSeconds prefers structured field, falls back to 60", () => {
  assertEquals(getRetryAfterSeconds({ retryAfterSeconds: 42 }), 42);
  assertEquals(getRetryAfterSeconds({ retryAfterSeconds: null }), 60);
  assertEquals(getRetryAfterSeconds({}), 60);
});

Deno.test("parseJwtClaims decodes role claim", () => {
  const payload = btoa(JSON.stringify({ role: "service_role" }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const claims = parseJwtClaims(`header.${payload}.sig`);
  assertEquals(claims?.role, "service_role");
});

Deno.test("parseJwtClaims rejects malformed", () => {
  assertEquals(parseJwtClaims("not-a-jwt"), null);
  assertEquals(parseJwtClaims("a.b.c"), null); // invalid base64 body
});

// ---- Handler auth/role ----

function req(init: RequestInit = {}) {
  return new Request("http://localhost/process-email-queue", init);
}

Deno.test("missing Authorization → 401", async () => {
  __resetTestOverrides();
  const res = await handler(req({ method: "POST" }));
  assertEquals(res.status, 401);
  await res.text();
});

Deno.test("non service_role JWT → 403", async () => {
  __resetTestOverrides();
  const payload = btoa(JSON.stringify({ role: "anon" }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const token = `h.${payload}.s`;
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }));
  assertEquals(res.status, 403);
  await res.text();
});

// ---- Handler queue logic: rate-limit cooldown skips work ----

function makeStubSupabase(opts: {
  state?: any;
  batches?: Record<string, any[]>;
} = {}) {
  const calls: any[] = [];
  const inserted: any[] = [];
  const rpcCalls: any[] = [];
  const client: any = {
    from(table: string) {
      const chain: any = {
        _table: table,
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        update: (args: any) => {
          calls.push({ op: "update", table, args });
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
        insert: (row: any) => {
          inserted.push({ table, row });
          return Promise.resolve({ data: null, error: null });
        },
        single: async () => ({ data: opts.state ?? null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: undefined,
      };
      // Make `.select(...).in(...).eq(...)` resolve to {data: []} when awaited
      chain.then = (resolve: any) => resolve({ data: [], error: null });
      return chain;
    },
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      if (name === "read_email_batch") {
        return { data: opts.batches?.[args.queue_name] ?? [], error: null };
      }
      if (name === "delete_email" || name === "move_to_dlq") return { data: 1, error: null };
      return { data: null, error: null };
    },
  };
  return { client, calls, inserted, rpcCalls };
}

function svcToken() {
  const payload = btoa(JSON.stringify({ role: "service_role" }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return `h.${payload}.s`;
}

Deno.test("rate-limit cooldown skips processing", async () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const { client } = makeStubSupabase({ state: { retry_after_until: future } });
  __setTestOverrides({ createClientFn: ((..._a: any[]) => client) as any });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: `Bearer ${svcToken()}` },
  }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.skipped, true);
  assertEquals(j.reason, "rate_limited");
  __resetTestOverrides();
});

Deno.test("TTL exceeded → moved to DLQ, not sent", async () => {
  const oldQueuedAt = new Date(Date.now() - 60 * 60_000).toISOString(); // 60 min old
  const { client, rpcCalls, inserted } = makeStubSupabase({
    state: { auth_email_ttl_minutes: 15, transactional_email_ttl_minutes: 60, batch_size: 10, send_delay_ms: 0 },
    batches: {
      auth_emails: [{
        msg_id: 1,
        read_ct: 1,
        message: {
          message_id: "m1",
          to: "x@y.com",
          label: "magic_link",
          queued_at: oldQueuedAt,
        },
      }],
      transactional_emails: [],
    },
  });
  let sendCalled = false;
  __setTestOverrides({
    createClientFn: ((..._a: any[]) => client) as any,
    sendEmailFn: (async () => { sendCalled = true; }) as any,
  });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: `Bearer ${svcToken()}` },
  }));
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(sendCalled, false);
  const dlqRpc = rpcCalls.find((c) => c.name === "move_to_dlq");
  assertEquals(dlqRpc?.args?.source_queue, "auth_emails");
  const dlqLog = inserted.find((i) => i.row.status === "dlq");
  assertEquals(dlqLog?.row?.error_message?.includes("TTL exceeded"), true);
  __resetTestOverrides();
});

Deno.test("429 stops processing and sets cooldown", async () => {
  const { client, calls } = makeStubSupabase({
    state: { batch_size: 10, send_delay_ms: 0 },
    batches: {
      auth_emails: [{
        msg_id: 5,
        read_ct: 0,
        message: { message_id: "m5", to: "a@b.com", label: "magic" },
      }],
      transactional_emails: [],
    },
  });
  __setTestOverrides({
    createClientFn: ((..._a: any[]) => client) as any,
    sendEmailFn: (async () => { throw { status: 429, retryAfterSeconds: 5 }; }) as any,
  });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: `Bearer ${svcToken()}` },
  }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.stopped, "rate_limited");
  // Cooldown update happened
  const stateUpdate = calls.find((c) => c.op === "update" && c.table === "email_send_state");
  assertEquals(typeof stateUpdate?.args?.retry_after_until, "string");
  __resetTestOverrides();
});

Deno.test("403 forbidden → DLQ + stop", async () => {
  const { client, rpcCalls } = makeStubSupabase({
    state: { batch_size: 10, send_delay_ms: 0 },
    batches: {
      auth_emails: [{
        msg_id: 9,
        read_ct: 0,
        message: { message_id: "m9", to: "a@b.com", label: "magic" },
      }],
      transactional_emails: [],
    },
  });
  __setTestOverrides({
    createClientFn: ((..._a: any[]) => client) as any,
    sendEmailFn: (async () => { throw { status: 403 }; }) as any,
  });
  const res = await handler(req({
    method: "POST",
    headers: { Authorization: `Bearer ${svcToken()}` },
  }));
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.stopped, "forbidden");
  assertEquals(!!rpcCalls.find((c) => c.name === "move_to_dlq"), true);
  __resetTestOverrides();
});
