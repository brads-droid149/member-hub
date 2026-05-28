import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "waiting" | "active" | "timeout" | "no-session";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("waiting");

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = (next: Status) => {
      if (cancelled) return;
      setStatus(next);
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      if (channel) supabase.removeChannel(channel);
    };

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return finish("no-session");

      // Realtime: webhook flips members.status to 'active' as soon as Stripe sends the event.
      channel = supabase
        .channel(`checkout-return-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "members", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const next = (payload.new as { status?: string } | null)?.status;
            if (next === "active") finish("active");
          },
        )
        .subscribe();

      // Polling fallback for up to 30 seconds in case realtime is delayed.
      const poll = async () => {
        const { data: member } = await supabase
          .from("members")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (member?.status === "active") finish("active");
      };
      await poll();
      interval = setInterval(poll, 2000);
      timeout = setTimeout(() => finish("timeout"), 30000);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const isActive = status === "active";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/50">
        <CardContent className="p-8 flex flex-col items-center text-center gap-6">
          {isActive ? (
            <CheckCircle2 className="h-12 w-12 text-primary" />
          ) : (
            <Clock className="h-12 w-12 text-muted-foreground animate-pulse" />
          )}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {isActive ? "Welcome to Junkyard Surf Club" : "Confirming your payment…"}
            </h1>
            <p className="text-muted-foreground">
              {status === "waiting" && "We're activating your membership. This usually takes a few seconds."}
              {status === "active" && "Your membership is active. Enjoy our partner discounts and your first entry into the next draw!"}
              {status === "timeout" && "Payment received. Activation is taking longer than expected — refresh in a moment, and contact us if it doesn't appear."}
              {status === "no-session" && "Please sign in to view your membership."}
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => navigate(status === "no-session" ? "/login" : "/", { replace: true })}
            disabled={status === "waiting"}
          >
            {status === "no-session" ? "Sign in" : "Go to Dashboard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
