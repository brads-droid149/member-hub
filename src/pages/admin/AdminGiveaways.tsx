import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check, Loader2, Trophy } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;

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

  useEffect(() => {
    loadActive();
  }, []);

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
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
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
              <Label>Prize Image (JPG or PNG)</Label>
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
    </div>
  );
}
