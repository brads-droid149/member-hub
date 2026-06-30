import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AdminMemberRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  status: string | null;
  entries: number;
  months_active: number;
  joined_at: string;
  draw_exempt: boolean;
  billing_exempt: boolean;
};

type RawRow = AdminMemberRow & { total_count: number | string | null };

export type AdminMembersSortKey =
  | "joined_at"
  | "entries"
  | "months_active"
  | "full_name"
  | "email"
  | "status";

export type AdminMembersSortDir = "asc" | "desc";

export const ADMIN_MEMBERS_PAGE_SIZE = 50;

type Ctx = {
  /** Rows for the current page (server-paginated). */
  members: AdminMemberRow[];
  /** Total rows matching the current search, regardless of page. */
  totalCount: number;
  loading: boolean;
  /** Current page (0-indexed). */
  page: number;
  pageSize: number;
  searchQuery: string;
  sortKey: AdminMembersSortKey;
  sortDir: AdminMembersSortDir;

  setPage: (page: number) => void;
  setSearchQuery: (q: string) => void;
  setSort: (key: AdminMembersSortKey, dir?: AdminMembersSortDir) => void;
  refresh: () => Promise<void>;

  /** Fetch every member matching the current search (used for CSV exports). */
  fetchAll: () => Promise<AdminMemberRow[]>;
  /** One-off paginated search (used by the winner picker). */
  searchMembers: (query: string, limit?: number) => Promise<AdminMemberRow[]>;

  setDrawExempt: (userId: string, value: boolean) => Promise<void>;
  setBillingExempt: (userId: string, value: boolean) => Promise<void>;
};

const AdminMembersContext = createContext<Ctx | null>(null);

const stripTotal = (rows: RawRow[]): AdminMemberRow[] =>
  rows.map(({ total_count: _ignored, ...rest }) => rest);

export function AdminMembersProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPageState] = useState(0);
  const [searchQuery, setSearchQueryState] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKeyState] = useState<AdminMembersSortKey>("joined_at");
  const [sortDir, setSortDirState] = useState<AdminMembersSortDir>("desc");

  // Debounce search input so we don't fire an RPC on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Reset to page 0 whenever the effective filter/sort changes.
  useEffect(() => {
    setPageState(0);
  }, [debouncedSearch, sortKey, sortDir]);

  // Cancel stale RPC responses if the user types/pages quickly.
  const requestSeq = useRef(0);

  const fetchPage = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_members_overview", {
      _search: debouncedSearch || undefined,
      _limit: ADMIN_MEMBERS_PAGE_SIZE,
      _offset: page * ADMIN_MEMBERS_PAGE_SIZE,
      _sort_key: sortKey,
      _sort_dir: sortDir,
    });
    if (seq !== requestSeq.current) return; // stale
    if (error) {
      toast({
        title: "Failed to load members",
        description: error.message,
        variant: "destructive",
      });
      setMembers([]);
      setTotalCount(0);
    } else {
      const rows = (data ?? []) as RawRow[];
      setMembers(stripTotal(rows));
      setTotalCount(rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0);
    }
    setLoading(false);
  }, [debouncedSearch, page, sortKey, sortDir, toast]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    await fetchPage();
  }, [fetchPage]);

  const fetchAll = useCallback(async (): Promise<AdminMemberRow[]> => {
    // Page through the RPC in chunks so we always get the full filtered set
    // without depending on a magic upper-bound limit.
    const CHUNK = 500;
    const out: AdminMemberRow[] = [];
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const { data, error } = await supabase.rpc("get_admin_members_overview", {
        _search: debouncedSearch || undefined,
        _limit: CHUNK,
        _offset: offset,
        _sort_key: sortKey,
        _sort_dir: sortDir,
      });
      if (error) {
        toast({
          title: "Failed to export members",
          description: error.message,
          variant: "destructive",
        });
        return out;
      }
      const rows = (data ?? []) as RawRow[];
      if (rows.length === 0) break;
      total = Number(rows[0].total_count ?? rows.length);
      out.push(...stripTotal(rows));
      offset += rows.length;
      if (rows.length < CHUNK) break;
    }
    return out;
  }, [debouncedSearch, sortKey, sortDir, toast]);

  const searchMembers = useCallback(
    async (query: string, limit = 8): Promise<AdminMemberRow[]> => {
      const q = query.trim();
      if (!q) return [];
      const { data, error } = await supabase.rpc("get_admin_members_overview", {
        _search: q,
        _limit: limit,
        _offset: 0,
        _sort_key: "full_name",
        _sort_dir: "asc",
      });
      if (error) {
        toast({
          title: "Member search failed",
          description: error.message,
          variant: "destructive",
        });
        return [];
      }
      return stripTotal((data ?? []) as RawRow[]);
    },
    [toast],
  );

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(0, next));
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryState(q);
  }, []);

  const setSort = useCallback(
    (key: AdminMembersSortKey, dir?: AdminMembersSortDir) => {
      setSortKeyState(key);
      if (dir) {
        setSortDirState(dir);
      } else {
        // Toggle if same key, otherwise default to desc.
        setSortDirState((prev) =>
          key === sortKey ? (prev === "asc" ? "desc" : "asc") : "desc",
        );
      }
    },
    [sortKey],
  );

  const setDrawExempt = useCallback(
    async (userId: string, value: boolean) => {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, draw_exempt: value } : m)),
      );
      const { error } = await supabase
        .from("members")
        .update({ draw_exempt: value })
        .eq("user_id", userId);
      if (error) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, draw_exempt: !value } : m)),
        );
        toast({
          title: "Failed to update draw exempt flag",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast],
  );

  const setBillingExempt = useCallback(
    async (userId: string, value: boolean) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === userId
            ? { ...m, billing_exempt: value, status: value ? "active" : m.status }
            : m,
        ),
      );
      const { error } = await supabase
        .from("members")
        .update(value ? { billing_exempt: true, status: "active" } : { billing_exempt: false })
        .eq("user_id", userId);
      if (error) {
        await refresh();
        toast({
          title: "Failed to update billing exempt flag",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
    },
    [toast, refresh],
  );

  return (
    <AdminMembersContext.Provider
      value={{
        members,
        totalCount,
        loading,
        page,
        pageSize: ADMIN_MEMBERS_PAGE_SIZE,
        searchQuery,
        sortKey,
        sortDir,
        setPage,
        setSearchQuery,
        setSort,
        refresh,
        fetchAll,
        searchMembers,
        setDrawExempt,
        setBillingExempt,
      }}
    >
      {children}
    </AdminMembersContext.Provider>
  );
}

export function useAdminMembers() {
  const ctx = useContext(AdminMembersContext);
  if (!ctx) throw new Error("useAdminMembers must be used within AdminMembersProvider");
  return ctx;
}
