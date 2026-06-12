import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Users,
  Loader2,
  ArrowUpDown,
  Download,
  Search,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { useAdminMembers, type AdminMemberRow } from "@/contexts/AdminMembersContext";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate, exportMembersCSV, exportEmailList, exportDrawList } from "@/lib/utils";
import { MemberStatusBadge } from "@/components/admin/MemberStatusBadge";
import { MemberDetailPanel } from "@/components/admin/MemberDetailPanel";
import { useMemberTable } from "@/hooks/use-member-table";

type Row = AdminMemberRow;



const exemptBadge = () => (
  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-foreground">
    <ShieldCheck className="h-3 w-3 mr-1" />
    Exempt
  </span>
);

export default function AdminMembers() {
  const { members: rows, loading, refresh, setExempt, setIsExempt } = useAdminMembers();
  const { toast } = useToast();
  const {
    sortedMembers,
    sortedRows,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    toggleSort,
  } = useMemberTable(rows);
  const [exemptFromWinningPending, setExemptFromWinningPending] = useState(false);

  // Detail panel state
  const [selected, setSelected] = useState<Row | null>(null);

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Re-sync the selected row from latest fetched data
  const currentSelected = useMemo(
    () => (selected ? rows.find((r) => r.user_id === selected.user_id) ?? selected : null),
    [selected, rows],
  );



  const openMember = (r: Row) => {
    setSelected(r);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const { data, error } = await supabase.functions.invoke("admin-cancel-member", {
      body: {
        userId: cancelTarget.user_id,
        environment: getStripeEnvironment(),
        immediate: true,
      },
    });
    setCancelling(false);
    if (error || (data as { error?: string } | null)?.error) {
      const msg = error?.message || (data as { error?: string } | null)?.error || "Failed to cancel";
      toast({ title: "Cancel failed", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Membership cancelled", description: cancelTarget.email ?? cancelTarget.user_id });
    setCancelTarget(null);
    await refresh();
  };

  const [savingStats, setSavingStats] = useState(false);
  const [isExemptPending, setIsExemptPending] = useState(false);

  const handleSaveStats = async (months: number, entries: number) => {
    if (!currentSelected) return;
    setSavingStats(true);
    const { data, error } = await supabase.functions.invoke("admin-update-member", {
      body: {
        userId: currentSelected.user_id,
        monthsActive: months,
        entries,
      },
    });
    setSavingStats(false);
    if (error || (data as { error?: string } | null)?.error) {
      const msg = error?.message || (data as { error?: string } | null)?.error || "Failed to update";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Member stats updated", description: currentSelected.email ?? currentSelected.user_id });
    await refresh();
  };

  const handleToggleIsExempt = async (value: boolean) => {
    if (!currentSelected) return;
    setIsExemptPending(true);
    try {
      await setIsExempt(currentSelected.user_id, value);
      toast({
        title: value ? "Marked as exempt" : "Exempt removed",
        description: currentSelected.full_name || currentSelected.email || currentSelected.user_id.slice(0, 6),
      });
    } catch {
      // toast shown in context
    } finally {
      setIsExemptPending(false);
    }
  };

  const handleToggleExemptFromWinning = async (value: boolean) => {
    if (!currentSelected) return;
    setExemptFromWinningPending(true);
    try {
      await setExempt(currentSelected.user_id, value);
      toast({
        title: value ? "Excluded from draw" : "Included in draw",
        description: currentSelected.full_name || currentSelected.email || currentSelected.user_id.slice(0, 6),
      });
    } catch {
      // toast shown in context
    } finally {
      setExemptFromWinningPending(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Members
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Total members: <span className="font-semibold text-foreground">{rows.length}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportMembersCSV(sortedMembers)} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Download Members CSV
          </Button>
          <Button variant="outline" onClick={() => exportEmailList(sortedMembers)} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Email List
          </Button>
          <Button variant="outline" onClick={() => exportDrawList(sortedMembers)} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Draw Export
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("entries")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Entries
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-right">Months Active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-sm text-muted-foreground">
                  {searchQuery.trim() ? "No members match your search." : "No members yet."}
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.user_id.slice(0, 6)}</TableCell>
                  <TableCell className="font-medium text-foreground">{r.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.state || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.entries}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.months_active}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <MemberStatusBadge status={r.status} />
                      {r.is_exempt && exemptBadge()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.joined_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openMember(r)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MemberDetailPanel
        member={currentSelected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onCancel={() => currentSelected && setCancelTarget(currentSelected)}
        onToggleIsExempt={handleToggleIsExempt}
        onToggleExemptFromWinning={handleToggleExemptFromWinning}
        onSaveStats={handleSaveStats}
        isExemptPending={isExemptPending}
        exemptFromWinningPending={exemptFromWinningPending}
        savingStats={savingStats}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this membership?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately cancel the Stripe subscription for{" "}
              <span className="font-medium text-foreground">
                {cancelTarget?.full_name || cancelTarget?.email || cancelTarget?.user_id}
              </span>
              , set their status to cancelled, and reset their giveaway entries to 0. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep membership</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel membership"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
