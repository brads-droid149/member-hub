ALTER TABLE public.past_winners ADD COLUMN IF NOT EXISTS draw_date date;
UPDATE public.past_winners SET draw_date = won_at::date WHERE draw_date IS NULL AND won_at IS NOT NULL;
ALTER TABLE public.past_winners DROP COLUMN IF EXISTS won_at;