-- Chapter 5 of Client Acquisition Mastery had two lessons with NULL sequence_order,
-- causing wrong display order and broken unlock chain for individual course students.
UPDATE public.available_lessons
SET sequence_order = 18
WHERE id = '7377e81a-7812-4ff6-84b1-6d3b21c7da14'; -- Lead Generation System

UPDATE public.available_lessons
SET sequence_order = 19
WHERE id = '5c8f7994-03a1-423b-8602-280a30d86c07'; -- Meta Setup Done Right

-- Running Ads keeps sequence_order = 20 (already correct as last).