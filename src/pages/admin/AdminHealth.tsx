import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  check_key: string;
  severity: string;
  title: string;
  detail: Record<string, unknown> | null;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

export default function AdminHealth() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("system_alerts")
      .select("*")
      .order("severity", { ascending: true })
      .order("last_seen_at", { ascending: false });
    if (error) toast.error("Could not load system alerts");
    setAlerts((data ?? []) as AlertRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runCheck = async (notify: boolean) => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("system-health-check", {
      body: { notify },
    });
    setRunning(false);
    if (error) {
      toast.error("Health check failed to run");
      return;
    }
    const open = (data as { open?: number })?.open ?? 0;
    toast.success(
      open === 0
        ? "All checks passed — no problems detected"
        : `${open} issue(s) detected`,
    );
    void load();
  };

  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status !== "open").slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">System Health</h2>
          <p className="text-sm text-muted-foreground">
            Automated checks run every 15 minutes. Admins are emailed when a new problem appears
            or an existing one clears.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={running} onClick={() => runCheck(false)}>
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
            Run check now
          </Button>
          <Button size="sm" variant="secondary" disabled={running} onClick={() => runCheck(true)}>
            Run &amp; email me
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : open.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold text-foreground">No problems detected</p>
              <p className="text-sm text-muted-foreground">All monitored systems are healthy.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {open.map((a) => (
            <Card key={a.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base flex items-start gap-2">
                    {a.severity === "critical" ? (
                      <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    {a.title}
                  </CardTitle>
                  <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>
                    {a.severity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>First seen {fmt(a.first_seen_at)} · last seen {fmt(a.last_seen_at)}</p>
                {a.detail && Object.keys(a.detail).length > 0 && (
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 text-[11px]">
                    {JSON.stringify(a.detail, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Recently resolved</h3>
          {resolved.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>{a.title}</span>
              {a.resolved_at && <span className="text-xs">· {fmt(a.resolved_at)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
