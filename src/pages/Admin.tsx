import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/use-admin";
import { Navigate } from "react-router-dom";
import AdminGiveaways from "./admin/AdminGiveaways";
import AdminWinners from "./admin/AdminWinners";
import AdminUsers from "./admin/AdminUsers";

export default function Admin() {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>

      <Tabs defaultValue="giveaways">
        <TabsList>
          <TabsTrigger value="giveaways">Giveaways</TabsTrigger>
          <TabsTrigger value="winners">Past Winners</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="giveaways"><AdminGiveaways /></TabsContent>
        <TabsContent value="winners"><AdminWinners /></TabsContent>
        <TabsContent value="users"><AdminUsers /></TabsContent>
      </Tabs>
    </div>
  );
}
