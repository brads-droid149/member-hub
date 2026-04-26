import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Loader2, Tag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"partners">;
type PartnerForm = {
  name: string;
  description: string;
  discount_code: string;
  logo_url: string | null;
};

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png"];

const emptyForm: PartnerForm = { name: "", description: "", discount_code: "", logo_url: null };

export default function AdminPartners() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await supabase.from("partners").select("*").order("name");
    if (data) setPartners(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLogoPreview(null);
    setPendingLogo(null);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (p: Partner) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      discount_code: p.discount_code,
      logo_url: p.logo_url,
    });
    setLogoPreview(p.logo_url);
    setPendingLogo(null);
    setErrors({});
    setDialogOpen(true);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Invalid file", description: "JPG or PNG only", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 2MB", variant: "destructive" });
      return;
    }
    setPendingLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `partners/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("admin-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    return supabase.storage.from("admin-assets").getPublicUrl(path).data.publicUrl;
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Brand name is required";
    if (!form.description.trim()) e.description = "Discount description is required";
    if (!form.discount_code.trim()) e.discount_code = "Promo code is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      let logoUrl = form.logo_url;
      if (pendingLogo) {
        logoUrl = await uploadLogo(pendingLogo);
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        discount_code: form.discount_code.trim(),
        logo_url: logoUrl,
      };

      if (editingId) {
        const { error } = await supabase.from("partners").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Partner updated" });
      } else {
        const { error } = await supabase.from("partners").insert(payload);
        if (error) throw error;
        toast({ title: "Partner added" });
      }

      setDialogOpen(false);
      await fetchPartners();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("partners").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Partner removed" });
      await fetchPartners();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Partner Discounts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage partner brands shown in the member portal Partners & Discounts grid.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add New Partner
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Logo</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Promo Code</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : partners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                  No partners yet. Click "Add New Partner" to get started.
                </TableCell>
              </TableRow>
            ) : (
              partners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded-full bg-white border border-border overflow-hidden flex items-center justify-center">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {p.description || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm bg-secondary px-2 py-1 rounded text-primary">
                      {p.discount_code}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(p.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Partner" : "Add New Partner"}</DialogTitle>
            <DialogDescription>
              All fields are required. Changes appear instantly on the member portal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white border border-border overflow-hidden flex items-center justify-center shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">Logo</span>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {logoPreview ? "Replace logo" : "Upload logo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG or PNG, max 2MB</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-name">Brand Name</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. RockAuto"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Discount Description</Label>
              <Textarea
                id="p-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. 15% off all parts"
                rows={2}
                aria-invalid={!!errors.description}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-code">Promo Code</Label>
              <Input
                id="p-code"
                value={form.discount_code}
                onChange={(e) => setForm({ ...form, discount_code: e.target.value.toUpperCase() })}
                placeholder="e.g. CREW15"
                className="font-mono"
                aria-invalid={!!errors.discount_code}
              />
              {errors.discount_code && <p className="text-xs text-destructive">{errors.discount_code}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Save Changes" : "Add Partner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the partner and their discount code from the member portal. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
