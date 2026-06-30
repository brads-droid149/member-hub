import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  __resetTestOverrides,
  __setTestOverrides,
  handleWebhook,
} from "./index.ts";

type Call = { table: string; op: string; args: any };

function makeStubSupabase(opts: { existingMember?: any } = {}) {
  const calls: Call[] = [];
  const seenEventIds = new Set<string>();
  const subQueryResult = { data: { user_id: "user-123" }, error: null };
  const memberQueryResult = {
    data: opts.existingMember ?? null,
    error: null,
  };

  const client: any = {
    from(table: string) {
      const chain: any = {
        _table: table,
        select() {
          // Default no-op select; upsert builds its own selectable result below.
          return chain;
        },
        eq() { return chain; },
        upsert(args: any, _opts?: any) {
          calls.push({ table, op: "upsert", args });
          // Dedup table: simulate ignoreDuplicates by returning [] on repeats.
          if (table === "stripe_webhook_events") {
            const isDup = seenEventIds.has(args.event_id);
            seenEventIds.add(args.event_id);
            const data = isDup ? [] : [{ event_id: args.event_id }];
            const result: any = Promise.resolve({ data, error: null });
            result.select = () => Promise.resolve({ data, error: null });
            return result;
          }
          return Promise.resolve({ error: null });
        },
        insert(args: any) {
          calls.push({ table, op: "insert", args });
          return Promise.resolve({ error: null });
        },
        update(args: any) {
          calls.push({ table, op: "update", args });
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
      id: "evt_create_1",
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
    sendBillingEmailFn: async () => ({ enqueued: true }),
    brevoMarkCancelledFn: async () => {},
    verifyWebhookFn: async () => ({
      id: "evt_delete_1",
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

Deno.test("duplicate event.id is deduped — second delivery is a no-op", async () => {
  const { client, calls } = makeStubSupabase();
  const event = {
    id: "evt_dup_1",
    type: "customer.subscription.created",
    data: {
      object: {
        id: "sub_dup",
        customer: "cus_dup",
        status: "active",
        metadata: { userId: "user-123" },
        items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
      },
    },
  };
  __setTestOverrides({
    supabase: client,
    verifyWebhookFn: async () => event as any,
  });

  // First delivery: should process normally (subscriptions upsert + member insert).
  await handleWebhook(makeRequest(), "sandbox");
  const callsAfterFirst = calls.length;
  const writesAfterFirst = calls.filter((c) =>
    c.table !== "stripe_webhook_events" && c.op !== "select"
  ).length;
  // Sanity check the first call actually did work.
  const memberInsert = calls.find((c) => c.table === "members" && c.op === "insert");
  assertEquals(memberInsert?.args.status, "active");

  // Second delivery with the same event.id: only the dedup upsert should fire;
  // no additional writes to members/subscriptions/etc.
  await handleWebhook(makeRequest(), "sandbox");

  const dedupCalls = calls.filter((c) => c.table === "stripe_webhook_events");
  assertEquals(dedupCalls.length, 2, "dedup upsert attempted on both deliveries");

  const writesAfterSecond = calls.filter((c) =>
    c.table !== "stripe_webhook_events" && c.op !== "select"
  ).length;
  assertEquals(
    writesAfterSecond,
    writesAfterFirst,
    "second delivery must not perform any non-dedup writes",
  );
  assertEquals(
    calls.length,
    callsAfterFirst + 1,
    "second delivery only adds the dedup upsert call",
  );

  __resetTestOverrides();
});
