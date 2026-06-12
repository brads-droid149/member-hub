import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, XCircle, ShieldCheck, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberStatusBadge } from "@/components/admin/MemberStatusBadge";
import { Switch } from "@/components/ui/switch";
import type { AdminMemberRow } from "@/contexts/AdminMembersContext";

interface MemberDetailPanelProps {
  member: AdminMemberRow | null;
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
  onToggleIsExempt: (value: boolean) => Promise<void>;
  onSaveStats: (months: number, entries: number) => Promise<void>;
  isExemptPending: boolean;
  savingStats: boolean;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};


const exemptBadge = () => (
  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-foreground">
    <ShieldCheck className="h-3 w-3 mr-1" />
    Exempt
  </span>
);

export function MemberDetailPanel({
  member,
  open,
  onClose,
  onCancel,
  onToggleIsExempt,
  onSaveStats,
  isExemptPending,
  savingStats,
}: MemberDetailPanelProps) {
  const [editMonths, setEditMonths] = useState(0);
  const [editEntries, setEditEntries] = useState(0);

  useEffect(() => {
    if (member) {
      setEditMonths(member.months_active);
      setEditEntries(member.entries);
    }
  }, [member]);

  const s = member;
  const canCancel = s?.status === "active" || s?.status === "past_due";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {s && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {s.full_name || s.email || s.user_id.slice(0, 6)}
              </SheetTitle>
              <SheetDescription>Member detail and admin actions.</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <MemberStatusBadge status={s.status} />
                {s.is_exempt && exemptBadge()}
                {s.exempt_from_winning && (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Draw exempt
                  </span>
                )}
              </div>

              {/* Member info */}
              <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="col-span-2 text-foreground break-all">{s.email || "—"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="col-span-2 text-foreground">{s.phone || "—"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">State</span>
                  <span className="col-span-2 text-foreground">{s.state || "—"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="col-span-2 text-foreground">{formatDate(s.joined_at)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">Months Active</span>
                  <span className="col-span-2 font-mono text-foreground">{s.months_active}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">Entries</span>
                  <span className="col-span-2 font-mono text-foreground">{s.entries}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="col-span-2 font-mono text-xs text-muted-foreground break-all">{s.user_id}</span>
                </div>
              </div>

              {/* Edit Member Stats */}
              {s.status === "active" && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" />
                    Edit Member Stats
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Manually adjust months active and entries for this member.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-months" className="text-xs">Months Active</Label>
                      <Input
                        id="edit-months"
                        type="number"
                        min={0}
                        value={editMonths}
                        onChange={(e) => setEditMonths(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-entries" className="text-xs">Entries</Label>
                      <Input
                        id="edit-entries"
                        type="number"
                        min={0}
                        value={editEntries}
                        onChange={(e) => setEditEntries(Math.max(0, Number(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                  <Button onClick={() => onSaveStats(editMonths, editEntries)} disabled={savingStats} className="w-full">
                    {savingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              )}

              {/* Cancel */}
              {canCancel && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Cancel Member
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Immediately cancels the Stripe subscription, sets status to cancelled, and resets entries to 0.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={onCancel}
                  >
                    Cancel Membership
                  </Button>
                </div>
              )}

              {/* Exempt */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Billing Exempt
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Exempt members (e.g. staff, media, competition winners) retain active status without an active Stripe subscription.
                    </p>
                  </div>
                  <Switch
                    checked={s.is_exempt}
                    disabled={isExemptPending}
                    onCheckedChange={onToggleIsExempt}
                    aria-label="Billing exempt"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
