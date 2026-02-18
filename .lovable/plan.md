

## Add "Support Details" Page for Students

### Overview
Add a new "Support Details" menu item in the student sidebar that shows batch-specific links (WhatsApp group, Facebook community) and company contact details (WhatsApp number, email, phone). Admins/superadmins will configure batch-specific links via the batch creation/edit dialog.

### Changes Required

#### 1. Database Migration -- Add columns to `batches` table
Add two new nullable text columns:
- `whatsapp_group_link` (text, nullable)
- `facebook_community_link` (text, nullable)

#### 2. New Page: `src/pages/SupportDetails.tsx`
- Wrap in `RoleGuard` for student role
- Fetch the student's assigned batch via `course_enrollments` (where `batch_id` is set)
- Fetch batch record to get `whatsapp_group_link` and `facebook_community_link`
- Fetch `company_settings` for `secondary_phone` (WhatsApp), `company_email`, and `primary_phone`
- Display in a clean card layout:
  - **Your Group Links** section: WhatsApp Group button, Facebook Community button (show "Not configured" if no links set for batch)
  - **Contact Support** section: WhatsApp number, Email, Phone number with click-to-action links (tel:, mailto:, wa.me)
- If student has no batch assigned, show a friendly message that support details will be available once assigned

#### 3. Update Sidebar Navigation (`src/components/Layout.tsx`)
- Add a "Support Details" menu item visible only to students, linking to `/support-details`
- Use the `MessageCircle` or similar icon (already imported)

#### 4. Add Route (`src/App.tsx`)
- Lazy-load `SupportDetails` page
- Register route at `/support-details`

#### 5. Update Batch Dialog to include link fields
- In the batch creation/edit form (inside `src/components/batch/BatchManagement.tsx`), add two optional input fields:
  - "WhatsApp Group Link" (text input)
  - "Facebook Community Link" (text input)
- Save these values when creating/updating a batch

#### 6. Update Supabase Types
- Regenerate or manually add `whatsapp_group_link` and `facebook_community_link` to the `batches` type definition in `src/integrations/supabase/types.ts`

### Technical Notes
- The student's batch is determined from `course_enrollments.batch_id`
- Company contact info comes from `company_settings` (row id=1): `primary_phone`, `secondary_phone`, `company_email`
- The menu item is always visible; if no batch or no links configured, a friendly placeholder message is shown
