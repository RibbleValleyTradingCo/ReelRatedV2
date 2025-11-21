# ReelyRated – Launch Audit (Latest)

## 1. Overview
I re-reviewed the current ReelyRated repository (React + TypeScript frontend, Supabase backend with migrations/RLS, docs/ERD) to confirm launch readiness. The app is structured around feature areas—Auth/Onboarding, Feed & Catch detail, Profiles & Settings, Insights, Notifications, and Admin/Moderation. The architecture is stable, but several medium/high issues remain: duplicate-handling during sign-up, unbounded data queries for session feeds and admin reports, and inconsistent UX patterns.

## 2. Architecture Summary
- **Routing & layout**: Vite SPA with pages under `src/pages/**` (Auth, Feed, CatchDetail, Profile, Settings, Insights, AdminReports, AdminAuditLog, etc.). Global UI components include `Navbar`, `MobileMenu`, `NotificationsBell`, and `LoadingState`/`EmptyState`.
- **Data flow**: Frontend calls Supabase directly via `supabase.from(...).select/insert/update` or RPCs (`create_notification`, `follow_profile_with_rate_limit`, `admin_*`). Hooks like `useCatchData`, `useNotifications`, `useInsightsFilters` encapsulate some fetching, but most pages still invoke Supabase themselves. A general `fetchList` helper exists but is only used in Feed.
- **Auth state**: `AuthProvider` resolves the current user/session, exposing `user`, `session`, `loading`, `isAuthReady`, and `signOut`. Pages use `useAuth()`/`useAuthUser()` to redirect or gate UI. Supabase trigger `handle_new_user` is assumed to maintain `public.profiles`.
- **Security/RLS**: Tables include `visibility` and `deleted_at` columns per `ERD.md`. Migrations enforce RLS: standard users are restricted by `auth.uid()`, while admins operate via `admin_users` rows and SECURITY DEFINER RPCs. Client-side helpers like `canViewCatch` provide extra safeguards.
- **Notifications**: Stored in `public.notifications`. `useNotifications` fetches a limited list, subscribes via realtime, and exposes refresh/mark/clear actions. `NotificationsBell` renders the popover in both desktop and mobile.
- **Insights**: `src/pages/Insights.tsx` fetches all of a user’s catches/sessions and aggregates in the browser. No server-side analytics views exist yet.
- **Admin tools**: `AdminReports` and `AdminAuditLog` pages fetch tables directly and invoke RPCs (`admin_delete_catch`, `admin_warn_user`, etc.). RLS grants access via admin status.

## 3. Findings by Area

### Auth & Onboarding
1. **Sign-up duplicate handling still relies on `check_email_exists`**  
   - **Tag**: [bug], **Severity**: Medium, **Risk of fix**: Medium  
   - **Files**: `src/pages/Auth.tsx`, RPC `check_email_exists` (Supabase migrations)  
   - **Details**: The sign-up form calls `check_email_exists` before `supabase.auth.signUp`, but it doesn’t check for a `23505` duplicate error from Supabase. If two sign-up attempts happen simultaneously or the RPC fails, the user gets a generic error and the duplicate is handled only server-side.  
   - **Impact**: Inconsistent UX, extra server calls; potential confusion about whether the email is taken.  
   - **Recommendation**: Treat the RPC result as advisory. On `signUp` error, inspect `error.code` for `23505` and show “This email is already registered. Please sign in instead.”, ensuring the button is disabled while awaiting the response.

2. **Auth loading states rely on simple div instead of consistent components**  
   - **Tag**: [ux], **Severity**: Low, **Risk**: Low  
   - **Files**: `src/pages/Auth.tsx`  
   - **Details**: While `isAuthReady` gating is now in place, the fallback is still a plain “Loading your account…” block instead of the shared `LoadingState` component (the latter is used elsewhere).  
   - **Impact**: Minor visual inconsistency.  
   - **Recommendation**: Replace the custom loader with `LoadingState` for parity (optional).

