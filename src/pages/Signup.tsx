import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AU_STATES } from "@/lib/constants";


// Validates Australian mobile in +61 format: +61 followed by 4 and 8 more digits.
const isValidAuMobile = (val: string) => /^\+614\d{8}$/.test(val.replace(/\s+/g, ""));

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("+61");
  const [state, setState] = useState<string>("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isAustralianResident, setIsAustralianResident] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMobile = mobile.replace(/\s+/g, "");

    if (!fullName.trim()) {
      toast({ title: "Enter your full name", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (!isValidAuMobile(trimmedMobile)) {
      toast({
        title: "Invalid mobile",
        description: "Use +61 format, e.g. +61412345678",
        variant: "destructive",
      });
      return;
    }
    if (!state) {
      toast({ title: "Select your state", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: "You must agree to the Terms & Conditions and Privacy Policy", variant: "destructive" });
      return;
    }

    // Check for duplicate phone via SECURITY DEFINER RPC
    // (anon can't read other users' profiles directly under RLS).
    const { data: phoneTaken, error: phoneCheckError } = await supabase.rpc("phone_exists", {
      _phone: trimmedMobile,
    });
    if (phoneCheckError) {
      console.error("phone_exists check failed:", phoneCheckError);
    } else if (phoneTaken) {
      toast({ title: "Mobile number already registered", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/subscribe`,
        data: {
          full_name: fullName.trim(),
          phone: trimmedMobile,
          state,
          marketing_opt_in: marketingOptIn,
        },
      },
    });
    setLoading(false);

    if (error) {
      // Translate duplicate-key errors on phone to a friendly message
      const msg = error.message.toLowerCase();
      if (msg.includes("duplicate key") && msg.includes("phone")) {
        toast({ title: "Mobile number already registered", variant: "destructive" });
      } else {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      }
      return;
    }

    // Brevo sync happens on first Home load once the user has a confirmed
    // session — calling it here would 401 when email confirmation is on.

    if (data.session) {
      navigate("/subscribe");
    } else {
      navigate("/check-email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Helmet>
        <title>Join Junkyard Surf Club — Sign Up</title>
        <meta name="description" content="Sign up for Junkyard Surf Club and start earning monthly giveaway entries plus access to partner discounts across Australia." />
        <link rel="canonical" href="/signup" />
        <meta property="og:title" content="Join Junkyard Surf Club — Sign Up" />
        <meta property="og:description" content="Sign up to earn monthly giveaway entries and unlock partner discounts." />
        <meta property="og:url" content="/signup" />
        <meta property="og:type" content="website" />
      </Helmet>
      <h1 className="sr-only">Sign up for Junkyard Surf Club</h1>
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display tracking-tight text-foreground">
            Join the Club
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile (AU)</Label>
              <Input
                id="mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+61412345678"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Australian mobile format: +61 followed by 9 digits, e.g. +61412345678</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select value={state} onValueChange={setState}>
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

            {/* Required: Terms & Privacy */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
                I agree to the{" "}
                <a href="https://www.junkyardsurf.com.au/legal/club-terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a href="https://www.junkyardsurf.com.au/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </Label>
            </div>

            {/* Optional: Marketing */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="marketing"
                checked={marketingOptIn}
                onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="marketing" className="text-sm font-normal leading-relaxed cursor-pointer">
                I'd like to receive news, offers and updates from Junkyard Surf
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
