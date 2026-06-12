import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdminGiveaways from "./admin/AdminGiveaways";
import AdminPartners from "./admin/AdminPartners";
import AdminMembers from "./admin/AdminMembers";
import AdminBanners from "./admin/AdminBanners";
import { AdminMembersProvider } from "@/contexts/AdminMembersContext";

export default function Admin() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>

      <AdminMembersProvider>
        <Tabs defaultValue="giveaways">
          <TabsList>
            <TabsTrigger value="giveaways">Giveaway Manager</TabsTrigger>
            <TabsTrigger value="partners">Partner Manager</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <TabsContent value="giveaways" className="mt-6"><AdminGiveaways /></TabsContent>
          <TabsContent value="partners" className="mt-6"><AdminPartners /></TabsContent>
          <TabsContent value="members" className="mt-6"><AdminMembers /></TabsContent>
        </Tabs>
      </AdminMembersProvider>
    </div>
  );
}
