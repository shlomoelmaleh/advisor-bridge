

## Plan: Advisor Activity Log (Step 3.1)

### What
Create an `AdvisorActivityLog` component that aggregates recent events from existing DB tables (cases, matches, messages) and displays them as a timeline in the advisor dashboard.

### Implementation

**New file: `src/components/advisor/AdvisorActivityLog.tsx`**

- Component accepts `userId: string` prop
- `fetchEvents` function queries 3 sources:
  1. **Cases** (`cases` table) -- approved cases and rejected cases, filtered by `advisor_id`
  2. **Banker interest** (`matches` table with joins to `cases` and `branch_appetites`) -- where `banker_status='interested'` and `advisor_status='pending'`
  3. **Closed matches** (`matches` table with joins) -- where `status='closed'`
  4. **Unread messages** (`messages` table joined through matches) -- where `read_at IS NULL` and `sender_id != userId`
- Events sorted by time descending, limited to 15
- `isRecent` helper: within last 48 hours
- Auto-refresh every 30 seconds via `setInterval`
- Each event row shows: blue dot if new, formatted timestamp (he-IL), description text, action link button
- New events get `bg-blue-50 dark:bg-blue-950/20` background
- Empty state when no events
- Uses existing Card component wrapper with title "יומן פעילות אחרונה"

**Edit: `src/components/advisor/AdvisorDashboard.tsx`**

- Import `AdvisorActivityLog`
- Import `useAuth` to get `user` (already imported)
- Add `<AdvisorActivityLog userId={user.id} />` section after the cases Card (line ~267), wrapped in the activity log component

### No DB changes needed
All data comes from existing `cases`, `matches`, `branch_appetites`, and `messages` tables with existing RLS policies.

