CREATE OR REPLACE FUNCTION public.get_active_giveaway_preview()
RETURNS TABLE(title text, prize_image_url text, draw_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.title, g.prize_image_url, g.draw_date
  FROM public.giveaways g
  WHERE g.is_active = true
  ORDER BY g.created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_active_giveaway_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_giveaway_preview() TO anon, authenticated;