### Navigation & Layout
1. **Mobile search button navigates behind the drawer**  
   - **Tag**: [ux], **Severity**: Medium, **Risk**: Low  
   - **Files**: `src/components/MobileMenu.tsx`, `src/components/Navbar.tsx`  
   - **Details**: When the hamburger drawer is open, tapping the “Search” item navigates to `/search` but leaves the drawer covering the UI until the user closes it manually.  
   - **Impact**: Confusing navigation flow on small screens.  
   - **Recommendation**: Close the drawer before navigation or disable the search button while the drawer is open.

### Feed & Catch Detail
1. **Session feed fetches entire result set**  
   - **Tag**: [perf], **Severity**: Medium, **Risk**: Medium  
   - **File**: `src/pages/Feed.tsx`  
   - **Details**: When `sessionFilter` is active, the query uses `.eq("session_id", sessionFilter)` but doesn’t apply `.range`, meaning the entire session’s catches load at once.  
   - **Impact**: Slow or blocked UI for large sessions.  
   - **Recommendation**: Apply `.range` even when filtered and reuse the existing pagination logic (hasMore/load more).  

2. **Profile catch list unbounded**  
   - **Tag**: [perf], **Severity**: Medium, **Risk**: Low  
   - **File**: `src/pages/Profile.tsx`  
   - **Details**: The profile page fetches all catches with `.order("created_at", { ascending: false })` and no limit.  
   - **Impact**: Large profiles can fetch hundreds of rows.  
   - **Recommendation**: Add limit/offset (or reuse feed card components with load more).

3. **CatchDetail still uses simple loading text**  
   - **Tag**: [ux], **Severity**: Low, **Risk**: Low  
   - **File**: `src/pages/CatchDetail.tsx`  
   - **Details**: The page shows “Loading...” text rather than the shared `LoadingState`.  
   - **Impact**: Minor but noticeable inconsistency.  
   - **Recommendation**: Switch to `LoadingState` for parity.

### Insights
1. **Client downloads all catches/sessions for analytics**  
   - **Tag**: [perf], **Severity**: Medium, **Risk**: Medium-High  
   - **Files**: `src/pages/Insights.tsx`, `src/lib/useInsightsChartData.ts`  
   - **Details**: Insights fetches all user catches and sessions and processes them locally. As data grows, this becomes slow and memory-heavy.  
   - **Impact**: Sluggish insights for long-time users.  
   - **Recommendation**: For launch, limit to a time range before fetching (e.g., last year). Post-launch, consider a dedicated summary RPC.

2. **“Last session” preset silently snaps back when no session**  
   - **Tag**: [ux], **Severity**: Low, **Risk**: Low  
   - **File**: `src/pages/Insights.tsx`  
   - **Details**: If “Last session” is chosen but no session exists, the page quietly resets to “All time”.  
   - **Impact**: Users might think nothing happened.  
   - **Recommendation**: Show a lightweight hint (“No sessions yet—showing all catches.”).

### Profiles & Settings
1. **Profile follower/following fetch sequential**  
   - **Tag**: [perf], **Severity**: Low, **Risk**: Low  
   - **File**: `src/pages/Profile.tsx`  
   - **Details**: Multiple Supabase calls (catches, followers, following) are sequential; could be parallelized.  
   - **Impact**: Slightly longer load times.  
   - **Recommendation**: Run Promise.all or restructure later (not critical).

2. **Loading indicators inconsistent across settings sections**  
   - **Tag**: [ux], **Severity**: Low, **Risk**: Low  
   - **Files**: `src/pages/ProfileSettings.tsx`  
   - **Details**: Some sections show spinners, others textual messages.  
   - **Impact**: Visual inconsistency.  
   - **Recommendation**: Standardize using `LoadingState`/skeletons.

