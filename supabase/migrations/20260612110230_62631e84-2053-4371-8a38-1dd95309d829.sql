CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert banners" ON public.banners
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banners" ON public.banners
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banners" ON public.banners
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Active members can view active banners" ON public.banners
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_active_subscription(auth.uid(), 'live')
      OR public.has_active_subscription(auth.uid(), 'sandbox')
    )
  );
