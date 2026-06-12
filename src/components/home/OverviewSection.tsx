import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Giveaway = Tables<"giveaways">;
type Winner = Tables<"past_winners">;
type Banner = Tables<"banners">;

interface OverviewSectionProps {
  firstName: string;
  monthsLabel: string;
  entries: number;
  profileLoading: boolean;
  giveaway: Giveaway | null;
  giveawayLoaded: boolean;
  setGiveaway: (g: Giveaway | null) => void;
  setGiveawayLoaded: (b: boolean) => void;
  winners: Winner[] | null;
  setWinners: (w: Winner[]) => void;
  onSeeAllWinners: () => void;
}

export function OverviewSection({
  firstName,
  monthsLabel,
  entries,
  profileLoading,
  giveaway,
  giveawayLoaded,
  setGiveaway,
  setGiveawayLoaded,
  winners,
  setWinners,
  onSeeAllWinners,
}: OverviewSectionProps) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    if (!giveawayLoaded) {
      (async () => {
        const { data, error } = await supabase
          .from("giveaways")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (error) console.error("Failed to load giveaway:", error);
        setGiveaway(data ?? null);
        setGiveawayLoaded(true);
      })();
    }
    if (winners === null) {
      (async () => {
        const { data, error } = await supabase
          .from("past_winners")
          .select("*")
          .order("draw_date", { ascending: false, nullsFirst: false });
        if (error) console.error("Failed to load past winners:", error);
        setWinners(data ?? []);
      })();
    }
    (async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error("Failed to load banner:", error);
      setBanner(data ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const giveawayLoading = !giveawayLoaded;
  const winnersLoading = winners === null;

  return (
    <section className="space-y-8">
      {profileLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-2">{monthsLabel}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="lg:w-1/2">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Current Giveaway
            </CardTitle>
          </CardHeader>
          <CardContent>
            {giveawayLoading ? (
              <Skeleton className="w-full aspect-video rounded-lg" />
            ) : giveaway ? (
              <div className="space-y-4">
                <div className="max-w-sm mx-auto aspect-[4/5] w-full overflow-hidden rounded-lg">
                  {giveaway.prize_image_url ? (
                    <img src={giveaway.prize_image_url} alt={giveaway.title} className="object-cover object-center w-full h-full" loading="eager" fetchPriority="high" />
                  ) : (
                    <div className="w-full h-full bg-white flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">Prize image</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{giveaway.title}</h3>
                  {giveaway.draw_date && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      Draw:{" "}
                      {new Date(giveaway.draw_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No active giveaway right now</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:w-1/2">
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-col space-y-1.5 p-6 py-[15px]">
            <CardTitle className="text-lg font-display">Your Entries This Draw</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-center text-center space-y-6 py-0">
            {profileLoading ? (
              <>
                <Skeleton className="h-28 w-32 mx-auto" />
                <div className="space-y-1.5 max-w-xs mx-auto">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4 mx-auto" />
                </div>
              </>
            ) : (
              <>
                <p aria-label={`${entries} giveaway ${entries === 1 ? 'entry' : 'entries'}`} className="text-9xl font-display font-bold text-primary leading-none">{entries}</p>
                <div className="text-xs text-muted-foreground max-w-xs mx-auto space-y-0.5">
                  <p>You earn +1 entry every month you stay active.</p>
                  <p>Entries reset if you cancel or win.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-col space-y-1.5 p-6 py-[15px]">
            <CardTitle className="text-lg font-display">Past Winners</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {winnersLoading ? (
              <ul className="divide-y divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </li>
                ))}
              </ul>
            ) : winners && winners.length > 0 ? (
              <>
                <ul className="divide-y divide-border">
                  {winners.slice(0, 3).map((w) => (
                    <li key={w.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{w.winner_name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{w.prize_title}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {w.draw_date
                          ? new Date(w.draw_date).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  aria-label="See all past winners"
                  onClick={onSeeAllWinners}
                  className="mt-auto pt-4 text-sm font-medium text-primary hover:underline self-start"
                >
                  See All Winners
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No winners yet</p>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {banner && (
        banner.link_url ? (
          <a
            href={banner.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full hover:opacity-90 transition-opacity"
          >
            <img
              src={banner.image_url}
              alt="Promotional banner"
              className="w-full aspect-[16/5] object-cover object-center rounded-lg"
              loading="lazy"
            />
          </a>
        ) : (
          <img
            src={banner.image_url}
            alt="Promotional banner"
            className="w-full aspect-[16/5] object-cover object-center rounded-lg"
            loading="lazy"
          />
        )
      )}
    </section>
  );
}
