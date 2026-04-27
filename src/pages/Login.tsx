import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Phone, ArrowLeft } from "lucide-react";
import {
  sendOtp,
  verifyOtp,
  isValidAuPhone,
  normalisePhone,
  TEST_PHONE,
  MOCK_OTP_CODE,
} from "@/lib/phone-auth";

type Step = "phone" | "code";

export default function Login() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalised = normalisePhone(phone);
    if (!isValidAuPhone(normalised)) {
      toast({
        title: "Invalid number",
        description: "Enter an Australian mobile starting with 04 (10 digits).",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    const { error } = await sendOtp(normalised);
    setLoading(false);
    if (error) {
      toast({ title: "Couldn't send code", description: error, variant: "destructive" });
      return;
    }
    setPhone(normalised);
    setStep("code");
    toast({
      title: "Code sent",
      description:
        normalised === TEST_PHONE
          ? `Test number — use code ${MOCK_OTP_CODE}.`
          : `Mock mode — use code ${MOCK_OTP_CODE}.`,
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await verifyOtp(phone, code);
    setLoading(false);
    if (!result.ok) {
      toast({ title: "Verification failed", description: result.error, variant: "destructive" });
      return;
    }
    if (result.isNewUser) {
      navigate(`/signup?phone=${encodeURIComponent(phone)}`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-display tracking-tight text-foreground">
            Junkyard Crew
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {step === "phone" ? "Sign in with your mobile" : `Enter the code sent to ${phone}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="0412 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9"
                    maxLength={14}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Australian mobile, starting with 04.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setCode("");
                  setStep("phone");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Use a different number
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
