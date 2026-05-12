import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const STRIPE_PAYMENT_LINK =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK ??
  "https://buy.stripe.com/3cIbJ34vv6ZN0F467z0oM00";

type State = "loading" | "needs-subscribe" | "allowed" | "no-session";

export default function Subscribe() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setState("no-session");

      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (isAdmin) return setState("allowed");

      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setState(member ? "allowed" : "needs-subscribe");
    };
    check();
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (state === "no-session") return <Navigate to="/login" replace />;
  if (state === "allowed") return <Navigate to="/" replace />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/50">
        <CardContent className="p-8 flex flex-col items-center text-center gap-6">
          <div className="text-2xl font-bold tracking-tight">
            Junkyard <span className="text-primary">Club</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold">One step to go</h1>
            <p className="text-muted-foreground">
              Complete your $5/month membership to access Junkyard Club
            </p>
          </div>

          <a href={STRIPE_PAYMENT_LINK} className="w-full" rel="noopener noreferrer">
            <Button className="w-full" size="lg">Join Now</Button>
          </a>

          <Button variant="ghost" className="w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
