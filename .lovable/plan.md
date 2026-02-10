

## Live Sessions - Student View Fixes

Several issues in the student-facing Live Sessions page hurt the user experience. Here's what needs fixing:

### Issue 1: Missing Inactive LMS Banner
Students with suspended/inactive accounts see buttons saying "Locked - Payment Required" but get no explanation banner. The `InactiveLMSBanner` component already exists in the project but is not used on this page.

**Fix**: Import and render `InactiveLMSBanner` at the top of the page content when `userLMSStatus !== 'active'`.

### Issue 2: "Join Now" crashes on empty links
Upcoming sessions may not have a `link` set yet. Clicking "Join Now" with no link opens a blank tab or errors out.

**Fix**: Disable the "Join Now" button when `session.link` is empty/null, and show a tooltip or label like "Link not available yet".

### Issue 3: SessionCard defined inside render (performance)
`SessionCard` is declared inside the component body, causing it to be recreated on every render. This loses internal state and hurts performance.

**Fix**: Move `SessionCard` outside the `LiveSessions` component, passing the needed callbacks and state as props.

### Issue 4: Unused imports
`ExternalLink` and `Play` from lucide-react are imported but never used.

**Fix**: Remove them.

---

### Technical Summary

**File**: `src/pages/LiveSessions.tsx`

| Change | Lines affected |
|--------|---------------|
| Import + render `InactiveLMSBanner` | Top of file + inside JSX before sessions list |
| Guard "Join Now" against empty `session.link` | Lines 323-337 |
| Move `SessionCard` outside component | Lines 230-343 become a standalone component |
| Remove unused `ExternalLink`, `Play` imports | Line 15-16 |

