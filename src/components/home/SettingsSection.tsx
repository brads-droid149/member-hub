import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CreditCard, Settings as SettingsIcon, User, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const PHONE_RE = /^\+614\d{8}$/;

interface SettingsSectionProps {
  userId: string | null;
  initialFullName: string;
  initialPhone: string;
  initialState: string;
  onProfileSaved: (fullName: string) => void;
  openingPortal: boolean;
  onManageSubscription: () => void;
}

export function SettingsSection({
  userId,
  initialFullName,
  initialPhone,
  initialState,
  onProfileSaved,
  openingPortal,
  onManageSubscription,
}: SettingsSectionProps) {
  const { toast } = useToast();

  const [pFullName, setPFullName] = useState(initialFullName);
  const [pPhone, setPPhone] = useState(initialPhone);
  const [pState, setPState] = useState(initialState);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!pFullName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (pPhone && !PHONE_RE.test(pPhone.trim())) {
      toast({
        title: "Invalid mobile number",
        description: "Australian mobile format: +61 followed by 9 digits, e.g. +61412345678",
        variant: "destructive",
      });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: pFullName.trim(),
        phone: pPhone.trim() || null,
        state: pState || null,
      })
      .eq("user_id", userId);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Could not save profile", description: error.message, variant: "destructive" });
      return;
    }
    onProfileSaved(pFullName.trim());
    toast({ title: "Profile updated" });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Could not update password", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: "Password updated" });
  };

  return (
    <section className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          Membership Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription</p>
      </div>

      <Button
        variant="ghost"
        disabled={openingPortal}
        className="w-full justify-start border rounded-lg bg-card px-6 py-4 h-auto text-sm font-medium text-foreground hover:bg-accent/50"
        onClick={onManageSubscription}
      >
        <CreditCard className="h-5 w-5 text-primary mr-2" />
        {openingPortal ? "Opening…" : "Manage Your Subscription"}
      </Button>

      <Accordion type="single" collapsible className="space-y-4">
        <AccordionItem value="profile" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-5 w-5 text-primary" />
              Profile Settings
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={pFullName}
                  onChange={(e) => setPFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone"
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  placeholder="+61 412 345 678"
                  inputMode="tel"
                />
                <p className="text-xs text-muted-foreground">Australian format, starting with +61</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select value={pState} onValueChange={setPState}>
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="password" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-5 w-5 text-primary" />
              Change Password
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
