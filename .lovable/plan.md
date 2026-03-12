

# Group Recordings & Modules by Course

## Current State
Both pages show a flat list with a course filter dropdown. Items are not visually grouped by course.

## Plan

### Recordings Management (`RecordingsManagement.tsx`)
- When no specific course is selected (filter = "all"), group recordings by course with course name section headers
- Each course group gets a collapsible section with a header showing course title and recording count
- When a specific course is filtered, show only that course's recordings (no grouping needed, just a flat list under that course)
- Recordings with no course association go under a "No Course (Global)" group at the bottom

### Modules Management (`ModulesManagement.tsx`)
- Same approach: group modules by course with section headers when filter = "all"
- Each course group is a collapsible card/section showing course title and module count
- When a specific course is filtered, show flat list for that course only
- Modules with no `course_id` go under "Global" group

### Implementation Details

**Recordings page:**
- Add a `useMemo` that groups `filteredRecordings` by `recording.module?.course_id` into a `Map<string, Recording[]>`
- Render each group as a section with a styled course header (course title badge + count), followed by the existing sortable recording rows
- Drag-and-drop reordering stays within each course group

**Modules page:**
- Add a `useMemo` that groups `filteredModules` by `module.course_id` into a `Map<string, Module[]>`
- Render each group as a collapsible section with course header, containing the existing table rows
- Drag-and-drop reordering stays within each course group

### Files to Change
- `src/components/superadmin/RecordingsManagement.tsx` — add course grouping logic and grouped rendering
- `src/components/superadmin/ModulesManagement.tsx` — add course grouping logic and grouped rendering

