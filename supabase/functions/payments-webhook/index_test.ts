import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __resetTestOverrides,
  __setTestOverrides,
  handleWebhook,
} from "./index.ts";

type Call = { table: string; op: string; args: any };

function makeStubSupabase(opts: { existingMember?: any } = {}) {
  const calls: Call[] = [];
  const subQueryResult = { data: { user_id: "user-123" }, error: null };
  const memberQueryResult = {
    data: opts.existingMember ?? null,
    error: null,
  };

  const client: any = {
    from(table: string) {
      const chain: any = {
        _table: table,
        select() { return chain; },
        eq() { return chain; },
        upsert(args: any) {
          calls.push({ table, op: "upsert", args });
          return Promise.resolve({ error: null });
        },
        insert(args: any) {
          calls.push({ table, op: "insert", args });
          return Promise.resolve({ error: null });
        },
        update(args: any) {
          calls.push({ table, op: "update", args });
          // update().eq() chain still needs to be awaitable
          const after: any = {
            eq() { return after; },
            then(onFulfilled: any) {
              return Promise.resolve({ error: null }).then(onFulfilled);
            },
          };
          return after;
        },
        maybeSingle() {
          if (table === "members") return Promise.resolve(memberQueryResult);
          if (table === "subscriptions") return Promise.resolve(subQueryResult);
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

function makeRequest(env = "sandbox") {
  return new Request(`https://example.com/webhook?env=${env}`, {
    method: "POST",
    headers: { "stripe-signature": "bogus" },
    body: JSON.stringify({}),
  });
}

Deno.test("subscription.created creates active member with one entry", async () => {
  const { client, calls } = makeStubSupabase();
  __setTestOverrides({
    supabase: client,
    verifyWebhookFn: async () => ({
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          metadata: { userId: "user-123" },
          items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
        },
      },
    }) as any,
  });

  await handleWebhook(makeRequest(), "sandbox");

  const insert = calls.find((c) => c.table === "members" && c.op === "insert");
  assertEquals(insert?.args.status, "active");
  assertEquals(insert?.args.entries, 1);
  assertEquals(insert?.args.months_active, 1);
  __resetTestOverrides();
});

Deno.test("subscription.deleted sets member cancelled and zeros entries", async () => {
  const { client, calls } = makeStubSupabase();
  __setTestOverrides({
    supabase: client,
    verifyWebhookFn: async () => ({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "canceled",
          metadata: { userId: "user-123" },
        },
      },
    }) as any,
  });

  await handleWebhook(makeRequest(), "sandbox");

  const update = calls.find((c) => c.table === "members" && c.op === "update");
  assertEquals(update?.args.status, "cancelled");
  assertEquals(update?.args.entries, 0);
  __resetTestOverrides();
});

Deno.test("invalid signature surfaces an error from verifyWebhook", async () => {
  __resetTestOverrides(); // ensure real verifyWebhook is used
  let threw = false;
  try {
    await handleWebhook(makeRequest(), "sandbox");
  } catch (_e) {
    threw = true;
  }
  assertEquals(threw, true);
});
