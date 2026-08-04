import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackPaywallClick } from "@/lib/analytics";
import type { Tables } from "@/integrations/supabase/types";

type Partner = Tables<"partners">;

// Free (non-member) users read `partners_preview`, a database-side view over a
// SECURITY DEFINER function that only ever selects the safe columns —
// discount_code is not in the payload at all, and a direct `partners` query
// from a free account returns zero rows under RLS.
type PartnerPreview = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
};

interface PartnersSectionProps {
  partners: Partner[] | null;
  setPartners: (p: Partner[]) => void;
  isMember: boolean;
}

export function PartnersSection({ partners, setPartners, isMember }: PartnersSectionProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  const [previews, setPreviews] = useState<PartnerPreview[] | null>(null);

  useEffect(() => {
    if (isMember) {
      if (partners === null) {
        (async () => {
          const { data, error } = await supabase.from("partners").select("*").order("name");
          if (error) console.error("Failed to load partners:", error);
          setPartners(data ?? []);
        })();
      }
      return;
    }
    if (previews === null) {
      (async () => {
        const { data, error } = await supabase
          .from("partners_preview")
          .select("id, name, logo_url, description, website_url")
          .order("name");
        if (error) console.error("Failed to load partner previews:", error);
        setPreviews((data as PartnerPreview[] | null) ?? []);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember]);

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

  const goToPaywall = (partnerName: string) => {
    trackPaywallClick("partner_card");
    navigate(`/subscribe?intent=discount&partner=${encodeURIComponent(partnerName)}`);
  };

  const rows: (Partner | PartnerPreview)[] | null = isMember ? partners : previews;
  const loading = rows === null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Partner Discounts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isMember
            ? "Exclusive discounts for active members. Click a code to copy."
            : "Join the club to unlock these codes."}
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
      ) : rows && rows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((partner) => {
            const code = (partner as Partner).discount_code;
            const activate = () =>
              isMember && code ? handleCopy(code, partner.id) : goToPaywall(partner.name);
            return (
              <Card
                key={partner.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:border-primary/40 transition-colors group"
                onClick={activate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activate();
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
                  {isMember && code ? (
                    <div className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 font-mono text-sm text-primary group-hover:bg-primary/10 transition-colors">
                      {copied === partner.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {code}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPaywall(partner.name);
                      }}
                      className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 text-xs font-medium text-primary group-hover:bg-primary/10 transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Unlock {partner.name} — join the club
                    </button>
                  )}
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
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">No partner discounts available right now</p>
      )}
    </section>
  );
}
