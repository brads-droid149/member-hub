import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AdminMemberRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  entries: number;
  months_active: number;
  joined_at: string;
};

type Ctx = {
  members: AdminMemberRow[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const AdminMembersContext = createContext<Ctx | null>(null);

export function AdminMembersProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_members_overview");
    if (error) {
      toast({ title: "Failed to load members", description: error.message, variant: "destructive" });
    } else if (data) {
      setMembers(data as AdminMemberRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AdminMembersContext.Provider value={{ members, loading, refresh }}>
      {children}
    </AdminMembersContext.Provider>
  );
}

export function useAdminMembers() {
  const ctx = useContext(AdminMembersContext);
  if (!ctx) throw new Error("useAdminMembers must be used within AdminMembersProvider");
  return ctx;
}
