-- Ensure rate limit RPCs exist with the signatures used by the frontend

DROP FUNCTION IF EXISTS public.create_comment_with_rate_limit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_report_with_rate_limit(public.report_target_type, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_report_with_rate_limit(public.report_target_type, UUID, TEXT);
DROP FUNCTION IF EXISTS public.react_to_catch_with_rate_limit(UUID, public.reaction_type);
DROP FUNCTION IF EXISTS public.react_to_catch_with_rate_limit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rate_catch_with_rate_limit(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.follow_profile_with_rate_limit(UUID);

CREATE OR REPLACE FUNCTION public.create_comment_with_rate_limit(
    p_catch_id UUID,
    p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_comment_id UUID;
    v_body TEXT := trim(both FROM coalesce(p_body, ''));
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_body = '' THEN
        RAISE EXCEPTION 'Comment body is required';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'comments', 20, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: comments – max 20 per hour';
    END IF;

    INSERT INTO public.catch_comments (catch_id, user_id, body)
    VALUES (p_catch_id, v_user_id, v_body)
    RETURNING id INTO v_comment_id;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'comments');

    RETURN v_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment_with_rate_limit(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_report_with_rate_limit(
    p_target_type public.report_target_type,
    p_target_id UUID,
    p_reason TEXT,
    p_details TEXT DEFAULT NULL
)
RETURNS public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_report public.reports%ROWTYPE;
    v_reason TEXT := trim(both FROM coalesce(p_reason, ''));
    v_details TEXT := NULLIF(trim(both FROM p_details), '');
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_reason = '' THEN
        RAISE EXCEPTION 'Report reason is required';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'reports', 5, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: reports – max 5 per hour';
    END IF;

    INSERT INTO public.reports (reporter_id, target_type, target_id, reason, details)
    VALUES (v_user_id, p_target_type, p_target_id, v_reason, v_details)
    RETURNING * INTO v_report;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'reports');

    RETURN v_report;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_report_with_rate_limit(public.report_target_type, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.react_to_catch_with_rate_limit(
    p_catch_id UUID,
    p_reaction TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reaction public.reaction_type := COALESCE(NULLIF(p_reaction, ''), 'like')::public.reaction_type;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'reactions', 50, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: reactions – max 50 per hour';
    END IF;

    INSERT INTO public.catch_reactions (catch_id, user_id, reaction)
    VALUES (p_catch_id, v_user_id, v_reaction);

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'reactions');

    RETURN TRUE;
EXCEPTION
    WHEN unique_violation THEN
        RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.react_to_catch_with_rate_limit(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.rate_catch_with_rate_limit(
    p_catch_id UUID,
    p_rating INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_rating_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 10 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 10';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'ratings', 50, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: ratings – max 50 per hour';
    END IF;

    INSERT INTO public.ratings (catch_id, user_id, rating)
    VALUES (p_catch_id, v_user_id, p_rating)
    ON CONFLICT (catch_id, user_id) DO UPDATE
        SET rating = EXCLUDED.rating
    RETURNING id INTO v_rating_id;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'ratings');

    RETURN v_rating_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_catch_with_rate_limit(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.follow_profile_with_rate_limit(
    p_following_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_follow_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF v_user_id = p_following_id THEN
        RAISE EXCEPTION 'Cannot follow yourself';
    END IF;

    IF NOT check_rate_limit(v_user_id, 'follows', 30, 60) THEN
        RAISE EXCEPTION 'RATE_LIMITED: follows – max 30 per hour';
    END IF;

    INSERT INTO public.profile_follows (follower_id, following_id)
    VALUES (v_user_id, p_following_id)
    RETURNING id INTO v_follow_id;

    INSERT INTO public.rate_limits (user_id, action)
    VALUES (v_user_id, 'follows');

    RETURN v_follow_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.follow_profile_with_rate_limit(UUID) TO authenticated;

GRANT INSERT ON public.rate_limits TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'rate_limits'
          AND policyname = 'Users can insert their rate limits'
    ) THEN
        CREATE POLICY "Users can insert their rate limits"
            ON public.rate_limits
            FOR INSERT
            TO authenticated
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

-- Summary: redeclare rate-limit RPCs with expected signatures and allow users to log rate limit attempts
