import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

// Three failure states the route can resolve to (besides "allowed"):
//  - no-session    -> user is signed out, redirect to /login
//  - no-membership -> signed in but no active members row, redirect to /subscribe
//  - not-admin     -> signed in member trying to hit an adminOnly route, send home
type Access = "loading" | "allowed" | "no-session" | "no-membership" | "not-admin";

// Wrap any route that requires authentication. Pass `adminOnly` for admin-
// only screens (e.g. /admin/*) — admins always pass the membership check
// too, so we short-circuit the members lookup for them.
export default function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const [access, setAccess] = useState<Access>("loading");

  useEffect(() => {
    // Prevents setAccess from firing after unmount or after a newer auth
    // event has superseded this evaluation.
    let cancelled = false;

    const evaluate = async (session: Session | null) => {
      // Session and membership are deliberately checked as two separate
      // gates. A user can be authenticated (have a valid Supabase session)
      // but not have a paid Junkyard membership — e.g. they signed up but
      // bailed out of Stripe checkout, or their subscription was cancelled.
      // Those two cases need different redirects (login vs /subscribe), so
      // we can't collapse them into one check.
      if (!session) {
        if (!cancelled) setAccess("no-session");
        return;
      }
      const userId = session.user.id;

      // Admins bypass the membership requirement (staff accounts don't
      // need to be paying members to administer the system).
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (cancelled) return;
      if (isAdmin) {
        setAccess("allowed");
        return;
      }
      if (adminOnly) {
        setAccess("not-admin");
        return;
      }

      const { data: member } = await supabase
        .from("members")
        .select("id, status, billing_exempt")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      // billing_exempt = comped/staff member who keeps access regardless of
      // billing status (no Stripe subscription required).
      if (member?.billing_exempt) {
        setAccess("allowed");
        return;
      }
      // Allow access while payment is being retried (past_due). Home shows
      // a dunning banner; the daily cron will move them to 'cancelled'
      // after 7 days of failed retries, which then trips no-membership.
      const allowedStatuses = ["active", "past_due"];
      setAccess(member && allowedStatuses.includes(member.status) ? "allowed" : "no-membership");
    };

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setAccess("loading");
      evaluate(s);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [adminOnly]);

  if (access === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (access === "no-session") return <Navigate to="/login" replace />;
  if (access === "no-membership") return <Navigate to="/subscribe" replace />;
  if (access === "not-admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
