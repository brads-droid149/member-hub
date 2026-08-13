import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Lock, Ticket, Tags } from "lucide-react";

/**
 * Read-only marketing preview shown below the login form.
 * Display-only: no props, no fetches, no authenticated state.
 */
export function LoginHomePreview() {
  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-display font-bold text-foreground">What you get</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monthly giveaway entries and partner discounts for surfers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              A$5<span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Cancel anytime.</p>
          </CardContent>
        </Card>
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Yearly</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              A$55<span className="text-sm font-normal text-muted-foreground">/year</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Two months free.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Ticket className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Join the club and get an entry into the monthly giveaway.
            </p>
          </div>
          <div className="flex gap-3">
            <Gift className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Your entries stack every month you stay a member — the longer you're in, the better your odds.
            </p>
          </div>
          <div className="flex gap-3">
            <Tags className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Unlock discount codes with our partner brands, all in one place.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-6 flex flex-col items-center text-center gap-2">
          <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">This month's giveaway</p>
          <p className="text-xs text-muted-foreground">
            Sign in to see this month's giveaway and your entry count.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
