import { useMemo, useState } from "react";
import type { AdminMemberRow } from "@/contexts/AdminMembersContext";

export type SortKey = "entries";
export type SortDir = "asc" | "desc";

export function useMemberTable(members: AdminMemberRow[]) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");

  const sortedMembers = useMemo(() => {
    if (!sortKey) return members;
    const copy = [...members];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [members, sortKey, sortDir]);

  const sortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((r) => {
      const shortId = r.user_id.slice(0, 6).toLowerCase();
      const fullName = (r.full_name ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      return shortId.includes(q) || fullName.includes(q) || email.includes(q);
    });
  }, [sortedMembers, searchQuery]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return {
    sortedMembers,
    sortedRows,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
    toggleSort,
  };
}
