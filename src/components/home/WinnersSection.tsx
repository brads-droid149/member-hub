import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Winner = Tables<"past_winners">;

interface WinnersSectionProps {
  winners: Winner[] | null;
  setWinners: (w: Winner[]) => void;
}

export function WinnersSection({ winners, setWinners }: WinnersSectionProps) {
  useEffect(() => {
    if (winners === null) {
      (async () => {
        const { data } = await supabase
          .from("past_winners")
          .select("*")
          .order("draw_date", { ascending: false, nullsFirst: false });
        setWinners(data ?? []);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = winners === null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Past Winners
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Every member who has won a Junkyard Surf Club giveaway.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : winners && winners.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {winners.map((w) => (
                <li
                  key={w.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm">{w.winner_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.prize_title}
                      {w.state ? ` · ${w.state}` : ""}
                    </p>
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
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-12">No winners yet</p>
      )}
    </section>
  );
}
