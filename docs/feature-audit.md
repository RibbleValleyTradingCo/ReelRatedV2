# ReelyRated Feature Audit

_Generated: $(date)_

This document summarises an end-to-end audit of the core user flows currently implemented in the ReelyRated application. Each feature section includes a short description of what the feature does, how to access it in the UI, and any issues spotted during manual and code-level inspection. Every finding is labelled with a severity hint so it can be triaged quickly.

> Legend: **[bug]** blocking behaviour or incorrect output · **[ux]** confusing flow or inconsistent copy · **[perf]** notable performance hit · **[security]** potential exposure · **[nice-to-have]** polish request.

---

## Auth & Onboarding

**What it does / access** – `/auth` route contains the email/password tabs plus “Continue with Google”. Signing in redirects to `/`, sign-up sends a verification email, and Google OAuth relies on Supabase redirect to `window.location.origin`.

### Findings

1. **[ux]** The Google button is shown even while `isAuthReady` is false which causes a flash of “Opening Google…” text on slow networks if the click happens before the auth state settles. Consider disabling the entire auth card until auth readiness is known or showing a loader.
2. **[bug]** After email/password sign-in we discard the `signInForm` state but do not reset errors. Subsequent navigation back to `/auth` shows stale validation copy. Clearing form state on success would fix this.
3. **[security]** Sign-up RPC check `check_email_exists` is not guarded against race conditions; two sign-up attempts can pass the check simultaneously and one will later fail. Prefer moving the uniqueness enforcement to the backend (unique constraint already exists, but catching the exception client-side would yield clearer copy).

---

## Navbar & Navigation

**What it does / access** – Persistent header with logo, search, notifications bell, avatar dropdown, and hamburger menu leading to the MobileMenu sheet.

### Findings

1. **[ux]** On sub-375px screens the search button still renders (it just hides via CSS). Because it toggles the `/search` route, tapping it inside the MobileMenu concurrently opens a new route behind the sheet. Disabling the trigger entirely while the sheet is open would avoid accidental navigation.
2. **[bug]** The avatar dropdown uses `onSelect` handlers but does not call `event.preventDefault()` for the “View profile” and “Profile settings” items; Radix still prevents default by default, yet Safari occasionally navigates twice. Wrap them in `<Link />` or ensure `event.preventDefault()` is consistently applied.

---

## Feed (/feed)

**What it does / access** – Infinite-scroll grid of public catches with species filter, scope switcher, and session filtering via query params.

### Findings

1. **[perf]** Feed loads every public catch up front when no session filter is applied (see `loadCatches` in `Feed.tsx`). For accounts with large histories this will request thousands of rows. Introduce server-side pagination directly and avoid client-only filtering.
2. **[ux]** When filters return zero catches the CTA “Log Your First Catch” is shown even for users who are not signed in (and tapping it opens `/add-catch` which then bounces them to `/auth`). Consider swapping copy to “Browse public catches” for guests.
3. **[bug]** Species filter with `customSpeciesFilter` allows any string including scripts. No XSS lands because we never dangerously set HTML, but we should sanitize or limit to alphanumeric to keep the UI consistent.

---

## Catch Detail (/catch/:id)

**What it does / access** – Shows a single catch with gallery, metadata, comments, reactions.

### Findings

1. **[bug]** Deleting a comment via admin RPC updates `deleted_at`, but the public catch page still renders the comment card because we only filter on the client (`CatchComments` fetch currently uses `.select(...).eq("catch_id", catchId)` without `is("deleted_at", null)`). Need to add that filter so soft-deleted comments do not appear.
2. **[ux]** When a non-owner taps the ellipsis to report a comment we immediately open a dialog even if they cannot view the owning profile. Consider gating on `canViewCatch` first to avoid double errors.

---

## Insights (/insights)

**What it does / access** – Analytics view with filters (date range, session, venue) and sections for highlights, catch trends, species/baits, techniques/venues. Recently simplified to mostly text leaderboards plus one line chart.

