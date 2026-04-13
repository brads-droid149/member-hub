import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;
type Winner = Tables<"past_winners">;

const statusColors: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  paused: "bg-warning/20 text-warning border-warning/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function Dashboard() {
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [member, setMember] = useState<{ status: string; months_active: number; entries: number } | null>(null);
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, memberRes, giveawayRes, winnersRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
        supabase.from("members").select("status, months_active, entries").eq("user_id", user.id).single(),
        supabase.from("giveaways").select("*").eq("is_active", true).limit(1).single(),
        supabase.from("past_winners").select("*").order("won_at", { ascending: false }).limit(5),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (memberRes.data) setMember(memberRes.data);
      if (giveawayRes.data) setGiveaway(giveawayRes.data);
      if (winnersRes.data) setWinners(winnersRes.data);
    };
    load();
  }, []);

  const displayName = profile?.full_name || "Member";
  const status = member?.status || "active";
  const entries = member?.entries || 0;
  const monthsActive = member?.months_active || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Welcome back, {displayName}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={statusColors[status] || statusColors.active}>
            {status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Member for {monthsActive} months
          </span>
        </div>
      </div>

      {/* Entry Count Hero */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <CardContent className="relative flex flex-col items-center justify-center py-12">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">
            Your Entries
          </p>
          <span className="text-7xl font-display font-bold text-primary animate-pulse-glow">
            {entries}
          </span>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +1 entry every month you stay active
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Giveaway */}
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

        {/* Past Winners */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Past Winners</CardTitle>
          </CardHeader>
          <CardContent>
            {winners.length > 0 ? (
              <ul className="space-y-4">
                {winners.map(w => (
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
    </div>
  );
}
