import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getStripeEnvironment } from "@/lib/stripe";
import type { Tables } from "@/integrations/supabase/types";
import { useHomeData } from "@/hooks/use-home-data";
import { AppSidebar, type SectionId } from "@/components/home/AppSidebar";
import { OverviewSection } from "@/components/home/OverviewSection";
import { PartnersSection } from "@/components/home/PartnersSection";
import { WinnersSection } from "@/components/home/WinnersSection";
import { SettingsSection } from "@/components/home/SettingsSection";

type Giveaway = Tables<"giveaways">;
type Winner = Tables<"past_winners">;
type Partner = Tables<"partners">;

function MobileSidebarTrigger() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="bg-primary/10 border border-primary/20 rounded-md p-2 flex items-center justify-center"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5 text-primary" />
    </button>
  );
}

export default function Home() {
  const { toast } = useToast();
  const { userId, authName, profile, setProfile, member, subscription, profileLoading } = useHomeData();

  const [active, setActive] = useState<SectionId>("overview");

  // Per-section caches (lazy loaded on first visit)
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [giveawayLoaded, setGiveawayLoaded] = useState(false);
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [partners, setPartners] = useState<Partner[] | null>(null);

  const [openingPortal, setOpeningPortal] = useState(false);

  const toTitle = (s: string) =>
    s
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const rawName = profile?.full_name?.trim() || authName?.trim() || "";
  const firstName = rawName ? toTitle(rawName).split(" ")[0] : "Member";
  const entries = member?.entries ?? 0;
  const monthsActive = member?.months_active ?? 0;
  const monthsLabel =
    monthsActive === 0
      ? "New Member"
      : `Club Member for ${monthsActive} ${monthsActive === 1 ? "month" : "months"}`;

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
    const { data, error } = await supabase.functions.invoke("create-portal-session", {
      body: {
        environment: getStripeEnvironment(),
        returnUrl: window.location.origin + "/",
      },
    });
    setOpeningPortal(false);
    if (error || !data?.url) {
      toast({
        title: "Could not open billing portal",
        description: error?.message || "Please try again in a moment",
        variant: "destructive",
      });
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  return (
    <SidebarProvider>
      <Helmet>
        <title>Member Dashboard — Junkyard Surf Club</title>
        <meta name="description" content="Your Junkyard Surf Club member dashboard: current giveaway, entries, past winners and partner perks." />
        <link rel="canonical" href="/" />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar active={active} onSelect={setActive} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-30 h-12 flex items-center border-b border-border bg-background/80 backdrop-blur-md px-3">
            <MobileSidebarTrigger />
            <h2 className="ml-2 text-sm font-display font-bold text-foreground tracking-tight">
              Junkyard Surf Club
            </h2>
          </header>

          <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-6">
            {member?.status === "past_due" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Your last payment didn't go through. Update your payment method to keep your membership active.
                  </span>
                  <Button size="sm" variant="outline" onClick={handleManageSubscription} disabled={openingPortal}>
                    {openingPortal ? "Opening…" : "Update payment"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {subscription?.cancel_at_period_end &&
              subscription.current_period_end &&
              member?.status === "active" && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Your membership ends on{" "}
                      {new Date(subscription.current_period_end).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      . You can resume anytime before then.
                    </span>
                    <Button size="sm" variant="outline" onClick={handleManageSubscription} disabled={openingPortal}>
                      {openingPortal ? "Opening…" : "Manage membership"}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

            {active === "overview" && (
              <OverviewSection
                firstName={firstName}
                monthsLabel={monthsLabel}
                entries={entries}
                profileLoading={profileLoading}
                giveaway={giveaway}
                giveawayLoaded={giveawayLoaded}
                setGiveaway={setGiveaway}
                setGiveawayLoaded={setGiveawayLoaded}
                winners={winners}
                setWinners={setWinners}
                onSeeAllWinners={() => setActive("winners")}
              />
            )}
            {active === "partners" && (
              <PartnersSection partners={partners} setPartners={setPartners} />
            )}
            {active === "winners" && (
              <WinnersSection winners={winners} setWinners={setWinners} />
            )}
            {active === "settings" && !profileLoading && (
              <SettingsSection
                key={`${profile?.full_name ?? ""}|${profile?.phone ?? ""}|${profile?.state ?? ""}`}
                userId={userId}
                initialFullName={profile?.full_name ?? ""}
                initialPhone={profile?.phone ?? ""}
                initialState={profile?.state ?? ""}
                onProfileSaved={(fullName) =>
                  setProfile((p) => ({
                    full_name: fullName,
                    phone: p?.phone ?? null,
                    state: p?.state ?? null,
                  }))
                }
                openingPortal={openingPortal}
                onManageSubscription={handleManageSubscription}
              />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
