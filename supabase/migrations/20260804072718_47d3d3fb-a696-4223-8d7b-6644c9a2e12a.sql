-- Giveaways: any signed-in user can view
DROP POLICY IF EXISTS "Active members can view giveaways" ON public.giveaways;
CREATE POLICY "Authenticated users can view giveaways"
ON public.giveaways FOR SELECT TO authenticated USING (true);

-- Past winners: any signed-in user can view
DROP POLICY IF EXISTS "Active members can view winners" ON public.past_winners;
CREATE POLICY "Authenticated users can view winners"
ON public.past_winners FOR SELECT TO authenticated USING (true);

-- Banners: any signed-in user can view active banners
DROP POLICY IF EXISTS "Active members can view active banners" ON public.banners;
CREATE POLICY "Authenticated users can view active banners"
ON public.banners FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

-- Partner preview: safe columns only, no discount_code
CREATE OR REPLACE FUNCTION public.get_partners_preview()
RETURNS TABLE(id uuid, name text, logo_url text, description text, website_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.logo_url, p.description, p.website_url
  FROM public.partners p
  ORDER BY p.name
$$;

REVOKE ALL ON FUNCTION public.get_partners_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partners_preview() TO authenticated;

CREATE OR REPLACE VIEW public.partners_preview AS
  SELECT id, name, logo_url, description, website_url
  FROM public.get_partners_preview();

REVOKE ALL ON public.partners_preview FROM PUBLIC;
GRANT SELECT ON public.partners_preview TO authenticated;