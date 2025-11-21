# ReelyRated – Feature Audit Next Steps

## Current state recap
The SPA relies on Supabase auth + RLS: `AuthProvider` (src/components/AuthProvider.tsx) bootstraps the user/session independently and exposes both granular and legacy contexts, while the `/auth` page drives email/password, Google OAuth, and calls to custom RPCs such as `check_email_exists`. Most flows assume the `handle_new_user` trigger creates a row in `public.profiles`, so frontend calls often read/write the profile before checking `isAuthReady`.

Navigation centres on `Navbar.tsx` and `MobileMenu.tsx`, each embedding `NotificationsBell`. Notifications are fetched through `useNotifications` → `lib/notifications.ts`, which hits `public.notifications` directly plus the `create_notification` RPC defined in the migrations. Popover layering currently lives inside the header/mobile drawer, so z-index conflicts are easy to reproduce.

The feed (`src/pages/Feed.tsx`) queries `public.catches` with inline Supabase calls (now partially wrapped by `fetchList`). It enforces visibility on the client using `canViewCatch`, but still fetches all records allowed by RLS and applies filters locally; session-specific loads are unbounded. `CatchDetail.tsx` + `useCatchData.ts` re-query catches, comments, ratings, reactions, and follows directly, trusting RLS plus client-side guards such as `shouldShowExactLocation`.

Insights (`src/pages/Insights.tsx`) downloads all of a user’s catches and sessions once and then derives stats locally (aggregate helpers live under `src/lib/insights-*`). This avoids RPC complexity but means every new filter recomputes in the browser. Profile pages (`src/pages/Profile.tsx`) assemble stats with multiple SELECTs and let users follow/unfollow via direct table writes or the `follow_profile_with_rate_limit` RPC. Avatar uploads pipe straight to Supabase storage without explicit type/size validation.

Admin tooling (`AdminReports.tsx`, `AdminAuditLog.tsx`) accesses moderator RPCs (`admin_delete_*`, `admin_warn_user`, etc.) per ERD.md. The UI streams the entire `reports` table, keeps toasts optimistic, and reuses public components like the Navbar, so admin-only fetches compete with regular client code. Across the app we still have many bespoke Supabase calls, ad hoc toast handling, and only light reuse of the new `fetchList` helper.

## Prioritised recommendations

1. **Auth – rely on Supabase uniqueness errors, not `check_email_exists`** (Type: bug · Risk: medium)  
   **Impact:** Eliminates race conditions that allow duplicate sign-up submits to leak inconsistent errors; new users get clearer feedback.  
   **Scope:** `src/pages/Auth.tsx`, RPC `check_email_exists`, tables `auth.users` + `public.profiles`.  
   **Approach:** Remove or downgrade the RPC pre-check; instead, handle Postgres error codes (`23505`) returned from `supabase.auth.signUp` and translate them into the existing copy. Optionally keep the RPC as a best-effort hint but never rely on it for correctness.  
   **Dependencies:** Auth UI already uses `toast` patterns; change is isolated to the sign-up handler.

2. **Auth – gate Google/email forms until `isAuthReady`** (Type: UX · Risk: low)  
   **Impact:** Prevents the “Opening Google…” flash and avoids submitting forms before `AuthProvider` resolves, reducing confusing toasts.  
   **Scope:** `src/pages/Auth.tsx`, `useAuth()` from `AuthProvider`.  
   **Approach:** Pass `isAuthReady` into the page (currently only `user`/`loading` are read) and disable both the tabs and Google button until true. Add a lightweight skeleton or spinner for the entire card.  
   **Dependencies:** None; `AuthProvider` already exposes `isAuthReady`.

3. **Notifications popover layering and scroll behaviour** (Type: UX · Risk: low)  
   **Impact:** Fixes desktop clipping under the navbar and ensures the drawer bell on mobile renders above the sheet so users can interact with notifications anywhere.  
   **Scope:** `src/components/NotificationsBell.tsx` (PopoverContent), `src/components/Navbar.tsx`, `src/components/MobileMenu.tsx`, tables `public.notifications`.  
   **Approach:** Render `PopoverContent` through a portal with a higher z-index (`z-80+`), add `max-h` + `overflow-y-auto` to the list wrapper, and, on mobile, keep the bell outside the drawer or raise the popover layer beyond the sheet. No backend work required.  
   **Dependencies:** Shares the same component in both navbar + mobile menu; ensure both contexts are tested.

4. **Notification action guards (refresh/mark-all/clear-all)** (Type: bug · Risk: low)  
   **Impact:** Prevents duplicate RPCs on “Clear all” and provides user feedback if Supabase rejects the update, keeping UI + actual state in sync.  
   **Scope:** `src/hooks/useNotifications.ts`, `src/components/NotificationsBell.tsx`, helpers in `src/lib/notifications.ts`, table `public.notifications`.  
   **Approach:** Track in-flight state for each action, disable buttons accordingly, and surface errors from `clearAllNotifications` / `markAllNotificationsAsRead`. Consider returning success flags from helper functions instead of ignoring Supabase errors.  
   **Dependencies:** None; only touches notification-specific code.