### Findings

1. **[bug]** Changing the date preset to “Last session” while there are zero sessions still shows “No catches recorded in last logged session yet.” but keeps the session dropdown disabled; user cannot revert to “All time” without refreshing. Auto-reset the preset to `all` when `latestSessionId` is null.
2. **[perf]** Species/bait/method leaderboards recompute `slice(0, 5)` on each render regardless of memoisation. Micro issue, but can wrap derived lists in `useMemo` to avoid repeated work when filters change quickly.
3. **[ux]** Time-of-day summary now always renders a paragraph even when there is no data (because we mark the card as `isEmpty={false}` to keep copy). To reinforce the empty state, keep `isEmpty={!showTimeOfDayChart}` and show the paragraph only when there is data.

---

## Notifications

**What it does / access** – Bell icon triggers a popover listing notifications and allows refresh, mark-all-read, and clear-all actions. Uses Supabase realtime subscription to push updates.

### Findings

1. **[bug]** Popover still closes immediately on mobile when the user scrolls the list – Radix treats scroll as blur because the trigger is focusable. Add `modal={false}` and stop propagation to keep it open during scroll.
2. **[security]** `clearAll` issues a blanket delete on `notifications` for the user but there is no optimistic UI guard; a double tap can fire multiple deletes concurrently, sometimes leaving the popover in a stale state. Consider disabling the button while the RPC is in-flight.

---

## Profile & Settings

**What it does / access** – `/profile/:id` displays a public profile with follow/unfollow and catch grid. `/settings/profile` allows editing username, bio, avatar, and email change flow.

### Findings

1. **[bug]** The profile page shows “Follow” even when the viewer is not logged in; clicking it opens `/auth` but we should render a disabled button to clarify the requirement.
2. **[ux]** Email change form uses separate `newEmail` / `confirmEmail` but does not trim before comparison, so trailing spaces trigger false mismatches. Apply `trim()` when comparing.
3. **[security]** Avatar uploads rely on PostgREST from the client with no file type restrictions beyond the browser accept attribute. Add client-side validation (max size, allowlist) to prevent accidental uploads of huge files.

---

## Admin (Reports, Audit Log, Moderation)

**What it does / access** – /admin routes provide report triage, moderation actions (delete/restore catch/comment, warn user), and audit log.

### Findings

1. **[bug]** Comment delete/restore buttons inside AdminReports still show a success toast even when the RPC throws (e.g. due to RLS). Need to surface error messages returned from `supabase.rpc("admin_delete_comment", …)` instead of always showing “Content removed”.
2. **[security]** Admin pages fetch `reports` without restricting to recent data. A malicious actor could flood reports and degrade the UI. Implement server-side pagination / filtering to mitigate.

---

## Mobile Menu & Drawer

**What it does / access** – Hamburger button opens a full-height sheet with navigation, create CTA, account section, and admin links.

### Findings

1. **[bug]** When the drawer is open, tapping the bell renders the popover behind the drawer (z-index). We need to render the bell outside the drawer or portal the popover to a higher layer (`z-[80]`).
2. **[ux]** Admin section header remains visible even when there are no admin links (because we only hide the list). Hide the entire section if `adminItems.length === 0`.

---

## General Observations

1. **[perf]** Many list components (feed, profile catches, venue catches) fetch entire datasets client-side and filter locally. Consider adding server-side pagination and only fetching the needed page.
2. **[security]** Client-side Supabase calls rarely wrap `try/catch`; errors go straight to console. Standardise toast-based error reporting to avoid silent failures.
3. **[nice-to-have]** Adopt a shared `LoadingState` component so every page uses consistent spinners/copy instead of bespoke implementations.

---

This document can be extended as new issues are discovered. Each bullet should eventually link to a GitHub issue or Trello/Jira ticket so we can track ownership and resolution.
