ALTER VIEW public.partners_preview SET (security_invoker = true);
REVOKE ALL ON public.partners_preview FROM PUBLIC;
REVOKE ALL ON public.partners_preview FROM anon;
GRANT SELECT ON public.partners_preview TO authenticated;