import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Copy, Check, CreditCard, LogOut, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/use-admin";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;
type Winner = Tables<"past_winners">;
type Partner = Tables<"partners">;

const statusColors: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const STRIPE_PORTAL_URL = import.meta.env.VITE_STRIPE_PORTAL_URL;

export default function Home() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  

  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [member, setMember] = useState<{ status: string; months_active: number; entries: number } | null>(null);
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "cancelled">("active");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const metaName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        null;
      setAuthName(metaName);

      const [profileRes, memberRes, giveawayRes, winnersRes, partnersRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("members").select("status, months_active, entries").eq("user_id", user.id).maybeSingle(),
        supabase.from("giveaways").select("*").eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("past_winners").select("*").order("won_at", { ascending: false }).limit(5),
        supabase.from("partners").select("*").order("name"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (memberRes.data) {
        setMember(memberRes.data);
        setStatus((memberRes.data.status as "active" | "cancelled") || "active");
      }
      if (giveawayRes.data) setGiveaway(giveawayRes.data);
      if (winnersRes.data) setWinners(winnersRes.data);
      if (partnersRes.data) {
        const sorted = [...partnersRes.data].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        setPartners(sorted);
      }
    };
    load();
  }, []);

  const toTitle = (s: string) =>
    s
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const rawName = profile?.full_name?.trim() || authName?.trim() || "";
  const firstName = rawName ? toTitle(rawName).split(" ")[0] : "Member";
  // ENTRIES LIFECYCLE
  // Entries increment by 1 monthly via cron job on billing date — to be
  // implemented by backend team on Node.js migration. New members start at 1.
  // Winners reset to 0. Cancelled members reset to 0.
  // This value is read live from the members table for the signed-in user.
  const entries = member?.entries ?? 0;
  const monthsActive = Math.max(1, member?.months_active || 0);
  const monthsLabel = `${monthsActive} ${monthsActive === 1 ? "month" : "months"}`;


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    toast({ title: "Copied!", description: `${code} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCancel = () => {
    setStatus("cancelled");
    toast({ title: "Membership cancelled", description: "Your entries have been reset to zero.", variant: "destructive" });
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-foreground tracking-tight">
            Junkyard Club
          </h2>
          <nav className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => scrollTo("overview")}>Overview</Button>
            <Button variant="ghost" size="sm" onClick={() => scrollTo("partners")}>Partners</Button>
            <Button variant="ghost" size="sm" onClick={() => scrollTo("settings")}>Settings</Button>
          </nav>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                  <Shield className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline">Admin</span>
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-16">
        {/* OVERVIEW */}
        <section id="overview" className="space-y-8 scroll-mt-20">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Welcome back, {firstName}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={statusColors[status] || statusColors.active}>{status}</Badge>
              <span className="text-sm text-muted-foreground">
                Club Member for {monthsLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Current Giveaway
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {giveaway ? (
                  <>
                    {giveaway.prize_image_url ? (
                      <div className="rounded-lg overflow-hidden border border-border w-full h-[300px]">
                        <img src={giveaway.prize_image_url} alt={giveaway.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-[300px] rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden">
                        <span className="text-muted-foreground text-sm">Prize image</span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{giveaway.title}</h3>
                      {giveaway.draw_date && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Draw: {new Date(giveaway.draw_date).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active giveaway right now</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Your Entries This Draw</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-3 pb-8">
                <p className="text-7xl font-display font-bold text-primary">{entries}</p>
                <div className="text-xs text-muted-foreground max-w-xs mx-auto space-y-0.5">
                  <p>You earn +1 entry every month you stay active.</p>
                  <p>Entries reset if you cancel or win.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Past Winners</CardTitle>
              </CardHeader>
              <CardContent>
                {winners.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {winners.map((w) => (
                      <li key={w.id} className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{w.winner_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{w.prize_title}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(w.won_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No winners yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PARTNERS */}
        <section id="partners" className="space-y-6 scroll-mt-20">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Partner Discounts</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Exclusive discounts for active members. Click a code to copy.
            </p>
          </div>

          {partners.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {partners.map((partner) => (
                <Card
                  key={partner.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors group"
                  onClick={() => handleCopy(partner.discount_code, partner.id)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                    <div className="w-full aspect-[16/9] rounded-md bg-white border border-border flex items-center justify-center overflow-hidden">
                      {partner.logo_url ? (
                        <img src={partner.logo_url} alt={partner.name} className="w-full h-full object-contain p-2" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Logo</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{partner.name}</p>
                      <p className="text-xs text-muted-foreground">{partner.description || "Member discount"}</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 font-mono text-sm text-primary group-hover:bg-primary/10 transition-colors">
                      {copied === partner.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {partner.discount_code}
                    </div>
                    {partner.website_url && (
                      <a
                        href={partner.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline"
                      >
                        Visit site
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No partner discounts available yet</p>
          )}
        </section>

        {/* SETTINGS */}
        <section id="settings" className="space-y-6 scroll-mt-20 max-w-2xl">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Membership Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage your subscription</p>
          </div>

          <Button variant="outline" onClick={() => window.open(STRIPE_PORTAL_URL, "_blank")}>
            <CreditCard className="h-4 w-4 mr-2" />
            Manage Your Subscription
          </Button>
        </section>
      </main>
    </div>
  );
}
