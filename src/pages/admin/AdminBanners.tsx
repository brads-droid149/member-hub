import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Image as ImageIcon, Check, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Banner = Tables<"banners">;

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png"];

export default function AdminBanners() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState<Banner | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("banners")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCurrent(data);
      setLinkUrl(data.link_url ?? "");
      setIsActive(data.is_active);
      setImageUrl(data.image_url);
      setPreviewUrl(data.image_url);
    } else {
      setCurrent(null);
      setLinkUrl("");
      setIsActive(false);
      setImageUrl(null);
      setPreviewUrl(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
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
    const path = `banners/${crypto.randomUUID()}.${ext}`;
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
    if (!pendingFile && !imageUrl) {
      toast({ title: "Image required", description: "Please upload a banner image.", variant: "destructive" });
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
          .from("banners")
          .update({
            image_url: finalImageUrl!,
            link_url: linkUrl.trim() || null,
            is_active: isActive,
          })
          .eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("banners").insert({
          image_url: finalImageUrl!,
          link_url: linkUrl.trim() || null,
          is_active: isActive,
        });
        if (error) throw error;
      }

      setPendingFile(null);
      setImageUrl(finalImageUrl);
      setSavedFlash(true);
      toast({ title: "Banner saved" });
      setTimeout(() => setSavedFlash(false), 2500);
      await load();
    } catch (err) {
      toast({ title: "Save failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    if (!confirm("Delete this banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", current.id);
    if (error) {
      toast({ title: "Delete failed", description: getErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Banner deleted" });
    await load();
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
          <ImageIcon className="h-5 w-5 text-primary" />
          Promotional Banner
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Shown on the member dashboard below the main cards. Wide horizontal image (~16:5).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{current ? "Edit Banner" : "Create Banner"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label>Banner Image (JPG or PNG, wide horizontal ~16:5)</Label>
              <div className="flex flex-col gap-4 items-start">
                <div className="w-full aspect-[16/5] rounded-lg border border-border bg-white overflow-hidden flex items-center justify-center">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover object-center" />
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
                    <p className="text-xs text-muted-foreground">Pending: {pendingFile.name} — saved on submit</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-link">Link URL</Label>
              <Input
                id="b-link"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/promo"
              />
              <p className="text-xs text-muted-foreground">Opens in a new tab when members click the banner.</p>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="b-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="b-active" className="cursor-pointer">
                {isActive ? "Active — visible to members" : "Inactive — hidden from members"}
              </Label>
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
                  "Save Banner"
                )}
              </Button>
              {current && (
                <Button type="button" variant="outline" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
