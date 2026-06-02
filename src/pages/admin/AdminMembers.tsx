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
import { Users, Loader2, ArrowUpDown, Download, Search, XCircle } from "lucide-react";
import { useAdminMembers, type AdminMemberRow } from "@/contexts/AdminMembersContext";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Row = AdminMemberRow;

type SortKey = "entries";
type SortDir = "asc" | "desc";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function AdminMembers() {
  const { members: rows, loading, refresh } = useAdminMembers();
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((r) => {
      const shortId = r.user_id.slice(0, 6).toLowerCase();
      const fullName = (r.full_name ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      return shortId.includes(q) || fullName.includes(q) || email.includes(q);
    });
  }, [sorted, searchQuery]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const triggerDownload = (lines: string[], filename: string) => {
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const today = () => new Date().toISOString().slice(0, 10);

  const downloadCsv = () => {
    const headers = ["ID", "Full Name", "Email", "Mobile", "State", "Entries", "Months Active", "Joined"];
    const lines = [headers.join(",")];
    for (const r of sorted) {
      lines.push(
        [
          r.user_id.slice(0, 6),
          r.full_name ?? "",
          r.email ?? "",
          r.phone ?? "",
          r.state ?? "",
          r.entries,
          r.months_active,
          formatDate(r.joined_at),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    triggerDownload(lines, `members-${today()}.csv`);
  };

  const downloadEmailList = () => {
    const lines = [["Full Name", "Email"].join(",")];
    for (const r of sorted) {
      lines.push([r.full_name ?? "", r.email ?? ""].map(csvEscape).join(","));
    }
    triggerDownload(lines, `email-list-${today()}.csv`);
  };

  const downloadDrawExport = () => {
    const lines = [["ID", "Full Name", "State"].join(",")];
    for (const r of sorted) {
      // Skip members flagged as exempt (e.g. staff/admin) from prize draws.
      if (r.exempt_from_winning) continue;
      const count = Math.max(0, Math.floor(r.entries));
      // Use the full UUID — a 6-char prefix can collide across members.
      const row = [r.user_id, r.full_name ?? "", r.state ?? ""].map(csvEscape).join(",");
      for (let i = 0; i < count; i++) lines.push(row);
    }
    triggerDownload(lines, `draw-export-${today()}.csv`);
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

  const statusBadge = (status: string | null) => {
    const s = status ?? "—";
    const tone =
      s === "active"
        ? "bg-primary/10 text-primary border-primary/20"
        : s === "past_due"
          ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
          : s === "paused"
            ? "bg-muted text-muted-foreground border-border"
            : s === "cancelled"
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-muted text-muted-foreground border-border";
    return (
      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize", tone)}>
        {s.replace("_", " ")}
      </span>
    );
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
          <Button onClick={downloadCsv} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Download Members CSV
          </Button>
          <Button variant="outline" onClick={downloadEmailList} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Email List
          </Button>
          <Button variant="outline" onClick={downloadDrawExport} disabled={loading || rows.length === 0}>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-sm text-muted-foreground">
                  {searchQuery.trim() ? "No members match your search." : "No members yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.user_id.slice(0, 6)}</TableCell>
                  <TableCell className="font-medium text-foreground">{r.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.state || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.entries}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.months_active}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.joined_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={r.status === "cancelled"}
                      onClick={() => setCancelTarget(r)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
