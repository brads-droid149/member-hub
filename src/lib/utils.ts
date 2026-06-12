import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AdminMemberRow } from "@/contexts/AdminMembersContext";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function triggerDownload(lines: string[], filename: string) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMembersCSV(members: AdminMemberRow[]) {
  const headers = ["ID", "Full Name", "Email", "Mobile", "State", "Entries", "Months Active", "Joined"];
  const lines = [headers.join(",")];
  for (const r of members) {
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
}

