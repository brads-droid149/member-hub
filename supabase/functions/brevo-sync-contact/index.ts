import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

const BodySchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional(),
  state: z.string().max(10).optional(),
  marketing_opt_in: z.boolean().default(false),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not configured");

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { email, full_name, phone, state, marketing_opt_in } = parsed.data;

    // Require authenticated caller and verify the email matches the signed-in user.
    // The signup flow calls this immediately after auth.signUp succeeds, so the
    // browser already has a valid session token attached to functions.invoke().
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Email does not match authenticated user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = full_name?.split(" ")[0];
    const lastName = full_name?.split(" ").slice(1).join(" ") || undefined;

    const listIdEnv = Deno.env.get("BREVO_LIST_ID");
    const listIds = listIdEnv ? [Number(listIdEnv)] : undefined;

    const payload: Record<string, unknown> = {
      email,
      updateEnabled: true,
      attributes: {
        FIRSTNAME: firstName,
        LASTNAME: lastName,
        SMS: phone,
        STATE: state,
        MARKETING_OPT_IN: marketing_opt_in,
      },
    };
    if (marketing_opt_in && listIds) payload.listIds = listIds;

    const response = await fetch(`${GATEWAY_URL}/contacts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Brevo API error", response.status, data);
      throw new Error(`Brevo API failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, brevo: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("brevo-sync-contact error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
