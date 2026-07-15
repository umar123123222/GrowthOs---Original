# Per-Context Drip Overrides (Pathway / Course / Standalone)

## Goal

Let the same lesson drip on different days depending on the context it's consumed in:

- Pathway A → Course A → Lesson 1 = day 3
- Pathway B → Course A → Lesson 1 = day 12
- Course A (standalone / direct enrollment) → Lesson 1 = day 1

**Non-negotiable constraint:** every student already enrolled today (especially Pathway A cohorts) must keep the exact unlock dates they currently see. Zero visible change for existing enrollments.

---

## How it works today (baseline)

- `available_lessons.drip_days` — one integer per lesson, shared by every pathway/course/standalone enrollment.
- `success_sessions.drip_days` — same, one integer per session.
- Unlock functions compute: `anchor_date + drip_days` where anchor = batch `start_date` or `course_enrollments.enrolled_at`.
- Editing drip in any Content Timeline dialog overwrites the single global value → the bug you're solving.

## Target model

Add a **layered override** that resolves in this order (first hit wins):

1. `pathway_id + course_id + lesson_id` override
2. `course_id + lesson_id` override (standalone course context)
3. `available_lessons.drip_days` (existing column, becomes the fallback default)

Same three tiers for `success_sessions`.

---

## Data model changes

### New table: `lesson_drip_overrides`

```text
id              uuid pk
lesson_id       uuid → available_lessons.id (cascade)
pathway_id      uuid → learning_pathways.id (nullable)
course_id       uuid → courses.id (nullable)
drip_days       integer not null
created_at / updated_at
unique (lesson_id, pathway_id, course_id)   -- NULLs treated as distinct via partial indexes
```

Two partial unique indexes to enforce one row per context:
- `(lesson_id, pathway_id, course_id) where pathway_id is not null`
- `(lesson_id, course_id) where pathway_id is null and course_id is not null`

### New table: `session_drip_overrides`

Same shape but `session_id → success_sessions.id`.

### Existing columns

- `available_lessons.drip_days` — **kept as-is**, becomes the "no override" fallback. Never touched by the migration.
- `success_sessions.drip_days` — same.
- Nothing on `course_enrollments`, `students`, `batches`, `user_unlocks` changes.

### RLS + grants

Both tables: `authenticated` read; write restricted to admin/superadmin via `public.get_my_role()`. Service role full. Follows the project's `has_role` / `get_my_role` pattern.

---

## Existing-student protection (the critical part)

We do **not** touch `available_lessons.drip_days`, so students who resolve to the fallback keep their current schedule automatically.

For students currently enrolled through a pathway, we **freeze their view** by seeding overrides that mirror today's values:

**Backfill migration (data insert, one-time):**

```text
For every (pathway_id, course_id, lesson_id) that has at least one
ACTIVE course_enrollment today with enrollment_source = 'pathway':
  INSERT INTO lesson_drip_overrides (pathway_id, course_id, lesson_id, drip_days)
  VALUES (…, available_lessons.drip_days)   -- snapshot of current value
```

Same for sessions. Result: every active pathway cohort now has an explicit override row equal to today's global value → their computed unlock dates are byte-identical to before. Admins editing Pathway B's timeline later only writes to Pathway B's override rows; Pathway A's frozen rows stay untouched.

New pathway enrollments created *after* the migration also read from these override rows, so cohort A's future joiners inherit the same schedule.

---

## Unlock-function updates

Rewrite the drip-day resolution inside every function that references `al.drip_days` / `ss.drip_days` (list below) to use a `COALESCE` chain:

```text
effective_drip_days :=
  COALESCE(
    (SELECT drip_days FROM lesson_drip_overrides
       WHERE lesson_id = al.id
         AND pathway_id = v_pathway_id
         AND course_id  = v_course_id),
    (SELECT drip_days FROM lesson_drip_overrides
       WHERE lesson_id = al.id
         AND pathway_id IS NULL
         AND course_id  = v_course_id),
    al.drip_days,
    0
  )
```

`v_pathway_id` comes from `course_enrollments.pathway_id` on the row driving the unlock (already selected in these functions). `v_course_id` is the lesson's module → course.

Functions to update (found via grep on `al.drip_days` in `supabase/migrations/`):

- `get_sequential_unlock_status`
- `get_unlock_status_for_user`
- `get_recording_unlock_state` (and any variants — the latest migration wins)
- Any view/RPC returning drip metadata to the Content Schedule calendar

We update the **latest** definition of each; older migration files are historical and left alone.

Fallback `0` preserves today's behavior for lessons that were `NULL` before.

---

## UI changes

### Content Timeline dialog (`src/components/superadmin/ContentTimelineDialog.tsx`)

Currently writes `UPDATE available_lessons SET drip_days = …`. Change to context-aware writes:

- Opened from a **Pathway** row → upsert into `lesson_drip_overrides` with `(pathway_id, course_id, lesson_id)`.
- Opened from a **Course** row (standalone) → upsert with `(pathway_id = NULL, course_id, lesson_id)`.
- Opened from the **Recordings** page (global default editor) → keep writing `available_lessons.drip_days` as today (fallback default for future contexts).

Read path: the dialog fetches the same three tiers via one RPC (`get_effective_drip_days(pathway_id, course_id, lesson_ids[])`) so what admins see equals what students get.

Add a small badge next to each drip input: **"Pathway override"** / **"Course override"** / **"Default"** so admins know which tier they're editing. A "Reset to default" button deletes the override row.

### Success sessions timeline

Same treatment for `success_sessions.drip_days` → `session_drip_overrides`.

### Content Schedule calendar

Reads via the same RPC — no visual change for existing cohorts because the backfill produced identical values.

---

## Rollout order

1. **Migration 1 (schema):** create both override tables + grants + RLS + partial unique indexes.
2. **Migration 2 (data backfill):** snapshot current `drip_days` into overrides for every active pathway enrollment context (and standalone course context if the user wants standalone locked too — see open question).
3. **Migration 3 (functions):** rewrite unlock functions with the COALESCE resolver. Deploy together with backfill so nothing runs against the new schema before rows exist.
4. **Frontend:** context-aware writes in `ContentTimelineDialog` + badges + reset button.
5. **Verification:** snapshot `get_sequential_unlock_status` output for a sample of Pathway A students before and after → must be identical.

## Rollback

- Drop the two override tables and revert the three functions to their previous definitions. `available_lessons.drip_days` is untouched, so the system returns to today's behavior instantly. No student data is lost.

---

## Open questions before I build

1. **Standalone course context:** should the backfill also freeze standalone (non-pathway) enrollments by seeding `(pathway_id NULL, course_id, lesson_id)` overrides? Default plan: **yes**, freeze both, so no cohort shifts. Say the word if you want standalone to keep floating on the global default.
2. **Batch-level nuance:** batches currently share `start_date` across the cohort. Overrides above are per pathway/course, not per batch. Confirm you don't also need a per-batch tier — I don't think you do based on your example, but flagging it.
3. **Sessions parity:** apply the same override system to `success_sessions` (recommended, keeps calendar consistent). Confirm.

Answer these and I'll ship migrations + code in one pass.
