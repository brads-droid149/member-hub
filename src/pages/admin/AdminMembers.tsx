import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users, Loader2, ArrowUpDown, Download } from "lucide-react";

type Row = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: string;
  entries: number;
  months_active: number;
  joined_at: string;
};

type SortKey = "status" | "entries";
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
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_admin_members_overview");
      if (error) {
        toast({ title: "Failed to load members", description: error.message, variant: "destructive" });
      } else if (data) {
        setRows(data as Row[]);
      }
      setLoading(false);
    })();
  }, [toast]);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const activeCount = useMemo(() => rows.filter((r) => r.status === "active").length, [rows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const downloadCsv = () => {
    const headers = [
      "Full Name",
      "Email",
      "Mobile",
      "State",
      "Status",
      "Entries",
      "Months Active",
      "Joined",
    ];
    const lines = [headers.join(",")];
    for (const r of sorted) {
      lines.push(
        [
          r.full_name ?? "",
          r.email ?? "",
          r.phone ?? "",
          r.state ?? "",
          r.status,
          r.entries,
          r.months_active,
          formatDate(r.joined_at),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const classes =
      status === "active"
        ? "bg-success/20 text-success border-success/30"
        : status === "cancelled"
          ? "bg-destructive/20 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground border-border";
    return <Badge className={classes}>{status}</Badge>;
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
            Total active members:{" "}
            <span className="font-semibold text-foreground">{activeCount}</span>
            <span className="text-muted-foreground/70"> / {rows.length} total</span>
          </p>
        </div>
        <Button onClick={downloadCsv} disabled={loading || rows.length === 0}>
          <Download className="h-4 w-4 mr-1.5" />
          Download Members CSV
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>State</TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("status")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Status
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
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
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                  No members yet.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium text-foreground">{r.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.phone || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.state || "—"}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.entries}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.months_active}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.joined_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
