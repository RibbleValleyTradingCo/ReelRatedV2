-- 0023_harden_search_path_and_leaderboard.sql
-- Addresses Supabase lints:
--   * function_search_path_mutable (adds explicit search_path for key functions)
--   * extension_in_public (moves citext into extensions schema)
--   * security_definer_view (recreates leaderboard view without SECURITY DEFINER)

--------------------------------------------------------------------------------
-- 1) Ensure citext lives outside the public schema
--------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION IF EXISTS citext
    SET SCHEMA extensions;

--------------------------------------------------------------------------------
-- 2) Add SET search_path for the flagged functions without changing logic/security
--------------------------------------------------------------------------------
DO $$
DECLARE
    target_names text[] := ARRAY[
        'update_updated_at',
        'update_updated_at_column',
        'set_normalized_location',
        'refresh_leaderboard',
        'enforce_catch_rate_limit',
        'enforce_comment_rate_limit',
        'enforce_report_rate_limit',
        'check_email_exists',
        'notify_admins',
        'check_rate_limit',
        'get_rate_limit_status',
        'user_rate_limits',
        'cleanup_rate_limits',
        'set_updated_at'
    ];
    rec record;
BEGIN
    FOR rec IN
        SELECT p.oid::regprocedure AS regproc
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = ANY (target_names)
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %s SET search_path = public, extensions, auth',
            rec.regproc
        );
    END LOOP;
END;
$$;

--------------------------------------------------------------------------------
-- 3) Recreate leaderboard_scores_detailed as a normal (security invoker) view
--------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.leaderboard_scores_detailed;

CREATE VIEW public.leaderboard_scores_detailed AS
SELECT
    c.id,
    c.user_id,
    p.username AS owner_username,
    c.title,
    COALESCE(c.species_slug, c.species) AS species_slug,
    c.species AS species,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.image_url,
    COALESCE(AVG(r.rating), 0)::numeric AS avg_rating,
    COUNT(r.id)::integer AS rating_count,
    (COALESCE(AVG(r.rating), 0)::numeric * 10 + COALESCE(c.weight, 0)::numeric) AS total_score,
    c.created_at,
    COALESCE(c.location_label, c.location) AS location_label,
    c.location AS location,
    COALESCE(c.method_tag, c.method) AS method_tag,
    c.method AS method,
    c.water_type_code,
    c.description,
    c.gallery_photos,
    c.tags,
    c.video_url,
    c.conditions,
    c.caught_at
FROM public.catches c
LEFT JOIN public.profiles p ON p.id = c.user_id
LEFT JOIN public.ratings r ON r.catch_id = c.id
WHERE c.deleted_at IS NULL
  AND c.visibility = 'public'
GROUP BY
    c.id,
    c.user_id,
    p.username,
    c.title,
    c.species_slug,
    c.species,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.image_url,
    c.created_at,
    c.location_label,
    c.location,
    c.method_tag,
    c.method,
    c.water_type_code,
    c.description,
    c.gallery_photos,
    c.tags,
    c.video_url,
    c.conditions,
    c.caught_at;

GRANT SELECT ON public.leaderboard_scores_detailed TO anon, authenticated;
