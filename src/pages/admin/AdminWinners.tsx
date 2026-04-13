import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Winner = Tables<"past_winners">;
type Giveaway = Tables<"giveaways">;

export default function AdminWinners() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [winnerName, setWinnerName] = useState("");
  const [prizeTitle, setPrizeTitle] = useState("");
  const [giveawayId, setGiveawayId] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    const [winnersRes, giveawaysRes] = await Promise.all([
      supabase.from("past_winners").select("*").order("won_at", { ascending: false }),
      supabase.from("giveaways").select("*").order("created_at", { ascending: false }),
    ]);
    if (winnersRes.data) setWinners(winnersRes.data);
    if (giveawaysRes.data) setGiveaways(giveawaysRes.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("past_winners").insert({
      winner_name: winnerName,
      prize_title: prizeTitle,
      giveaway_id: giveawayId || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Winner added" });
      setWinnerName(""); setPrizeTitle(""); setGiveawayId("");
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("past_winners").delete().eq("id", id);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold text-foreground">Manage Past Winners</h2>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Winner</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Winner Name</Label>
              <Input value={winnerName} onChange={e => setWinnerName(e.target.value)} required placeholder="Name" />
            </div>
            <div className="space-y-1">
              <Label>Prize Title</Label>
              <Input value={prizeTitle} onChange={e => setPrizeTitle(e.target.value)} required placeholder="What they won" />
            </div>
            <div className="space-y-1">
              <Label>Linked Giveaway</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={giveawayId}
                onChange={e => setGiveawayId(e.target.value)}
              >
                <option value="">None</option>
                {giveaways.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {winners.map(w => (
          <Card key={w.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-foreground">{w.winner_name}</p>
                <p className="text-xs text-muted-foreground">{w.prize_title} · {new Date(w.won_at).toLocaleDateString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(w.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {winners.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No winners yet</p>}
      </div>
    </div>
  );
}
