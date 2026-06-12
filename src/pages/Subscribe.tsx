import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckoutForm } from "@/components/StripeEmbeddedCheckout";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "loading" | "needs-verify" | "needs-subscribe" | "allowed" | "no-session";
type Plan = "monthly" | "yearly";

const PLANS: Record<Plan, { priceId: string; price: string; cadence: string; sub: string; badge?: string }> = {
  monthly: {
    priceId: "membership_monthly",
    price: "A$5",
    cadence: "/month",
    sub: "Billed monthly. Cancel anytime.",
  },
  yearly: {
    priceId: "membership_yearly",
    price: "A$50",
    cadence: "/year",
    sub: "Billed yearly. Save 17% vs monthly.",
    badge: "Best value",
  },
};

export default function Subscribe() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setState("no-session");
      setUser({ id: session.user.id, email: session.user.email ?? undefined });

      // Block paid checkout until the email is verified — prevents
      // members paying with a typo'd address they can't receive on.
      const isVerified = !!session.user.email_confirmed_at;

      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (isAdmin) return setState("allowed");
      if (!isVerified) return setState("needs-verify");

      const { data: member } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setState(member && ["active", "past_due"].includes(member.status) ? "allowed" : "needs-subscribe");

      // Listen for webhook-driven membership activation while user waits on this page.
      channel = supabase
        .channel(`members-self-${session.user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "members", filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            const next = (payload.new as { status?: string } | null)?.status;
            if (next && ["active", "past_due"].includes(next)) setState("allowed");
          },
        )
        .subscribe();
    };
    check();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
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

  if (state === "needs-verify") {
    const handleResend = async () => {
      if (!user?.email) return;
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) alert(error.message);
      else alert("Verification email re-sent. Check your inbox.");
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md border-border/50">
          <CardContent className="p-8 flex flex-col items-center text-center gap-4">
            <div className="text-2xl font-bold tracking-tight">
              Junkyard Surf <span className="text-primary">Club</span>
            </div>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="text-muted-foreground">
              We sent a confirmation link to <span className="font-medium">{user?.email}</span>.
              Click it to activate your account before subscribing.
            </p>
            <Button className="w-full" onClick={handleResend}>Resend verification email</Button>
            <Button variant="ghost" className="w-full" onClick={handleSignOut}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCheckout && user) {
    const selected = PLANS[plan];
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold tracking-tight">
              Junkyard Surf <span className="text-primary">Club</span>
            </div>
            <p className="text-muted-foreground">
              Complete your {selected.price}{selected.cadence} membership
            </p>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-2 sm:p-4">
              <StripeEmbeddedCheckoutForm
                priceId={selected.priceId}
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

  const perks = [
    "Exclusive partner discounts",
    "Surf gear giveaways",
    "+1 giveaway entry every month you're active",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl border-border/50">
        <CardContent className="p-8 flex flex-col items-center text-center gap-6">
          <div className="text-2xl font-bold tracking-tight">
            Junkyard Surf <span className="text-primary">Club</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Choose your membership</h1>
            <p className="text-muted-foreground">
              Same perks. Pick the billing that suits you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {(Object.keys(PLANS) as Plan[]).map((key) => {
              const p = PLANS[key];
              const active = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlan(key)}
                  className={cn(
                    "relative rounded-lg border-2 p-5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {p.badge && (
                    <span className="absolute -top-2 right-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded">
                      {p.badge}
                    </span>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{p.price}</span>
                    <span className="text-muted-foreground">{p.cadence}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{p.sub}</p>
                </button>
              );
            })}
          </div>

          <ul className="w-full space-y-2 text-left">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          <Button className="w-full" size="lg" onClick={() => setShowCheckout(true)}>
            Continue with {PLANS[plan].price}{PLANS[plan].cadence}
          </Button>

          <Button variant="ghost" className="w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
