CREATE POLICY "Admins can read private assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'private-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can upload private assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'private-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update private assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'private-assets' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'private-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete private assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'private-assets' AND has_role(auth.uid(), 'admin'::app_role));