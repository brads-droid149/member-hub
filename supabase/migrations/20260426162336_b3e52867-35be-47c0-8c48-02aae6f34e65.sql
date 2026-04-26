-- Public bucket for admin-managed assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-assets', 'admin-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Public can read admin assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin-assets');

-- Admins can manage
CREATE POLICY "Admins can upload admin assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'admin-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update admin assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'admin-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete admin assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'admin-assets' AND public.has_role(auth.uid(), 'admin'));