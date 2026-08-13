import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type GiveawayPreview = {
  title: string | null;
  prize_image_url: string | null;
  draw_date: string | null;
};


const membershipSnapshot = [
  "Member-only partner deals and discounts",
  "Exclusive gear drops and apparel access",
  "Founding rate, locked in while you're a member",
  "Access to surfboard, travel and gear giveaways",
  "Accumulating draw entries every month. Entries stack the longer you stay a member",
  "More added as the club grows",
];

export function LoginHomePreview() {
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");

  const price = plan === "monthly" ? "A$5" : "A$55";
  const cadence = plan === "monthly" ? "/ month" : "/ year";

  return (
    <section className="space-y-6">
      {/* 1. Static giveaway teaser */}
      <Card className="overflow-hidden border-border/50">
        <div className="aspect-[4/5] sm:aspect-[16/9] w-full max-h-80 overflow-hidden bg-muted">
          {isPlaceholder ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="h-10 w-10" />
              <span className="text-sm">Giveaway image placeholder</span>
            </div>
          ) : (
            <img
              src={GIVEAWAY_IMAGE_URL}
              alt={GIVEAWAY_TITLE || "This month's giveaway"}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-primary">This month's giveaway</p>
          {GIVEAWAY_TITLE && (
            <CardTitle className="text-xl font-display">{GIVEAWAY_TITLE}</CardTitle>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Members are automatically in the draw. Entries stack the longer you stay a member.
          </p>
        </CardContent>
      </Card>


      {/* 2 + 3. Membership snapshot + Pricing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-primary/90 text-primary-foreground border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display text-primary-foreground">
              Membership snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {membershipSnapshot.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-primary-foreground/90">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary-foreground" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-primary/90 text-primary-foreground border-primary flex flex-col">
          <CardContent className="p-6 flex flex-col justify-between h-full gap-8">
            <div>
              <p className="text-lg font-display font-bold text-primary-foreground">
                One Membership Tier
              </p>
              <p className="text-sm text-primary-foreground/80">Built for Surfers</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-6xl sm:text-7xl font-bold tracking-tight text-primary-foreground">
                  {price}
                  <span className="text-base sm:text-lg font-normal text-primary-foreground/70 ml-1">
                    {cadence}
                  </span>
                </p>
                {plan === "annual" && (
                  <span className="text-xs font-semibold text-primary bg-primary-foreground px-2 py-1 rounded-full">
                    1 month free
                  </span>
                )}
              </div>

              <div
                className="relative h-12 rounded-full bg-black/20 border border-white/20 p-1 cursor-pointer select-none"
                onClick={() => setPlan((p) => (p === "monthly" ? "annual" : "monthly"))}
                role="switch"
                aria-checked={plan === "annual"}
                aria-label="Toggle monthly or annual billing"
              >
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary-foreground rounded-full transition-all duration-200"
                  style={{ left: plan === "monthly" ? "4px" : "calc(50%)" }}
                />
                <div className="relative z-10 flex h-full items-center">
                  <span
                    className={`flex-1 text-center text-sm font-medium transition-colors ${
                      plan === "monthly" ? "text-primary" : "text-primary-foreground/70"
                    }`}
                  >
                    Monthly
                  </span>
                  <span
                    className={`flex-1 text-center text-sm font-medium transition-colors ${
                      plan === "annual" ? "text-primary" : "text-primary-foreground/70"
                    }`}
                  >
                    Annual
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. CTA */}
      <Button
        asChild
        size="lg"
        className="w-full rounded-full text-lg font-bold border-2 border-background hover:opacity-90 transition-opacity"
      >
        <Link to="/signup">Join the Club Here Now</Link>
      </Button>
    </section>
  );
}
