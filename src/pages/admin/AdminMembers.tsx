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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  Search,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useAdminMembers,
  type AdminMemberRow,
  type AdminMembersSortKey,
} from "@/contexts/AdminMembersContext";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";
import { formatDate, exportMembersCSV, exportEmailList, exportDrawList } from "@/lib/utils";
import { MemberStatusBadge } from "@/components/admin/MemberStatusBadge";
import { MemberDetailPanel } from "@/components/admin/MemberDetailPanel";

type Row = AdminMemberRow;

const exemptBadge = () => (
  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-foreground">
    <ShieldCheck className="h-3 w-3 mr-1" />
    Exempt
  </span>
);

export default function AdminMembers() {
  const {
    members: rows,
    totalCount,
    loading,
    page,
    pageSize,
    searchQuery,
    sortKey,
    sortDir,
    setPage,
    setSearchQuery,
    setSort,
    refresh,
    fetchAll,
    setDrawExempt,
    setBillingExempt,
  } = useAdminMembers();
  const { toast } = useToast();
  const [drawExemptPending, setDrawExemptPending] = useState(false);
  const [exporting, setExporting] = useState<null | "members" | "email" | "draw">(null);

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
  const [billingExemptPending, setBillingExemptPending] = useState(false);

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

  const handleToggleBillingExempt = async (value: boolean) => {
    if (!currentSelected) return;
    setBillingExemptPending(true);
    try {
      await setBillingExempt(currentSelected.user_id, value);
      toast({
        title: value ? "Marked as exempt" : "Exempt removed",
        description: currentSelected.full_name || currentSelected.email || currentSelected.user_id.slice(0, 6),
      });
    } catch {
      // toast shown in context
    } finally {
      setBillingExemptPending(false);
    }
  };

  const handleToggleDrawExempt = async (value: boolean) => {
    if (!currentSelected) return;
    setDrawExemptPending(true);
    try {
      await setDrawExempt(currentSelected.user_id, value);
      toast({
        title: value ? "Excluded from draw" : "Included in draw",
        description: currentSelected.full_name || currentSelected.email || currentSelected.user_id.slice(0, 6),
      });
    } catch {
      // toast shown in context
    } finally {
      setDrawExemptPending(false);
    }
  };

  const runExport = async (
    kind: "members" | "email" | "draw",
    fn: (rows: AdminMemberRow[]) => void,
  ) => {
    setExporting(kind);
    try {
      const all = await fetchAll();
      if (all.length === 0) {
        toast({ title: "Nothing to export", description: "No members match the current filter." });
        return;
      }
      fn(all);
    } finally {
      setExporting(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min(totalCount, page * pageSize + rows.length);

  const sortIcon = (key: AdminMembersSortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const SortButton = ({ k, label }: { k: AdminMembersSortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {sortIcon(k)}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Members
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery.trim() ? (
              <>
                Matching: <span className="font-semibold text-foreground">{totalCount}</span>
              </>
            ) : (
              <>
                Total members: <span className="font-semibold text-foreground">{totalCount}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => runExport("members", exportMembersCSV)}
            disabled={loading || totalCount === 0 || exporting !== null}
          >
            {exporting === "members" ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Download Members CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => runExport("email", exportEmailList)}
            disabled={loading || totalCount === 0 || exporting !== null}
          >
            {exporting === "email" ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Email List
          </Button>
          <Button
            variant="outline"
            onClick={() => runExport("draw", exportDrawList)}
            disabled={loading || totalCount === 0 || exporting !== null}
          >
            {exporting === "draw" ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
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
              <TableHead><SortButton k="full_name" label="Full Name" /></TableHead>
              <TableHead><SortButton k="email" label="Email" /></TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">
                <SortButton k="entries" label="Entries" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton k="months_active" label="Months Active" />
              </TableHead>
              <TableHead><SortButton k="status" label="Status" /></TableHead>
              <TableHead><SortButton k="joined_at" label="Joined" /></TableHead>
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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-sm text-muted-foreground">
                  {searchQuery.trim() ? "No members match your search." : "No members yet."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
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
                      {r.billing_exempt && exemptBadge()}
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

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {totalCount === 0
            ? "0 results"
            : `Showing ${pageStart}–${pageEnd} of ${totalCount}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={loading || page === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {Math.min(page + 1, totalPages)} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={loading || page + 1 >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <MemberDetailPanel
        member={currentSelected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onCancel={() => currentSelected && setCancelTarget(currentSelected)}
        onToggleBillingExempt={handleToggleBillingExempt}
        onToggleDrawExempt={handleToggleDrawExempt}
        onSaveStats={handleSaveStats}
        billingExemptPending={billingExemptPending}
        drawExemptPending={drawExemptPending}
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
