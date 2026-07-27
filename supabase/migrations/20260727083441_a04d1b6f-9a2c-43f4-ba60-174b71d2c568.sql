UPDATE public.available_lessons
SET sequence_order = 21
WHERE recording_title = 'CRM: Live Lead Tracking, Pipeline Management & Automation'
  AND module IN (SELECT m.id FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.title ILIKE 'chapter 6' AND c.title ILIKE '%Client Acquisition%');

UPDATE public.available_lessons
SET sequence_order = 22
WHERE recording_title = 'Never Lose a Lead Again with a CRM'
  AND module IN (SELECT m.id FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.title ILIKE 'chapter 6' AND c.title ILIKE '%Client Acquisition%');