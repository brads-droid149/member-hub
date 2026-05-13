import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Copy, Check, CreditCard, LogOut, Shield, LayoutGrid, Tag, Settings as SettingsIcon, User, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/use-admin";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;
type Winner = Tables<"past_winners">;
type Partner = Tables<"partners">;

const STRIPE_PORTAL_URL = import.meta.env.VITE_STRIPE_PORTAL_URL;

export default function Home() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  

  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [member, setMember] = useState<{ months_active: number; entries: number } | null>(null);
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [userId, setUserId] = useState<string | null>(null);
  const [pFullName, setPFullName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pState, setPState] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const metaName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        null;
      setAuthName(metaName);

      setUserId(user.id);

      const [profileRes, memberRes, giveawayRes, winnersRes, partnersRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, state").eq("user_id", user.id).maybeSingle(),
        supabase.from("members").select("months_active, entries").eq("user_id", user.id).maybeSingle(),
        supabase.from("giveaways").select("*").eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("past_winners").select("*").order("draw_date", { ascending: false, nullsFirst: false }),
        supabase.from("partners").select("*").order("name"),
      ]);

      if (profileRes.data) {
        setProfile({ full_name: profileRes.data.full_name });
        setPFullName(profileRes.data.full_name ?? "");
        setPPhone(profileRes.data.phone ?? "");
        setPState(profileRes.data.state ?? "");
      }
      if (memberRes.data) {
        setMember(memberRes.data);
      }
      if (giveawayRes.data) setGiveaway(giveawayRes.data);
      if (winnersRes.data) setWinners(winnersRes.data);
      if (partnersRes.data) {
        const sorted = [...partnersRes.data].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        setPartners(sorted);
      }
      setLoading(false);
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
  const monthsActive = member?.months_active ?? 0;
  const monthsLabel = monthsActive === 0
    ? "New Member"
    : `Club Member for ${monthsActive} ${monthsActive === 1 ? "month" : "months"}`;


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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
  const PHONE_RE = /^\+61\s?[2-9](?:[\s-]?\d){8}$/;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!pFullName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (pPhone && !PHONE_RE.test(pPhone.trim())) {
      toast({
        title: "Invalid mobile number",
        description: "Use Australian format, e.g. +61 412 345 678",
        variant: "destructive",
      });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: pFullName.trim(),
        phone: pPhone.trim() || null,
        state: pState || null,
      })
      .eq("user_id", userId);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Could not save profile", description: error.message, variant: "destructive" });
      return;
    }
    setProfile({ full_name: pFullName.trim() });
    toast({ title: "Profile updated" });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Could not update password", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Password updated" });
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

      <main className="max-w-5xl mx-auto px-6 py-10 pb-24 md:pb-10 space-y-16">
        {/* OVERVIEW */}
        <section id="overview" className="space-y-8 scroll-mt-20">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 text-sm">
                {monthsLabel}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Current Giveaway
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="w-full aspect-video rounded-lg" />
                ) : giveaway ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                    {giveaway.prize_image_url ? (
                      <img src={giveaway.prize_image_url} alt={giveaway.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">Prize image</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 py-5">
                      <h3 className="font-display font-semibold text-white drop-shadow">{giveaway.title}</h3>
                      {giveaway.draw_date && (
                        <p className="text-sm text-white/90 flex items-center gap-1 mt-1 drop-shadow">
                          <Calendar className="h-3 w-3" />
                          Draw: {new Date(giveaway.draw_date).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No active giveaway right now</p>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col h-full">
              <CardHeader className="flex flex-col space-y-1.5 p-6 py-[15px]">
                <CardTitle className="text-lg font-display">Your Entries This Draw</CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-1 flex flex-col justify-center text-center space-y-6 py-0">
                {loading ? (
                  <>
                    <Skeleton className="h-28 w-32 mx-auto" />
                    <div className="space-y-1.5 max-w-xs mx-auto">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4 mx-auto" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-9xl font-display font-bold text-primary leading-none">{entries}</p>
                    <div className="text-xs text-muted-foreground max-w-xs mx-auto space-y-0.5">
                      <p>You earn +1 entry every month you stay active.</p>
                      <p>Entries reset if you cancel or win.</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col h-full">
              <CardHeader className="flex flex-col space-y-1.5 p-6 py-[15px]">
                <CardTitle className="text-lg font-display">Past Winners</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {loading ? (
                  <ul className="divide-y divide-border">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <li key={i} className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                        <Skeleton className="h-3 w-20" />
                      </li>
                    ))}
                  </ul>
                ) : winners.length > 0 ? (
                  <>
                    <ul className="divide-y divide-border">
                      {winners.slice(0, 3).map((w) => (
                        <li key={w.id} className="py-3 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{w.winner_name}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{w.prize_title}</p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {w.draw_date
                              ? new Date(w.draw_date).toLocaleDateString("en-AU", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => scrollTo("past-winners")}
                      className="mt-auto pt-4 text-sm font-medium text-primary hover:underline self-start"
                    >
                      See All Winners
                    </button>
                  </>
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

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                    <Skeleton className="w-full aspect-[16/9] rounded-md" />
                    <div className="w-full space-y-1.5">
                      <Skeleton className="h-4 w-2/3 mx-auto" />
                      <Skeleton className="h-3 w-1/2 mx-auto" />
                    </div>
                    <Skeleton className="h-7 w-24 rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : partners.length > 0 ? (
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

        {/* PAST WINNERS (FULL) */}
        <section id="past-winners" className="space-y-6 scroll-mt-20">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Past Winners
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Every member who has won a Junkyard Club giveaway.</p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-3 w-24" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : winners.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {winners.map((w) => (
                    <li
                      key={w.id}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">{w.winner_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.prize_title}
                          {w.state ? ` · ${w.state}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {w.draw_date
                          ? new Date(w.draw_date).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No winners yet</p>
          )}
        </section>

        {/* SETTINGS */}
        <section id="settings" className="space-y-6 scroll-mt-20 max-w-2xl">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              Membership Settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Manage your subscription</p>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start border rounded-lg bg-card px-6 py-4 h-auto text-sm font-medium text-foreground hover:bg-accent/50"
            onClick={() => window.open(STRIPE_PORTAL_URL, "_blank")}
          >
            <CreditCard className="h-5 w-5 text-primary mr-2" />
            Manage Your Subscription
          </Button>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="profile" className="border rounded-lg bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-5 w-5 text-primary" />
                  Profile Settings
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      value={pFullName}
                      onChange={(e) => setPFullName(e.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Mobile number</Label>
                    <Input
                      id="phone"
                      value={pPhone}
                      onChange={(e) => setPPhone(e.target.value)}
                      placeholder="+61 412 345 678"
                      inputMode="tel"
                    />
                    <p className="text-xs text-muted-foreground">Australian format, starting with +61</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select value={pState} onValueChange={setPState}>
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent>
                        {AU_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </Button>
                </form>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="password" className="border rounded-lg bg-card">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Change Password
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_password">New password</Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="Section navigation"
      >
        <div className="grid grid-cols-3">
          {[
            { id: "overview", label: "Overview", Icon: LayoutGrid },
            { id: "partners", label: "Partners", Icon: Tag },
            { id: "settings", label: "Settings", Icon: SettingsIcon },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-muted-foreground hover:text-foreground active:bg-accent transition-colors"
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