### Notifications
1. **Popover may close on mobile scroll**  
   - **Tag**: [ux], **Severity**: Low-Medium, **Risk**: Low  
   - **Files**: `src/components/NotificationsBell.tsx`, `src/components/MobileMenu.tsx`  
   - **Details**: On some devices, scrolling the notifications popover inside the mobile drawer can cause it to close due to focus changes.  
   - **Impact**: Frustrating when clearing/marking notifications.  
   - **Recommendation**: Ensure popover uses `modal={false}`, prevent blur on scroll, and test on mobile.

### Admin Tools
1. **AdminReports fetches entire `reports` table**  
   - **Tag**: [perf], **Severity**: Medium, **Risk**: Medium  
   - **File**: `src/pages/AdminReports.tsx`  
   - **Details**: Selects all reports with no limit; realtime subscriber re-fetches entire dataset.  
   - **Impact**: Admin UI degrades quickly once reports accumulate.  
   - **Recommendation**: Add pagination or lazy loading (limit + offset, “Load more”).

2. **Admin action toasts fire even when RPC fails**  
   - **Tag**: [bug], **Severity**: Medium, **Risk**: Low  
   - **File**: `src/pages/AdminReports.tsx`  
   - **Details**: After calling `admin_delete_*` RPCs, the UI immediately shows “Content deleted” success toasts even if the RPC returns an error (the catch handler logs but doesn’t suppress success).  
   - **Impact**: Misleading feedback; admins may think an action succeeded when it didn’t.  
   - **Recommendation**: Only show the success toast once `error === null`; otherwise show `toast.error` with the RPC error message.

### General
1. **Inconsistent Supabase fetch/error patterns**  
   - **Tag**: [dx], **Severity**: Medium, **Risk**: Medium  
   - **Details**: Only Feed uses the new `fetchList` helper; other pages manually repeat Supabase/error/toast logic.  
   - **Impact**: Harder to maintain, inconsistent error UX.  
   - **Recommendation**: Post-launch, gradually adopt shared helpers per feature.

2. **Loading/empty-state UI inconsistent**  
   - **Tag**: [ux], **Severity**: Low, **Risk**: Low  
   - **Details**: Some pages show plain text (“Loading...”), others use `LoadingState`.  
   - **Impact**: Uneven polish.  
   - **Recommendation**: Standardize using shared components.

3. **No global error boundary**  
   - **Tag**: [security], **Severity**: Medium, **Risk**: Medium  
   - **Details**: Uncaught promise rejections or runtime errors may leave blank screens without fallback messaging.  
   - **Impact**: Bad UX and debugging difficulty.  
   - **Recommendation**: Add React error boundary (post-launch) with friendly fallback.

## 4. Phased Launch Plan

### Tier 1 – Must Fix Before Launch
- **T1-01: Sign-up duplicate handling**  
  - *Category*: [bug], *Severity*: High, *Risk*: Medium  
  - *Files*: `src/pages/Auth.tsx`  
  - *Actions*: Remove reliance on `check_email_exists`, inspect `supabase.auth.signUp` errors for `23505`, show the existing “email already registered” toast, and ensure submit button disables while awaiting response.

- **T1-02: Session feed pagination**  
  - *Category*: [perf], *Severity*: Medium-High, *Risk*: Medium  
  - *Files*: `src/pages/Feed.tsx`  
  - *Actions*: When `sessionFilter` is set, still apply `.range` and maintain `hasMore`/`nextCursor`; reuse “Load more” mechanics; confirm no regressions in default feed.

- **T1-03: Admin reports query limits**  
  - *Category*: [perf], *Severity*: Medium, *Risk*: Medium  
  - *Files*: `src/pages/AdminReports.tsx`  
  - *Actions*: Fetch reports with limit + pagination (or infinite scroll), ensure realtime updates respect pagination, and allow filtering by status/type if easy.

- **T1-04: Admin action toasts tied to RPC results**  
  - *Category*: [bug], *Severity*: Medium, *Risk*: Low  
  - *Files*: `src/pages/AdminReports.tsx`  
  - *Actions*: Show success toast only when RPC returns without error; otherwise display `toast.error`. Keep buttons disabled while calls are in flight.

