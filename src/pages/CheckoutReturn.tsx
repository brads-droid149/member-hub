import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Webhooks usually land within a couple of seconds; poll briefly for the
  // members row to flip to "active" before sending the user to the dashboard.
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        clearInterval(interval);
        setChecking(false);
        return;
      }
      const { data: member } = await supabase
        .from("members")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (member?.status === "active" || attempts >= 8) {
        clearInterval(interval);
        setChecking(false);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/50">
        <CardContent className="p-8 flex flex-col items-center text-center gap-6">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Welcome to Junkyard Club</h1>
            <p className="text-muted-foreground">
              {checking
                ? "Activating your membership…"
                : "Your membership is active. Enjoy your first entry into the next draw!"}
            </p>
            {sessionId && (
              <p className="text-xs text-muted-foreground/70 break-all">Ref: {sessionId}</p>
            )}
          </div>
          <Button className="w-full" onClick={() => navigate("/", { replace: true })} disabled={checking}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
