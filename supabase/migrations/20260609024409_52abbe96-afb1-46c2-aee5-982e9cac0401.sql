CREATE INDEX IF NOT EXISTS idx_past_winners_draw_date
  ON public.past_winners(draw_date DESC NULLS LAST);