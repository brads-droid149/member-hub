import { cn } from "@/lib/utils";

interface MemberStatusBadgeProps {
  status: string | null;
}

export function MemberStatusBadge({ status }: MemberStatusBadgeProps) {
  const s = status ?? "—";
  const tone =
    s === "active"
      ? "bg-primary/10 text-primary border-primary/20"
      : s === "past_due"
        ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
        : s === "cancelled"
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        tone,
      )}
    >
      {s.replace("_", " ")}
    </span>
  );
}
