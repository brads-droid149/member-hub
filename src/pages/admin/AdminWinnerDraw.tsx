import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Shuffle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MemberRow {
  user_id: string;
  entries: number;
  months_active: number;
  status: string;
  full_name: string | null;
}

interface ActiveGiveaway {
  id: string;
  title: string;
}

export default function AdminWinnerDraw() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [giveaway, setGiveaway] = useState<ActiveGiveaway | null>(null);
  const [winner, setWinner] = useState<MemberRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [membersRes, profilesRes, giveawayRes] = await Promise.all([
      supabase.from("members").select("user_id, entries, months_active, status").eq("status", "active"),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("giveaways").select("id, title").eq("is_active", true).limit(1).maybeSingle(),
    ]);

    if (membersRes.data) {
      const merged = membersRes.data.map((m) => ({
        ...m,
        full_name: profilesRes.data?.find((p) => p.user_id === m.user_id)?.full_name ?? null,
      }));
      setMembers(merged);
    }
    if (giveawayRes.data) setGiveaway(giveawayRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalEntries = members.reduce((sum, m) => sum + (m.entries || 0), 0);

  const drawWinner = () => {
    if (totalEntries === 0) {
      toast({ title: "No entries", description: "No active members have entries.", variant: "destructive" });
      return;
    }
    let pick = Math.floor(Math.random() * totalEntries);
    for (const m of members) {
      pick -= m.entries || 0;
      if (pick < 0) {
        setWinner(m);
        return;
      }
    }
  };

  const saveWinner = async () => {
    if (!winner) return;
    setSaving(true);
    const { error } = await supabase.from("past_winners").insert({
      winner_name: winner.full_name || "Unnamed Member",
      prize_title: giveaway?.title || "Giveaway Prize",
      giveaway_id: giveaway?.id || null,
    });

    if (error) {
      setSaving(false);
      setConfirmOpen(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // ENTRIES LIFECYCLE
    // Entries increment by 1 monthly via cron job on billing date — to be
    // implemented by backend team on Node.js migration. New members start at 1.
    // Winners reset to 0. Cancelled members reset to 0.
    const { error: resetError } = await supabase
      .from("members")
      .update({ entries: 0 })
      .eq("user_id", winner.user_id);

    setSaving(false);
    setConfirmOpen(false);

    if (resetError) {
      toast({
        title: "Winner saved, but entries reset failed",
        description: resetError.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Winner saved!", description: `${winner.full_name} has been added to past winners and their entries have been reset.` });
    }
    setWinner(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold text-foreground">Winner Draw</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Active Members</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-display font-bold text-foreground">{members.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Entries in Draw</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-display font-bold text-primary">{totalEntries}</p></CardContent>
        </Card>
      </div>

      {giveaway && (
        <p className="text-sm text-muted-foreground">
          Drawing for: <span className="font-medium text-foreground">{giveaway.title}</span>
        </p>
      )}

      <Button onClick={drawWinner} disabled={totalEntries === 0}>
        <Shuffle className="h-4 w-4 mr-2" /> Draw Winner
      </Button>

      {winner && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-primary" /> Winner Selected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-display font-bold text-foreground">{winner.full_name || "Unnamed Member"}</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Entries: <span className="text-foreground font-medium">{winner.entries}</span></p>
              <p>Months Active: <span className="text-foreground font-medium">{winner.months_active}</span></p>
              <p>Status: <span className="text-foreground font-medium">{winner.status}</span></p>
              <p>Win Probability: <span className="text-foreground font-medium">{((winner.entries / totalEntries) * 100).toFixed(2)}%</span></p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setConfirmOpen(true)}>Save Winner</Button>
              <Button variant="outline" onClick={drawWinner}>Redraw</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save winner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add <strong>{winner?.full_name}</strong> to the past winners list for "{giveaway?.title || "this giveaway"}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveWinner} disabled={saving}>
              {saving ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
