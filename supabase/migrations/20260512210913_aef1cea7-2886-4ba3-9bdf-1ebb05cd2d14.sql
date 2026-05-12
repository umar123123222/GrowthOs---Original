
-- ============ RESOURCES FEATURE ============

-- Helper: is current auth user an active student
CREATE OR REPLACE FUNCTION public.lms_status_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = _user_id AND lms_status = 'active'
  );
$$;

-- ===== resource_sections =====
CREATE TABLE public.resource_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_sections ENABLE ROW LEVEL SECURITY;

-- ===== resources =====
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.resource_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_type text NOT NULL CHECK (content_type IN ('link','file','rich_text','table')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resources_section ON public.resources(section_id);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- ===== resource_audiences =====
CREATE TABLE public.resource_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  audience_type text NOT NULL CHECK (audience_type IN ('all','pathway','course','batch')),
  target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ( (audience_type = 'all' AND target_id IS NULL) OR (audience_type <> 'all' AND target_id IS NOT NULL) )
);

CREATE INDEX idx_resource_audiences_resource ON public.resource_audiences(resource_id);
CREATE INDEX idx_resource_audiences_lookup ON public.resource_audiences(audience_type, target_id);
ALTER TABLE public.resource_audiences ENABLE ROW LEVEL SECURITY;

-- Visibility helper
CREATE OR REPLACE FUNCTION public.user_can_see_resource(_user_id uuid, _resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resources r
    JOIN public.resource_sections s ON s.id = r.section_id
    WHERE r.id = _resource_id
      AND r.is_active = true
      AND s.is_active = true
      AND public.lms_status_active(_user_id) = true
      AND EXISTS (
        SELECT 1 FROM public.resource_audiences ra
        WHERE ra.resource_id = r.id
          AND (
            ra.audience_type = 'all'
            OR (ra.audience_type = 'pathway' AND EXISTS (
                  SELECT 1 FROM public.course_enrollments ce
                  JOIN public.students st ON st.id = ce.student_id
                  WHERE st.user_id = _user_id AND ce.pathway_id = ra.target_id
                ))
            OR (ra.audience_type = 'course' AND EXISTS (
                  SELECT 1 FROM public.course_enrollments ce
                  JOIN public.students st ON st.id = ce.student_id
                  WHERE st.user_id = _user_id AND ce.course_id = ra.target_id
                ))
            OR (ra.audience_type = 'batch' AND EXISTS (
                  SELECT 1 FROM public.course_enrollments ce
                  JOIN public.students st ON st.id = ce.student_id
                  WHERE st.user_id = _user_id AND ce.batch_id = ra.target_id
                ))
          )
      )
  );
$$;

-- ===== RLS: resource_sections =====
CREATE POLICY "Admins manage sections"
ON public.resource_sections FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin']))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin','superadmin']));

CREATE POLICY "Staff view sections"
ON public.resource_sections FOR SELECT
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin','mentor','enrollment_manager','support_member']));

CREATE POLICY "Active students view visible sections"
ON public.resource_sections FOR SELECT
USING (
  is_active = true
  AND public.lms_status_active(auth.uid()) = true
  AND EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.section_id = resource_sections.id
      AND public.user_can_see_resource(auth.uid(), r.id)
  )
);

-- ===== RLS: resources =====
CREATE POLICY "Admins manage resources"
ON public.resources FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin']))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin','superadmin']));

CREATE POLICY "Staff view resources"
ON public.resources FOR SELECT
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin','mentor','enrollment_manager','support_member']));

CREATE POLICY "Active students view targeted resources"
ON public.resources FOR SELECT
USING ( public.user_can_see_resource(auth.uid(), id) );

-- ===== RLS: resource_audiences =====
CREATE POLICY "Admins manage audiences"
ON public.resource_audiences FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin']))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin','superadmin']));

CREATE POLICY "Staff view audiences"
ON public.resource_audiences FOR SELECT
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin','mentor','enrollment_manager','support_member']));

CREATE POLICY "Active students view audiences for visible resources"
ON public.resource_audiences FOR SELECT
USING ( public.user_can_see_resource(auth.uid(), resource_id) );

-- updated_at triggers
CREATE TRIGGER trg_resource_sections_updated_at
BEFORE UPDATE ON public.resource_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Storage bucket =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: admins/superadmins manage; active students read files referenced by visible resources
CREATE POLICY "Admins manage resource files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'resources'
  AND get_current_user_role() = ANY (ARRAY['admin','superadmin'])
)
WITH CHECK (
  bucket_id = 'resources'
  AND get_current_user_role() = ANY (ARRAY['admin','superadmin'])
);

CREATE POLICY "Staff read resource files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resources'
  AND get_current_user_role() = ANY (ARRAY['admin','superadmin','mentor','enrollment_manager','support_member'])
);

CREATE POLICY "Active students read referenced resource files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resources'
  AND EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.content_type = 'file'
      AND r.content->>'storage_path' = storage.objects.name
      AND public.user_can_see_resource(auth.uid(), r.id)
  )
);
