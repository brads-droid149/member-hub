import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check, Loader2, Trophy, Award, Search, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;

type MemberRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: string | null;
  entries: number;
  months_active: number;
  joined_at: string;
};

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png"];

export default function AdminGiveaways() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState<Giveaway | null>(null);
  const [title, setTitle] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const loadActive = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("giveaways")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCurrent(data);
      setTitle(data.title);
      setDrawDate(data.draw_date ?? "");
      setImageUrl(data.prize_image_url);
      setPreviewUrl(data.prize_image_url);
    }
    setLoading(false);
  };

  // Record winner state
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [winnerPrize, setWinnerPrize] = useState("");
  const [winnerDrawDate, setWinnerDrawDate] = useState<Date | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadMembers = async () => {
    const { data, error } = await supabase.rpc("get_admin_members_overview");
    if (error) {
      toast({ title: "Failed to load members", description: error.message, variant: "destructive" });
    } else if (data) {
      setMembers(data as MemberRow[]);
    }
  };

  useEffect(() => {
    loadActive();
    loadMembers();
  }, []);

  useEffect(() => {
    setWinnerPrize(title);
  }, [title]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) =>
        m.user_id.toLowerCase().includes(q) ||
        (m.full_name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, members]);

  const handleRecordWinner = async () => {
    if (!selected) return;
    setRecording(true);
    try {
      const { error: insertError } = await supabase.from("past_winners").insert({
        giveaway_id: current?.id ?? null,
        winner_name: selected.full_name ?? "",
        state: selected.state ?? null,
        prize_title: winnerPrize.trim(),
        draw_date: winnerDrawDate ? format(winnerDrawDate, "yyyy-MM-dd") : null,
      });
      if (insertError) throw insertError;

      const { error: resetError } = await supabase
        .from("members")
        .update({ entries: 0 })
        .eq("user_id", selected.user_id);
      if (resetError) throw resetError;

      toast({ title: "Winner recorded", description: `${selected.full_name} added to past winners. Entries reset to 0.` });
      setSelected(null);
      setSearch("");
      setWinnerDrawDate(undefined);
      await loadMembers();
    } catch (err: any) {
      toast({ title: "Failed to record winner", description: err.message, variant: "destructive" });
    } finally {
      setRecording(false);
      setConfirmOpen(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Invalid file", description: "Please upload a JPG or PNG image", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 5MB", variant: "destructive" });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      const targetRatio = 16 / 9;
      const ratioOk = Math.abs(ratio - targetRatio) < 0.02;
      const sizeOk = img.width >= 1280 && img.height >= 720;

      if (!ratioOk) {
        toast({
          title: "Wrong aspect ratio",
          description: `Image must be 16:9. Yours is ${img.width}×${img.height} (${ratio.toFixed(2)}:1).`,
          variant: "destructive",
        });
        URL.revokeObjectURL(objectUrl);
        return;
      }
      if (!sizeOk) {
        toast({
          title: "Resolution too low",
          description: `Minimum 1280×720px. Yours is ${img.width}×${img.height}.`,
          variant: "destructive",
        });
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setPendingFile(file);
      setPreviewUrl(objectUrl);
    };
    img.onerror = () => {
      toast({ title: "Could not read image", variant: "destructive" });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `giveaways/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("admin-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("admin-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (pendingFile) {
        finalImageUrl = await uploadImage(pendingFile);
      }

      if (current) {
        const { error } = await supabase
          .from("giveaways")
          .update({
            title: title.trim(),
            draw_date: drawDate || null,
            prize_image_url: finalImageUrl,
            is_active: true,
          })
          .eq("id", current.id);
        if (error) throw error;
      } else {
        // Deactivate any others, then insert new active
        await supabase.from("giveaways").update({ is_active: false }).eq("is_active", true);
        const { error } = await supabase.from("giveaways").insert({
          title: title.trim(),
          draw_date: drawDate || null,
          prize_image_url: finalImageUrl,
          is_active: true,
        });
        if (error) throw error;
      }

      setPendingFile(null);
      setImageUrl(finalImageUrl);
      setSavedFlash(true);
      toast({ title: "Giveaway saved", description: "Members will see this on their dashboard." });
      setTimeout(() => setSavedFlash(false), 2500);
      await loadActive();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Current Giveaway
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Only one giveaway is active at a time. Saving updates the live member dashboard immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{current ? "Edit Giveaway" : "Create Giveaway"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Prize Image (JPG or PNG, 16:9, min 1280×720px)</Label>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-full sm:w-64 aspect-video rounded-lg border border-border bg-white overflow-hidden flex items-center justify-center">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">No image yet</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    {previewUrl ? "Replace image" : "Upload image"}
                  </Button>
                  {pendingFile && (
                    <p className="text-xs text-muted-foreground">
                      Pending: {pendingFile.name} — saved on submit
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="g-title">Prize Title</Label>
                <Input
                  id="g-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 1965 Mustang Restoration Kit"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-date">Draw Date</Label>
                <Input
                  id="g-date"
                  type="date"
                  value={drawDate}
                  onChange={(e) => setDrawDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : savedFlash ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Saved
                  </>
                ) : (
                  "Save Giveaway"
                )}
              </Button>
              {savedFlash && (
                <span className="text-sm text-success flex items-center gap-1">
                  <Check className="h-4 w-4" /> Live on member dashboard
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Record Winner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="winner-search">Search member by user ID, name or email</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="winner-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected(null);
                }}
                placeholder="Start typing a user ID..."
                className="pl-9"
              />
            </div>
            {search && !selected && matches.length > 0 && (
              <div className="rounded-md border border-border bg-card divide-y divide-border max-h-64 overflow-auto">
                {matches.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => {
                      setSelected(m);
                      setSearch(m.user_id);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-mono text-xs text-muted-foreground">{m.user_id}</div>
                    <div className="text-sm font-medium text-foreground">{m.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{m.email || "—"}</div>
                  </button>
                ))}
              </div>
            )}
            {search && !selected && matches.length === 0 && (
              <p className="text-xs text-muted-foreground">No matching members.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Selected Member</Label>
            <Input
              readOnly
              value={selected ? `${selected.full_name ?? "—"} — ${selected.email ?? "—"}` : ""}
              placeholder="No member selected"
              className="bg-muted/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="winner-prize">Prize Title</Label>
              <Input
                id="winner-prize"
                value={winnerPrize}
                onChange={(e) => setWinnerPrize(e.target.value)}
                placeholder="Prize title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Draw Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !winnerDrawDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {winnerDrawDate ? format(winnerDrawDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={winnerDrawDate}
                    onSelect={setWinnerDrawDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Button
              type="button"
              disabled={!selected || !winnerPrize.trim() || !winnerDrawDate || recording}
              onClick={() => setConfirmOpen(true)}
            >
              {recording ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Award className="h-4 w-4 mr-2" />
                  Record Winner
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record this winner?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to record <span className="font-semibold text-foreground">{selected?.full_name}</span> ({selected?.email}) as the winner of <span className="font-semibold text-foreground">{winnerPrize}</span>.
              <br /><br />
              <strong>This will reset their entries to zero.</strong> This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={recording}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecordWinner} disabled={recording}>
              {recording ? "Recording..." : "Confirm & Reset Entries"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
