DROP POLICY IF EXISTS "Public can read admin assets" ON storage.objects;

CREATE POLICY "Admins can list admin assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'admin-assets' AND public.has_role(auth.uid(), 'admin'));