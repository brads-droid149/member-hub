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

export function useHomeData() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [member, setMember] = useState<HomeMember | null>(null);
  const [subscription, setSubscription] = useState<HomeSubscription | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
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

      const [profileRes, memberRes, subRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, state").eq("user_id", user.id).maybeSingle(),
        supabase.from("members").select("months_active, entries, status").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("subscriptions")
          .select("cancel_at_period_end, current_period_end")
          .eq("user_id", user.id)
          .eq("environment", getStripeEnvironment())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      if (profileRes.data) setProfile(profileRes.data);
      if (memberRes.data) setMember(memberRes.data);
      if (subRes.data) setSubscription(subRes.data);
      setProfileLoading(false);

      // Realtime: keep members data fresh after Stripe portal actions
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
