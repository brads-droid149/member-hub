import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trophy,
  Calendar,
  TrendingUp,
  Copy,
  Check,
  Pause,
  XCircle,
  CreditCard,
  LogOut,
  Shield,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;
type Winner = Tables<"past_winners">;
type Partner = Tables<"partners">;

const statusColors: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  paused: "bg-warning/20 text-warning border-warning/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const mockMember = { pauseMonthsUsed: 0, maxPauseMonths: 3 };

export default function Home() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [member, setMember] = useState<{ status: string; months_active: number; entries: number } | null>(null);
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "paused" | "cancelled">("active");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, memberRes, giveawayRes, winnersRes, partnersRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
        supabase.from("members").select("status, months_active, entries").eq("user_id", user.id).single(),
        supabase.from("giveaways").select("*").eq("is_active", true).limit(1).single(),
        supabase.from("past_winners").select("*").order("won_at", { ascending: false }).limit(5),
        supabase.from("partners").select("*").order("name"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (memberRes.data) {
        setMember(memberRes.data);
        setStatus((memberRes.data.status as "active" | "paused" | "cancelled") || "active");
      }
      if (giveawayRes.data) setGiveaway(giveawayRes.data);
      if (winnersRes.data) setWinners(winnersRes.data);
      if (partnersRes.data) setPartners(partnersRes.data);
    };
    load();
  }, []);

  const displayName = profile?.full_name || "Member";
  const entries = member?.entries || 0;
  const monthsActive = member?.months_active || 0;

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

  const handlePause = () => {
    setStatus("paused");
    toast({ title: "Membership paused", description: "You can resume anytime from this page." });
  };
  const handleCancel = () => {
    setStatus("cancelled");
    toast({ title: "Membership cancelled", description: "Your entries have been reset to zero.", variant: "destructive" });
  };
  const handleResume = () => {
    setStatus("active");
    toast({ title: "Welcome back!", description: "Your membership is active again." });
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
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">
                  <Shield className="h-4 w-4 mr-1.5" /> Admin
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
              Welcome back, {displayName}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={statusColors[status] || statusColors.active}>{status}</Badge>
              <span className="text-sm text-muted-foreground">
                Member for {monthsActive} months
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Current Giveaway
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {giveaway ? (
                  <>
                    {giveaway.prize_image_url && (
                      <div className="rounded-lg overflow-hidden">
                        <img src={giveaway.prize_image_url} alt={giveaway.title} className="w-full h-40 object-cover" />
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
                <CardTitle className="text-lg font-display">Past Winners</CardTitle>
              </CardHeader>
              <CardContent>
                {winners.length > 0 ? (
                  <ul className="space-y-4">
                    {winners.map((w) => (
                      <li key={w.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{w.winner_name}</p>
                          <p className="text-xs text-muted-foreground">{w.prize_title}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(w.won_at).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No winners yet</p>
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
                    <div className="w-full aspect-[16/9] rounded-md bg-secondary flex items-center justify-center overflow-hidden">
                      {partner.logo_url ? (
                        <img
                          src={partner.logo_url}
                          alt={`${partner.name} logo`}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">
                          {partner.name}
                        </span>
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

          {status !== "cancelled" && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" /> Cancel Membership
                </CardTitle>
                <CardDescription>This will permanently reset your entries to zero.</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Cancel Membership</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your <strong>{entries} entries</strong> will be permanently reset to zero. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Membership</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Yes, Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Payment Details
              </CardTitle>
              <CardDescription>
                Update your card or billing information via our secure payment portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline">Manage Payment Method</Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
