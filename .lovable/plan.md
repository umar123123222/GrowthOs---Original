## Resources Feature

A new "Resources" page where admins/superadmins publish curated content (links, files, notes, tables) grouped into named sections, targeted to students by pathway, course, batch, or "all active students."

### Data model

**`resource_sections`**
- name, description, icon, display_order, is_active
- created_by

**`resources`** (belongs to a section)
- section_id, title, description, display_order, is_active
- `content_type`: `link` | `file` | `rich_text` | `table`
- `content`: jsonb — shape depends on type:
  - link: `{ url, open_in_new_tab }`
  - file: `{ storage_path, file_name, mime_type, size }`
  - rich_text: `{ html }` (sanitized with DOMPurify on render)
  - table: `{ columns: [{key,label}], rows: [{...}] }`

**`resource_audiences`** (one resource → many rules; OR-combined; if `all_students=true` exists, it wins)
- resource_id
- `audience_type`: `all` | `pathway` | `course` | `batch`
- `target_id` uuid (nullable when type=`all`)

**Storage bucket**: `resources` (private) — files served via signed URLs from a small edge function or Supabase signed URL API.

### Visibility logic (student page)

Show a resource if:
1. Student's `lms_status = 'active'` AND
2. The resource's section is active AND resource is active AND
3. Any audience rule matches:
   - type `all`, OR
   - type `pathway` and student has matching `course_enrollments.pathway_id`, OR
   - type `course` and student has matching `course_enrollments.course_id`, OR
   - type `batch` and student has matching `course_enrollments.batch_id`

Implemented as a SQL helper `public.user_can_see_resource(_user, _resource)` used in RLS for `resources` and inferred for `resource_sections` (a section is visible if it has ≥1 visible resource).

### RLS

- `resource_sections`, `resources`, `resource_audiences`:
  - Admin/superadmin: full manage
  - Students: SELECT only when `lms_status='active'` and visibility rule matches
  - Mentor/enrollment_manager/support_member: SELECT all (read-only)
- Storage `resources` bucket: admin/superadmin manage; students read only when they can see the parent resource.

### Admin UI

New tab inside `StudentsManagement` (or a new top-level admin page) — **"Resources"**:
- Sections list with drag-reorder, add/edit/delete
- Inside a section: add/edit/delete resources
- Resource editor:
  - Title, description, type picker
  - Type-specific editor:
    - link: URL input
    - file: drag-drop upload to `resources` bucket
    - rich_text: simple textarea + minimal formatting (or textarea with markdown for v1)
    - table: dynamic columns + rows grid
  - Audience builder: pill list — add rules (`All students`, `Pathway: X`, `Course: Y`, `Batch: Z`); OR-combined
- All inputs validated with zod (length limits, URL/email shape).

### Student UI

New route `/resources` (added to student sidebar, gated to `lms_status='active'` via existing `RoleGuard` + active check):
- Sections rendered as accordion/cards
- Resources rendered by type:
  - link → button opening URL in new tab
  - file → download button (signed URL)
  - rich_text → sanitized HTML
  - table → responsive shadcn `<Table>`
- Empty state when no resources match.

### Files

New:
- `supabase/migrations/<ts>_resources.sql` — tables, RLS, helper fn, storage bucket + policies
- `src/pages/admin/ResourcesManagement.tsx`
- `src/components/resources/SectionEditor.tsx`
- `src/components/resources/ResourceEditor.tsx`
- `src/components/resources/AudienceBuilder.tsx`
- `src/components/resources/ResourceContentEditors/{LinkEditor,FileEditor,RichTextEditor,TableEditor}.tsx`
- `src/pages/Resources.tsx` (student-facing)
- `src/components/resources/ResourceRenderer.tsx`
- `src/hooks/useResources.ts`

Modified:
- `src/App.tsx` — add `/resources` route + admin route
- Admin sidebar + student sidebar — add nav entry
- `src/pages/StudentsManagement.tsx` — link/tab to Resources management (or top-level admin nav)

### Suggestions / opinions

- Keep v1 rich text as **markdown** (rendered with `react-markdown`) — safer than HTML and good enough for notes. Upgrade to a WYSIWYG later if needed.
- Add a per-resource `published_at` field so admins can draft before exposing — useful but optional; I'll include `is_active` only unless you want drafts.
- Consider a future `resource_views` table for analytics ("who opened this PDF") — out of scope for v1.
- Audience is **OR** (any matching rule shows it). True AND combinations (e.g., "Pathway X AND Batch Y") add UI complexity for marginal value; if you need it, say so and I'll switch to rule-groups.

Confirm and I'll build it.
