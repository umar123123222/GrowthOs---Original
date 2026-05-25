
CREATE POLICY "Viewers can read resource sections"
ON public.resource_sections FOR SELECT
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers can read resource audiences"
ON public.resource_audiences FOR SELECT
USING (public.get_my_role() = 'viewer');

CREATE POLICY "Viewers read resource files"
ON storage.objects FOR SELECT
USING (bucket_id = 'resources' AND public.get_my_role() = 'viewer');
