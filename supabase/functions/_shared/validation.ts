// Shared Zod schemas + helpers for edge function request validation.
// Replaces ad-hoc type guards across functions so every endpoint returns
// a consistent 400 shape: { error: { field: [messages] } }.
import { z } from "https://esm.sh/zod@3.23.8";

export { z };

// UUID v4-ish — matches what auth.users issues.
export const uuidSchema = z.string().regex(/^[a-f0-9-]{36}$/i, "Invalid UUID");

// Stripe environment toggle used by checkout/portal/cancel/delete flows.
export const stripeEnvSchema = z
  .enum(["live", "sandbox"])
  .default("sandbox");

// admin-update-member body
export const adminUpdateMemberSchema = z
  .object({
    userId: uuidSchema,
    monthsActive: z.number().int().min(0).max(10000).optional(),
    entries: z.number().int().min(0).max(10000).optional(),
  })
  .refine(
    (v) => v.monthsActive !== undefined || v.entries !== undefined,
    { message: "No fields to update", path: ["monthsActive"] },
  );

// delete-account body
export const deleteAccountSchema = z.object({
  environment: stripeEnvSchema,
});

// Parse a request body and on failure return a Response (or null on success
// with the parsed data). Centralises the 400 shape so callers stay terse.
export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
  corsHeaders: Record<string, string>,
): Promise<{ data: z.infer<T>; response?: undefined } | { data?: undefined; response: Response }> {
  const raw = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
  return { data: parsed.data };
}
