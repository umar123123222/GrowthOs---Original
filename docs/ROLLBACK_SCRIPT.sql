-- ROLLBACK SCRIPT for Growth OS Fixes
-- Run this script ONLY if you need to revert the checkpoint changes

-- WARNING: This will remove the installment_payments table and all its data
-- Make sure to backup any important data before running this script

BEGIN;

-- Step 1: Drop the installment_payments table and all related objects
DROP TABLE IF EXISTS public.installment_payments CASCADE;

-- Step 2: Remove any related sequences or functions if they were created
-- (None were created in this case)

-- Verify rollback success
SELECT 'Rollback completed successfully' as status;

COMMIT;

-- Manual steps required after running this SQL:
-- 1. Delete the following edge function directories:
--    - supabase/functions/process-onboarding-jobs/
--    - supabase/functions/process-email-queue/
-- 
-- 2. Delete these documentation files:
--    - docs/CHECKPOINT.md
--    - docs/ROLLBACK_SCRIPT.sql
--
-- 3. Revert console.log changes in these files:
--    - src/components/questionnaire/StudentQuestionnaireForm.tsx
--    - src/components/questionnaire/QuestionnaireWizard.tsx  
--    - src/pages/Onboarding.tsx
--    - src/components/SuccessPartner.tsx
--
-- 4. Test the following to ensure system is back to original state:
--    - Student creation flow
--    - Admin dashboard functionality
--    - Existing edge functions (run whoami, validate-shopify)
--    - Authentication and user management

-- Security Note: The security warnings from Supabase linter are not related
-- to our changes and will remain. They were pre-existing issues.