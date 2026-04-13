import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;

export default function AdminGiveaways() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [title, setTitle] = useState("");
  const [prizeImageUrl, setPrizeImageUrl] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const { toast } = useToast();

  const fetchGiveaways = async () => {
    const { data } = await supabase.from("giveaways").select("*").order("created_at", { ascending: false });
    if (data) setGiveaways(data);
  };

  useEffect(() => { fetchGiveaways(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("giveaways").insert({
      title,
      prize_image_url: prizeImageUrl || null,
      draw_date: drawDate || null,
      is_active: false,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Giveaway added" });
      setTitle(""); setPrizeImageUrl(""); setDrawDate("");
      fetchGiveaways();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("giveaways").update({ is_active: !current }).eq("id", id);
    fetchGiveaways();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("giveaways").delete().eq("id", id);
    fetchGiveaways();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold text-foreground">Manage Giveaways</h2>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Giveaway</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Prize name" />
            </div>
            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input value={prizeImageUrl} onChange={e => setPrizeImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Draw Date</Label>
              <Input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
            </div>
            <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {giveaways.map(g => (
          <Card key={g.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-foreground">{g.title}</p>
                <p className="text-xs text-muted-foreground">
                  Draw: {g.draw_date ? new Date(g.draw_date).toLocaleDateString() : "TBD"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Active</Label>
                  <Switch checked={g.is_active} onCheckedChange={() => toggleActive(g.id, g.is_active)} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {giveaways.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No giveaways yet</p>}
      </div>
    </div>
  );
}
