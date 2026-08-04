import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CheckEmailLocationState {
  email?: string;
}

export default function CheckEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email: stateEmail } = (location.state as CheckEmailLocationState | null) ?? {};
  // Works with or without location.state: signups pass the address through,
  // while redirects (ProtectedRoute, Subscribe) fall back to the session.
  const [email, setEmail] = useState<string | undefined>(stateEmail);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (stateEmail) return;
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? undefined);
    });
  }, [stateEmail]);

  const handleResend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't resend", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Confirmation email re-sent", description: `Check the inbox for ${email}.` });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Helmet>
        <title>Check Your Email — Junkyard Surf Club</title>
        <meta name="description" content="Please check your email to confirm your Junkyard Surf Club account." />
        <link rel="canonical" href="/check-email" />
      </Helmet>
      <h1 className="sr-only">Check your email to confirm your account</h1>
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display tracking-tight text-foreground">
            Junkyard Surf Club
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Welcome to the Club!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-foreground">
            Check your inbox to confirm your account. Once confirmed, sign in to start exploring the club.
          </p>
          {email && (
            <p className="text-center text-sm text-muted-foreground">
              email sent to {email}
            </p>
          )}
          <Button className="w-full" onClick={() => navigate("/login")}>
            Sign In
          </Button>
          {email && (
            <Button variant="outline" className="w-full" onClick={handleResend} disabled={sending}>
              {sending ? "Sending…" : "Resend confirmation email"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
