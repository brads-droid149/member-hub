import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export interface HomeProfile {
  full_name: string | null;
  phone: string | null;
  state: string | null;
}

export interface HomeMember {
  months_active: number;
  entries: number;
  status: string;
}

export interface HomeSubscription {
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
}

// Aggregates the data the Home screen needs: the auth user, their profile,
// their members row (months_active / entries / status), and their latest
// subscription row. Exposed as a single hook so the Home page doesn't have
// to coordinate three separate loading states.
export function useHomeData() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [member, setMember] = useState<HomeMember | null>(null);
  const [subscription, setSubscription] = useState<HomeSubscription | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    // `cancelled` guards against setState calls after the component unmounts
    // (or the effect re-runs). Without it, a slow Supabase response that
    // resolves after unmount would trigger a React "set state on unmounted
    // component" warning and could overwrite fresher state on remount.
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      setProfileLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setProfileLoading(false);
        return;
      }

      const metaName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        null;
      if (!cancelled) {
        setAuthName(metaName);
        setUserId(user.id);
      }

      // Fire the three reads in parallel — they're independent (profiles,
      // members, subscriptions are separate tables keyed only by user_id)
      // so running them sequentially would just add ~2x round-trip latency
      // to first paint of the Home screen for no benefit.
      const [profileRes, memberRes, subRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, state, brevo_synced").eq("user_id", user.id).maybeSingle(),
        supabase.from("members").select("months_active, entries, status").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("subscriptions")
          .select("cancel_at_period_end, current_period_end")
          .eq("user_id", user.id)
          .eq("environment", getStripeEnvironment())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();,
      ]);

      if (cancelled) return;
      if (profileRes.data) {
        const { brevo_synced, ...rest } = profileRes.data as typeof profileRes.data & { brevo_synced?: boolean };
        setProfile(rest);

        // One-time Brevo sync: signup can't do this (no session yet when
        // email confirmation is on), so we run it on the first authenticated
        // Home load and persist the flag so it never runs again.
        if (!brevo_synced && user.email) {
          const marketingOptIn = Boolean(user.user_metadata?.marketing_opt_in);
          supabase.functions
            .invoke("brevo-sync-contact", {
              body: {
                email: user.email,
                full_name: rest.full_name ?? undefined,
                phone: rest.phone ?? undefined,
                state: rest.state ?? undefined,
                marketing_opt_in: marketingOptIn,
              },
            })
            .then(async ({ error }) => {
              if (error) {
                console.error("Brevo sync failed:", error);
                return;
              }
              await supabase
                .from("profiles")
                .update({ brevo_synced: true })
                .eq("user_id", user.id);
            })
            .catch((err) => console.error("Brevo sync failed:", err));
        }
      }
      if (memberRes.data) setMember(memberRes.data);
      if (subRes.data) setSubscription(subRes.data);
      setProfileLoading(false);

      // Realtime: when the user makes a change in the Stripe-hosted Billing
      // Portal (cancel, resume, update card), Stripe fires a webhook to
      // payments-webhook which updates the `members` and `subscriptions`
      // rows. By subscribing to postgres_changes on `members` for this user
      // we can re-fetch both rows the moment the webhook lands, so the
      // Home UI reflects the new status without requiring a page refresh.
      channel = supabase
        .channel(`home-member-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "members", filter: `user_id=eq.${user.id}` },
          async () => {
            const { data } = await supabase
              .from("members")
              .select("months_active, entries, status")
              .eq("user_id", user.id)
              .maybeSingle();
            if (data) setMember(data);
            // Also re-pull the subscription row — cancel_at_period_end /
            // current_period_end are what drive the "access until X" copy.
            const { data: s } = await supabase
              .from("subscriptions")
              .select("cancel_at_period_end, current_period_end")
              .eq("user_id", user.id)
              .eq("environment", getStripeEnvironment())
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (s) setSubscription(s);
          }
        )
        .subscribe();
    };

    load();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return {
    userId,
    authName,
    profile,
    setProfile,
    member,
    subscription,
    profileLoading,
  };
}
