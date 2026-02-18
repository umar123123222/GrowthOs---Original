

## Enhance Mentor Sessions with Batch, Pathway/Course, and Unlock Info

### Goal
Each session card on the Mentor Sessions page will display:
1. **Batch name** -- which batch this session is for
2. **Pathway or Course name** -- the learning track associated with the session
3. **Unlocked content summary** -- how many recordings and assignments have been unlocked for students in that batch/course by now (based on drip schedule)

### Current State
- Sessions are fetched with `select('*')` from `success_sessions`, which already returns `batch_id`, `course_id`, and `pathway_id` columns
- However, batch name, course title, and pathway name are not resolved or displayed
- No unlock information is shown

### Implementation Steps

**1. Update the data fetching in `MentorSessions.tsx`**

- After fetching sessions, collect all unique `batch_id`, `course_id`, and `pathway_id` values
- Fetch batch names from `batches` table, course titles from `courses` table, and pathway names from `learning_pathways` table in parallel
- Build lookup maps for quick resolution

**2. Extend the `MentorSession` interface**

Add these fields:
- `batch_id`, `batch_name` (resolved from batches table)
- `course_id`, `course_title` (resolved from courses table)
- `pathway_id`, `pathway_name` (resolved from learning_pathways table, or derived via `pathway_courses` junction)

**3. Calculate unlocked content per session**

For each session's `course_id` + batch `start_date`:
- Query `available_lessons` for the course's modules to get all recordings with their `drip_days`
- Calculate which lessons are unlocked by comparing `batch.start_date + drip_days <= today`
- Count unlocked recordings and unlocked assignments (lessons that have an `assignment_id`)
- Display as "X/Y Recordings unlocked, Z Assignments unlocked"

**4. Update the SessionCard UI**

Add a new info section below the session title showing:
- **Batch badge**: e.g., "Batch: January 2026" or "No Batch"
- **Pathway/Course badge**: e.g., "Pathway: Ecommerce Mastery" or "Course: SEO Basics"
- **Unlock summary row**: e.g., "5/12 Recordings unlocked -- 3 Assignments available"

### Technical Details

**Data Flow:**
1. Fetch sessions (existing)
2. Extract unique IDs for batch, course, pathway
3. Parallel fetch: `batches`, `courses`, `learning_pathways`, `pathway_courses`, `available_lessons` (filtered by course modules)
4. For each session, calculate drip-based unlocks using `batch.start_date + lesson.drip_days <= today`
5. Render enriched cards

**Files Modified:**
- `src/components/mentor/MentorSessions.tsx` -- main changes to fetching, interface, and rendering

