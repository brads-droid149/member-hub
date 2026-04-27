import { supabase } from "@/integrations/supabase/client";

/**
 * MOCK phone OTP auth.
 *
 * No real SMS is sent. Universal accepted code: "000000".
 * The dedicated test number 0412345678 is documented as the QA test number.
 *
 * Under the hood we map a verified phone number to a deterministic
 * email + password so Supabase issues a real session. When you swap to
 * a real SMS provider (Twilio), replace `sendOtp` and `verifyOtp` with
 * `supabase.auth.signInWithOtp({ phone })` and
 * `supabase.auth.verifyOtp({ phone, token, type: "sms" })`.
 */

export const TEST_PHONE = "0412345678";
export const MOCK_OTP_CODE = "000000";

/** Validates an Australian mobile number (starts with 04, 10 digits). */
export function isValidAuPhone(phone: string): boolean {
  return /^04\d{8}$/.test(phone.replace(/\s+/g, ""));
}

export function normalisePhone(phone: string): string {
  return phone.replace(/\s+/g, "");
}

/** Deterministic credentials derived from the phone number (mock-only). */
function credsFor(phone: string) {
  const normalised = normalisePhone(phone);
  return {
    email: `${normalised}@phone.local`,
    password: `otp-${normalised}-mock-secret`,
  };
}

/** Mock send — always succeeds for valid AU numbers. */
export async function sendOtp(phone: string): Promise<{ error?: string }> {
  if (!isValidAuPhone(phone)) {
    return { error: "Enter a valid Australian mobile (e.g. 0412 345 678)" };
  }
  // No real SMS in mock mode.
  return {};
}

export type VerifyResult = {
  ok: boolean;
  isNewUser: boolean;
  error?: string;
};

/**
 * Verifies the code. Returns whether the user is new (no profile yet)
 * so the caller can route to the signup flow.
 */
export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  if (code !== MOCK_OTP_CODE) {
    return { ok: false, isNewUser: false, error: "Incorrect code. Try again." };
  }
  const normalised = normalisePhone(phone);
  const { email, password } = credsFor(normalised);

  // Try to sign in first.
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) {
    return { ok: true, isNewUser: false };
  }

  // Check if a profile already exists for this phone (existing user, but
  // credentials mismatch — shouldn't happen in mock flow, but guard anyway).
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("phone", normalised)
    .maybeSingle();

  if (existingProfile) {
    return {
      ok: false,
      isNewUser: false,
      error: "Account exists but couldn't sign you in. Please contact support.",
    };
  }

  return { ok: true, isNewUser: true };
}

/**
 * Completes signup for a new phone number by creating the auth user
 * with their full name. Called from the Signup screen after OTP verified.
 */
export async function completeSignup(
  phone: string,
  fullName: string,
): Promise<{ error?: string }> {
  const normalised = normalisePhone(phone);
  const { email, password } = credsFor(normalised);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: fullName, phone: normalised },
    },
  });
  if (error) return { error: error.message };

  // Sign in immediately (auto-confirm is enabled, so signUp returns a session).
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) return { error: signIn.error.message };

  // ENTRIES LIFECYCLE
  // Entries increment by 1 monthly via cron job on billing date — to be
  // implemented by backend team on Node.js migration. New members start at 1.
  // Winners reset to 0. Cancelled members reset to 0.
  const userId = signIn.data.user?.id;
  if (userId) {
    await supabase.from("members").insert({
      user_id: userId,
      status: "active",
      entries: 1,
      months_active: 1,
    });
  }

  return {};
}
