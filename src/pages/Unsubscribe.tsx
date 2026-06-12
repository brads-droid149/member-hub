import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "ready"; email: string; alreadyUsed: boolean }
  | { kind: "confirming" }
  | { kind: "done"; email: string }
  | { kind: "error"; message: string };

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const json = await res.json();
        if (!json.valid) setState({ kind: "invalid" });
        else setState({ kind: "ready", email: json.email, alreadyUsed: !!json.alreadyUsed });
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : "Failed" });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "confirming" });
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? "Failed" });
        return;
      }
      setState({ kind: "done", email: json.email });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/50">
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-2xl font-bold tracking-tight">
            Junkyard Surf <span className="text-primary">Club</span>
          </div>
          {state.kind === "loading" && <p className="text-muted-foreground">Loading…</p>}
          {state.kind === "invalid" && (
            <>
              <h1 className="text-xl font-semibold">Invalid unsubscribe link</h1>
              <p className="text-muted-foreground">This link is missing or has expired.</p>
            </>
          )}
          {state.kind === "ready" && state.alreadyUsed && (
            <>
              <h1 className="text-xl font-semibold">Already unsubscribed</h1>
              <p className="text-muted-foreground">{state.email} is already on the suppression list.</p>
            </>
          )}
          {state.kind === "ready" && !state.alreadyUsed && (
            <>
              <h1 className="text-xl font-semibold">Unsubscribe?</h1>
              <p className="text-muted-foreground">
                Stop sending marketing and billing notifications to <span className="font-medium">{state.email}</span>.
                Critical security emails (password resets) will still be delivered.
              </p>
              <Button className="w-full" onClick={confirm}>Confirm unsubscribe</Button>
            </>
          )}
          {state.kind === "confirming" && <p className="text-muted-foreground">Working…</p>}
          {state.kind === "done" && (
            <>
              <h1 className="text-xl font-semibold">You're unsubscribed</h1>
              <p className="text-muted-foreground">We've stopped sending emails to {state.email}.</p>
            </>
          )}
          {state.kind === "error" && (
            <>
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-muted-foreground">{state.message}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
