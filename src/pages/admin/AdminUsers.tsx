import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UserProfile {
  user_id: string;
  full_name: string | null;
  created_at: string;
  email?: string;
  member_status?: string;
  entries?: number;
  months_active?: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: members } = await supabase.from("members").select("*");
      
      if (profiles) {
        const merged = profiles.map(p => {
          const member = members?.find(m => m.user_id === p.user_id);
          return {
            user_id: p.user_id,
            full_name: p.full_name,
            created_at: p.created_at,
            member_status: member?.status || "no membership",
            entries: member?.entries || 0,
            months_active: member?.months_active || 0,
          };
        });
        setUsers(merged);
      }
    };
    fetchUsers();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold text-foreground">All Users</h2>
      <p className="text-sm text-muted-foreground">{users.length} registered users</p>

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.user_id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-foreground">{u.full_name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(u.created_at).toLocaleDateString()} · {u.months_active} months · {u.entries} entries
                </p>
              </div>
              <Badge variant={u.member_status === "active" ? "default" : "secondary"}>
                {u.member_status}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>}
      </div>
    </div>
  );
}
