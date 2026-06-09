import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"partners">;

interface PartnersSectionProps {
  partners: Partner[] | null;
  setPartners: (p: Partner[]) => void;
}

export function PartnersSection({ partners, setPartners }: PartnersSectionProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (partners === null) {
      (async () => {
        const { data } = await supabase.from("partners").select("*").order("name");
        if (data) {
          setPartners(data);
        } else {
          setPartners([]);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      toast({ title: "Copied!", description: `${code} copied to clipboard` });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "Could not copy", description: "Please copy the code manually", variant: "destructive" });
    }
  };

  const loading = partners === null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Partner Discounts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Exclusive discounts for active members. Click a code to copy.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <Skeleton className="w-full aspect-[16/9] rounded-md" />
                <div className="w-full space-y-1.5">
                  <Skeleton className="h-4 w-2/3 mx-auto" />
                  <Skeleton className="h-3 w-1/2 mx-auto" />
                </div>
                <Skeleton className="h-7 w-24 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : partners && partners.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {partners.map((partner) => (
            <Card
              key={partner.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:border-primary/40 transition-colors group"
              onClick={() => handleCopy(partner.discount_code, partner.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCopy(partner.discount_code, partner.id);
                }
              }}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <div className="w-full aspect-[16/9] rounded-md bg-white border border-border flex items-center justify-center overflow-hidden">
                  {partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} className="w-full h-full object-contain p-2" loading="lazy" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Logo</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{partner.name}</p>
                  <p className="text-xs text-muted-foreground">{partner.description || "Member discount"}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 font-mono text-sm text-primary group-hover:bg-primary/10 transition-colors">
                  {copied === partner.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {partner.discount_code}
                </div>
                {partner.website_url && (
                  <a
                    href={partner.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary hover:underline"
                  >
                    Visit site
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">No partner discounts available yet</p>
      )}
    </section>
  );
}