### Tier 2 – Strongly Recommended Before Launch
- **T2-01: Mobile search interaction fix**  
  - *Category*: [ux], *Severity*: Medium, *Risk*: Low  
  - *Files*: `src/components/MobileMenu.tsx`, `src/components/Navbar.tsx`  
  - *Actions*: Close the drawer (or disable the button) before navigating to `/search`; ensure ARIA labels remain correct.

- **T2-02: Standardize loading/empty states**  
  - *Category*: [ux/dx], *Severity*: Medium, *Risk*: Low  
  - *Files*: Feed, CatchDetail, Profile, Insights, etc.  
  - *Actions*: Replace ad hoc `div>Loading...</div>` blocks with `LoadingState`; use `EmptyState` for zero data and consistent copy.

- **T2-03: Profile catches pagination**  
  - *Category*: [perf], *Severity*: Medium, *Risk*: Low  
  - *Files*: `src/pages/Profile.tsx`  
  - *Actions*: Introduce limit/offset for catches, show “Load more” button, and ensure stats stay in sync.

- **T2-04: Insights fetch scaling**  
  - *Category*: [perf], *Severity*: Medium, *Risk*: Medium-High  
  - *Files*: `src/pages/Insights.tsx`, `src/lib/useInsightsChartData.ts`  
  - *Actions*: Filter catches by date range before fetching (e.g., limit to the selected range), memoize derived data, and consider summary RPC post-launch.

- **T2-05: Notifications mobile scroll stability**  
  - *Category*: [ux], *Severity*: Low-Medium, *Risk*: Low  
  - *Files*: `src/components/NotificationsBell.tsx`, `src/components/MobileMenu.tsx`  
  - *Actions*: Ensure popover uses `modal={false}`, prevent outside pointer events from closing it prematurely, and test on actual devices.

### Tier 3 – Post-launch Improvements
- **T3-01: Shared Supabase fetch helper adoption**  
  - *Category*: [dx], *Severity*: Low, *Risk*: High  
  - *Files*: Many pages/hooks  
  - *Actions*: Gradually migrate repeated fetch logic to `fetchList` or new hooks, add tests, and ensure pagination/filter semantics stay intact.

- **T3-02: Server-side insights aggregation**  
  - *Category*: [perf], *Severity*: Medium, *Risk*: High  
  - *Files*: new SQL view/RPC, `src/pages/Insights.tsx`  
  - *Actions*: Design a summary RPC (per user/date range) and update the frontend to consume it, ensuring RLS covers aggregated data.

- **T3-03: Unified error/toast handling**  
  - *Category*: [dx], *Severity*: Low, *Risk*: Medium  
  - *Files*: `src/lib/logger.ts`, `src/components/ui/sonner.tsx`  
  - *Actions*: Provide utility functions for consistent success/error toasts and wrap Supabase error handling.

- **T3-04: Dedicated notifications page**  
  - *Category*: [ux], *Severity*: Low, *Risk*: Medium  
  - *Files*: new `/notifications` route, existing hooks  
  - *Actions*: Offer a full history view beyond the popover; reuse `useNotifications`.

## 5. High-risk Refactors to Avoid for Now
- **Immediate centralization of all Supabase fetches**: Touches most components, risks breaking pagination/filter logic. Roll out gradually post-launch with additional tests.  
- **Rewriting insights to SQL views/RPCs pre-launch**: Without extensive validation, moving client aggregation to SQL could introduce inaccuracies under RLS. Defer until stable.  
- **Replacing the notifications system wholesale**: After recent fixes (z-index, scrolling, action guards), rewriting the popover/drawer would require major UI/logic changes—too risky before launch.  
- **Modifying admin RPC contracts**: Admin workflows depend on current RPC signatures; changes would require synchronized backend/frontend updates and could disrupt moderation flows.
