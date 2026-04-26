import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/use-admin";
import { Navigate } from "react-router-dom";
import AdminGiveaways from "./admin/AdminGiveaways";
import AdminPartners from "./admin/AdminPartners";

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
          <TabsTrigger value="giveaways">Giveaway Manager</TabsTrigger>
          <TabsTrigger value="partners">Partner Manager</TabsTrigger>
        </TabsList>
        <TabsContent value="giveaways" className="mt-6"><AdminGiveaways /></TabsContent>
        <TabsContent value="partners" className="mt-6"><AdminPartners /></TabsContent>
      </Tabs>
    </div>
  );
}
