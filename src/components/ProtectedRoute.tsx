import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

type Access = "loading" | "allowed" | "no-session" | "no-membership";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<Access>("loading");

  useEffect(() => {
    let cancelled = false;

    const evaluate = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setAccess("no-session");
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

      const { data: member } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", userId)
        .in("status", ["active", "paused"])
        .maybeSingle();
      if (cancelled) return;
      setAccess(member ? "allowed" : "no-membership");
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
  }, []);

  if (access === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (access === "no-session") return <Navigate to="/login" replace />;
  if (access === "no-membership") return <Navigate to="/subscribe" replace />;
  return <>{children}</>;
}
