import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Read-only partner preview for the (signed-out) login page.
 * Reads only the safe `partners_preview` view — discount_code is never exposed.
 * No auth context, no interactive/edit affordances.
 */
type PartnerPreview = {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
};

export function LoginPartnersPreview() {
  const [partners, setPartners] = useState<PartnerPreview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("partners_preview")
        .select("id, name, logo_url, description, website_url")
        .order("name");
      if (error) console.error("Failed to load partner previews:", error);
      if (!cancelled) setPartners((data as PartnerPreview[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (partners !== null && partners.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-display font-bold text-foreground">Partner Discounts</h2>
        <p className="text-sm text-muted-foreground mt-1">Join the club to unlock these codes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {partners === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <Skeleton className="w-full aspect-[16/9] rounded-md" />
                  <div className="w-full space-y-1.5">
                    <Skeleton className="h-4 w-2/3 mx-auto" />
                    <Skeleton className="h-3 w-1/2 mx-auto" />
                  </div>
                  <Skeleton className="h-7 w-32 rounded-md" />
                </CardContent>
              </Card>
            ))
          : partners.map((partner) => (
              <Card key={partner.id}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <div className="w-full aspect-[16/9] rounded-md bg-white border border-border flex items-center justify-center overflow-hidden">
                    {partner.logo_url ? (
                      <img
                        src={partner.logo_url}
                        alt={`${partner.name} logo`}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Logo</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{partner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {partner.description || "Member discount"}
                    </p>
                  </div>
                  <Link
                    to="/signup"
                    className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Join to unlock this code
                  </Link>
                </CardContent>
              </Card>
            ))}
      </div>
    </section>
  );
}
