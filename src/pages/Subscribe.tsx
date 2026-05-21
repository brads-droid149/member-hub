import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckoutForm } from "@/components/StripeEmbeddedCheckout";

type State = "loading" | "needs-subscribe" | "allowed" | "no-session";

export default function Subscribe() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setState("no-session");
      setUser({ id: session.user.id, email: session.user.email ?? undefined });

      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (isAdmin) return setState("allowed");

      const { data: member } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setState(member && member.status === "active" ? "allowed" : "needs-subscribe");
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

  if (showCheckout && user) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold tracking-tight">
              Junkyard <span className="text-primary">Club</span>
            </div>
            <p className="text-muted-foreground">Complete your A$5/month membership</p>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-2 sm:p-4">
              <StripeEmbeddedCheckoutForm
                priceId="membership_monthly"
                customerEmail={user.email}
                userId={user.id}
                returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
              />
            </CardContent>
          </Card>
          <div className="text-center">
            <Button variant="ghost" onClick={() => setShowCheckout(false)}>Back</Button>
          </div>
        </div>
      </div>
    );
  }

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
              Complete your A$5/month membership to access Junkyard Club
            </p>
          </div>

          <Button className="w-full" size="lg" onClick={() => setShowCheckout(true)}>
            Join Now
          </Button>

          <Button variant="ghost" className="w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
