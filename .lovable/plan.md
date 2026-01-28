
# Fix: Pathway Choice Point Flow

## Problem Summary
After completing the Nurturing Sessions course, students cannot choose between Freelancing and Ecommerce because the choice picker UI never appears. The system returns an error "Choice required" when they try to advance.

## Root Cause
The `has_pending_choice` flag only checks if the **current** course is a choice point. But after completing Step 1, the student's enrollment still points to Step 1 (Nurturing Sessions), which is NOT a choice point. The system needs to detect when the **next** step is a choice point.

## Solution
Modify the `advance_pathway` database function to handle the transition to choice points gracefully:

1. When next step is a choice point AND no selection provided:
   - Instead of returning an error, temporarily move the student to that step (pick the first choice option)
   - Return success but indicate the student needs to make a choice
   
2. Then `get_student_active_pathway` will correctly show `has_pending_choice = true` because the current course IS now a choice point

3. The UI will display the "Choose Your Path" picker, and the student can select their preferred track

## Implementation Steps

### Step 1: Update `advance_pathway` function
Modify the function to handle the choice point transition:

```text
Changes in the "next step is choice point" block:
- If p_selected_course_id IS NULL:
  - Update enrollment to point to the first course in the choice group
  - Return {success: true, awaiting_choice: true, choice_group: v_choice_group}
- If p_selected_course_id IS PROVIDED:
  - Record the choice selection (existing logic)
  - Update enrollment to the selected course
```

### Step 2: Update frontend to handle awaiting_choice response
In `src/hooks/useActivePathwayAccess.ts`:
- After `advancePathway` returns `awaiting_choice: true`, refresh the pathway state
- The new state will show `hasPendingChoice = true` and display the choice picker

In `src/pages/Videos.tsx`:
- When advance returns `awaiting_choice: true`, show a different toast: "Please select your learning path"

### Step 3: Test the complete flow
- Student completes Nurturing Sessions
- Clicks "Unlock Next Course"
- System moves them to choice point step
- "Choose Your Path" UI appears with Ecom 360 and Freelancing options
- Student clicks a choice → enrollment updates → next course unlocks

## Technical Details

### Database Migration
```sql
CREATE OR REPLACE FUNCTION advance_pathway(...)
-- Modified logic for choice point handling:
IF v_is_choice_point AND v_choice_group IS NOT NULL THEN
  IF p_selected_course_id IS NULL THEN
    -- Get first course in choice group
    SELECT course_id INTO v_next_course_id
    FROM pathway_courses
    WHERE pathway_id = p_pathway_id AND choice_group = v_choice_group
    LIMIT 1;
    
    -- Move enrollment to choice point
    UPDATE course_enrollments
    SET course_id = v_next_course_id, updated_at = NOW()
    WHERE id = v_enrollment_id;
    
    -- Return success with awaiting_choice flag
    RETURN jsonb_build_object(
      'success', true,
      'awaiting_choice', true,
      'choice_group', v_choice_group
    );
  END IF;
  -- ... rest of existing selection logic
END IF;
```

### Files to Modify
1. **New migration**: Update `advance_pathway` function
2. **src/hooks/useActivePathwayAccess.ts**: Handle `awaiting_choice` response
3. **src/pages/Videos.tsx**: Update toast message for choice transitions

## Expected Outcome
- Students completing Nurturing Sessions will see the choice picker
- They can select Ecommerce or Freelancing
- The selected course unlocks and becomes their new current course
- Pathway progression continues normally

## Rollback
If issues arise, the migration can be reverted. Students already at the choice point would need manual enrollment update.
