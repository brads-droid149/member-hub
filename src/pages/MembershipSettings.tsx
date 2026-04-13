import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pause, XCircle, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockMember = {
  status: "active" as const,
  entries: 7,
  monthsActive: 7,
  pauseMonthsUsed: 0,
  maxPauseMonths: 3,
};

export default function MembershipSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState(mockMember.status);

  const handlePause = () => {
    setStatus("paused");
    toast({ title: "Membership paused", description: "You can resume anytime from this page." });
  };

  const handleCancel = () => {
    setStatus("cancelled");
    toast({ title: "Membership cancelled", description: "Your entries have been reset to zero.", variant: "destructive" });
  };

  const handleResume = () => {
    setStatus("active");
    toast({ title: "Welcome back!", description: "Your membership is active again." });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Membership Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription</p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">Current Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={
              status === "active"
                ? "bg-success/20 text-success border-success/30"
                : status === "paused"
                ? "bg-warning/20 text-warning border-warning/30"
                : "bg-destructive/20 text-destructive border-destructive/30"
            }>
              {status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {mockMember.monthsActive} months active · {mockMember.entries} entries
            </span>
          </div>
          {status !== "active" && (
            <Button size="sm" onClick={handleResume}>Resume</Button>
          )}
        </CardContent>
      </Card>

      {/* Pause */}
      {status === "active" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Pause className="h-5 w-5" /> Pause Membership
            </CardTitle>
            <CardDescription>
              Pause for up to {mockMember.maxPauseMonths} months. You've used {mockMember.pauseMonthsUsed} of {mockMember.maxPauseMonths}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handlePause}
              disabled={mockMember.pauseMonthsUsed >= mockMember.maxPauseMonths}
            >
              Pause Membership
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancel */}
      {status !== "cancelled" && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Cancel Membership
            </CardTitle>
            <CardDescription>
              This will permanently reset your entries to zero.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Cancel Membership</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your <strong>{mockMember.entries} entries</strong> will be permanently reset to zero. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Membership</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment Details
          </CardTitle>
          <CardDescription>
            Update your card or billing information via our secure payment portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            Manage Payment Method
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
