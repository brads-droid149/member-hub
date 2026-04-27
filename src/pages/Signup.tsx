import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { completeSignup, isValidAuPhone } from "@/lib/phone-auth";

export default function Signup() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // If someone lands here without a verified phone in the URL, send them
  // back to the login flow to verify first.
  useEffect(() => {
    if (!isValidAuPhone(phone)) {
      navigate("/login", { replace: true });
    }
  }, [phone, navigate]);

  if (!isValidAuPhone(phone)) {
    return <Navigate to="/login" replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Enter your name", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await completeSignup(phone, fullName.trim());
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Welcome to the Crew!" });
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display tracking-tight text-foreground">
            Join the Crew
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Verified {phone} — just one more step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating your account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