5. **Feed session filter pagination + empty-state guard** (Type: perf/UX · Risk: medium)  
   **Impact:** Session-scoped feeds currently pull every catch for that session and block pagination, which is noticeable for prolific loggers. Bounded queries protect against stalls and keep the UI consistent.  
   **Scope:** `src/pages/Feed.tsx`, table `public.catches`, view `catch_comments` (already filtered).  
   **Approach:** When `sessionFilter` is set, still apply `.range(0, PAGE_SIZE-1)` and support “Load more” by keyset or offset (since catches are per session, offset is fine). Keep `hasMore` logic symmetrical.  
   **Dependencies:** Tied to `PAGE_SIZE` constant and the Load More button; ensure analytics relying on `catches.length` handle partial lists.

6. **Catch detail: hide soft-deleted catches proactively** (Type: security · Risk: medium)  
   **Impact:** `useCatchData` currently selects by ID without checking `deleted_at`, relying entirely on RLS. If a policy changes or admins soft-delete without revoking perms immediately, old links might leak data.  
   **Scope:** `src/hooks/useCatchData.ts`, tables `public.catches`, `catch_comments`, `catch_reactions`, `ratings`.  
   **Approach:** Add `.is("deleted_at", null)` to the catch query (and optionally to ratings/reactions), and short-circuit in the hook with a toast redirect if the record is gone. No SQL change required.  
   **Dependencies:** Admin tooling that restores catches should continue to work; ensure the hook lets admins view deleted content if necessary (maybe gated by `isAdminUser`, so treat admin visibility separately if required).

7. **Avatar upload validation** (Type: security/UX · Risk: medium)  
   **Impact:** Currently the avatar uploader trusts browser `accept` attributes; users can attempt multi-MB or non-image uploads that waste bandwidth before RLS rejects them.  
   **Scope:** `src/components/settings/ProfileAvatarSection.tsx`, Supabase storage bucket (avatars).  
   **Approach:** Add client-side checks for MIME type and file size (e.g. max 5 MB) before calling Supabase storage, show inline errors, and refuse to upload unsupported files.  
   **Dependencies:** Reuse existing toast patterns; no API change expected.

8. **Admin reports pagination + filters** (Type: perf/infra · Risk: medium-high)  
   **Impact:** `AdminReports.tsx` currently requests the entire `reports` table and listens to realtime inserts. As volume grows, this becomes slow and expensive.  
   **Scope:** `src/pages/AdminReports.tsx`, table `public.reports`, RPCs `admin_delete_*`, `admin_warn_user`.  
   **Approach:** Introduce server-side pagination (limit/offset or cursor on `created_at`) with lazy loading, and reuse the same query when refreshing after actions. Ensure the new queries still satisfy existing RLS (admins only).  
   **Dependencies:** Needs coordination with any future admin filters; do not change RPC signatures.

## “Avoid big refactors for now”
- **Centralise every Supabase call in a new data layer.** We recently added `src/lib/supabaseFetch.ts`, but converting all hooks/pages at once risks subtle behaviour regressions (filters, RLS assumptions, toast patterns). Continue migrating case-by-case after stronger test coverage.
- **Move Insights to server-calculated views.** Today all stats come from client-side aggregation of `catches`/`sessions`. Turning this into SQL views or RPCs touches analytics RLS and risks performance regressions without benchmarking.
- **Rewrite notifications via serverless functions.** The current combination of table queries + `create_notification` RPC already interacts with hardened logic (see migration 0021/0022). Large changes here should wait until we stabilise client UX and confirm admin flows still receive alerts.

## Suggested implementation order

**Phase 1 – Low-risk UX polish**  
1. Auth readiness gate (Recommendation #2).  
2. Notification layering/scroll (Recommendation #3).  
3. Notification action guards (Recommendation #4).

**Phase 2 – Low-risk functional bugs**  
1. Auth duplicate handling (Recommendation #1).  
2. Avatar upload validation (#7).  
3. Catch detail soft-delete guard (#6).

**Phase 3 – Medium perf improvements (client-only)**  
1. Feed session pagination (#5).  
2. Admin report pagination (#8) – start with read-only paging before touching moderation actions.

**Phase 4 – Higher-risk / backend-adjacent**  
1. Any future refactors to insights data sourcing or global Supabase fetch patterns (deferred per “avoid big refactors”).  
2. Potential follow-up SQL/RPC work after we stabilise the above (e.g. if auth uniqueness still causes issues).

Tackle each phase sequentially, validating with manual tests outlined in docs/feature-audit.md plus targeted scenarios (auth flows, notifications in mobile drawer, feed session filter, admin moderation actions) before moving on.
