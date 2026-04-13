import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"partners">;

export default function Partners() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    supabase.from("partners").select("*").order("name").then(({ data }) => {
      if (data) setPartners(data);
    });
  }, []);

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    toast({ title: "Copied!", description: `${code} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Partners & Discounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exclusive discounts for active members. Click a code to copy.
        </p>
      </div>

      {partners.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {partners.map((partner) => (
            <Card
              key={partner.id}
              className="cursor-pointer hover:border-primary/40 transition-colors group"
              onClick={() => handleCopy(partner.discount_code, partner.id)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-lg font-display font-bold text-foreground">
                    {partner.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{partner.name}</p>
                  <p className="text-xs text-muted-foreground">{partner.description || "Member discount"}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 font-mono text-sm text-primary group-hover:bg-primary/10 transition-colors">
                  {copied === partner.id ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {partner.discount_code}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">No partner discounts available yet</p>
      )}
    </div>
  );
}
