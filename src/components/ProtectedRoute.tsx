import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

// Three failure states the route can resolve to (besides "allowed"):
//  - no-session    -> user is signed out, redirect to /login
//  - no-membership -> signed in but no active members row, redirect to /subscribe
//  - not-admin     -> signed in member trying to hit an adminOnly route, send home
type Access = "loading" | "allowed" | "no-session" | "unverified" | "no-membership" | "not-admin";

// Wrap any route that requires authentication. Pass `adminOnly` for admin-
// only screens (e.g. /admin/*) — admins always pass the membership check
// too, so we short-circuit the members lookup for them.
export default function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const [access, setAccess] = useState<Access>("loading");
  // Tracks which user id the current `access` value was computed for, so
  // repeated SIGNED_IN / TOKEN_REFRESHED events for the same user (which
  // Supabase re-emits every time the tab regains focus) don't trigger a
  // re-evaluation — that would blank the screen and unmount the whole page.
  const evaluatedUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Prevents setAccess from firing after unmount or after a newer auth
    // event has superseded this evaluation.
    let cancelled = false;

    const evaluate = async (session: Session | null) => {
      evaluatedUserId.current = session?.user.id ?? null;
      // Membership is no longer a gate for the portal: signed-in users can
      // browse for free and only the perks (discount codes, giveaway
      // entries) are locked, enforced by RLS in the database. The only
      // gates left here are: signed out -> /login, unconfirmed email ->
      // /check-email, and admin-only routes -> admins only.
      if (!session) {
        if (!cancelled) setAccess("no-session");
        return;
      }
      if (!session.user.email_confirmed_at) {
        if (!cancelled) setAccess("unverified");
        return;
      }
      const userId = session.user.id;

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

      setAccess("allowed");

    };

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // Ignore events that can't change access. Supabase re-emits
      // TOKEN_REFRESHED / INITIAL_SESSION / SIGNED_IN whenever the tab
      // regains focus and the token is refreshed; re-running the gate there
      // would flash the spinner and remount the whole page (losing the
      // active section and all cached section data).
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "USER_UPDATED") return;
      const nextUserId = s?.user.id ?? null;
      if (event === "SIGNED_IN" && nextUserId === evaluatedUserId.current) return;
      // Only blank the screen when we don't yet have a verdict; otherwise
      // re-evaluate in the background and keep rendering what's there.
      if (evaluatedUserId.current === undefined) setAccess("loading");
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
