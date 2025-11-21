import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

type CustomFields = {
  species?: string;
  method?: string;
};

type CatchConditions = {
  customFields?: CustomFields;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  };
  weather?: string;
  airTemp?: number;
  waterClarity?: string;
  windDirection?: string;
  [key: string]: unknown;
} | null;

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

export interface CatchData {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  location_label: string | null;
  species_slug: string | null;
  custom_species: string | null;
  weight: number | null;
  weight_unit: string | null;
  length: number | null;
  length_unit: string | null;
  water_type_code: string | null;
  method_tag: string | null;
  peg_or_swim: string | null;
  time_of_day: string | null;
  bait_used: string | null;
  equipment_used: string | null;
  caught_at: string | null;
  conditions: CatchConditions;
  tags: string[] | null;
  gallery_photos: string[] | null;
  video_url: string | null;
  visibility: VisibilityType | null;
  hide_exact_spot: boolean | null;
  allow_ratings: boolean | null;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  };
  session: {
    id: string;
    title: string | null;
    venue_name_manual: string | null;
    date: string | null;
  } | null;
}

export interface Rating {
  rating: number;
  user_id: string;
  profiles: {
    username: string;
  } | null;
}

interface UseCatchDataParams {
  catchId: string | undefined;
  userId: string | undefined;
}

export const useCatchData = ({ catchId, userId }: UseCatchDataParams) => {
  const navigate = useNavigate();
  const [catchData, setCatchData] = useState<CatchData | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [hasRated, setHasRated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reactionCount, setReactionCount] = useState(0);
  const [userHasReacted, setUserHasReacted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);

  const fetchCatchData = useCallback(async () => {
    if (!catchId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("catches")
      .select("*, profiles:user_id (username, avatar_path, avatar_url), session:session_id (id, title, venue_name_manual, date)")
      .eq("id", catchId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      toast.error("Failed to load catch");
      navigate("/feed");
    } else {
      if (!data) {
        setCatchData(null);
        setIsUnavailable(true);
        setIsLoading(false);
        return;
      }
      setCatchData(data as CatchData);
      setIsUnavailable(false);
    }
    setIsLoading(false);
  }, [catchId, navigate]);

  const fetchRatings = useCallback(async () => {
    if (!catchId) return;
    const { data, error } = await supabase
      .from("ratings")
      .select("rating, user_id, profiles:user_id (username)")
      .eq("catch_id", catchId);

    if (!error && data) {
      const ratingsData = data as Rating[];
      setRatings(ratingsData);
      if (userId) {
        const userRatingExists = ratingsData.some(
          (ratingRow) => ratingRow.user_id === userId
        );
        setHasRated(userRatingExists);
      } else {
        setHasRated(false);
      }
    }
  }, [catchId, userId]);

  const fetchReactions = useCallback(async () => {
    if (!catchId) return;
    const { data, error } = await supabase
      .from("catch_reactions")
      .select("user_id")
      .eq("catch_id", catchId);

    if (error) {
      logger.error("Failed to load reactions", error, { catchId });
      return;
    }

    const reactions = data ?? [];
    setReactionCount(reactions.length);
    if (userId) {
      setUserHasReacted(reactions.some((row) => row.user_id === userId));
    } else {
      setUserHasReacted(false);
    }
  }, [catchId, userId]);

  const checkFollowStatus = useCallback(async () => {
    const ownerId = catchData?.user_id;
    if (!userId || !ownerId || userId === ownerId) {
      setIsFollowing(false);
      setFollowStatusLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from("profile_follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("following_id", ownerId)
      .maybeSingle();

    if (error) {
      logger.error("Failed to check following status", error, { ownerId, userId });
      setFollowStatusLoaded(true);
      return;
    }
    setIsFollowing(!!data);
    setFollowStatusLoaded(true);
  }, [catchData?.user_id, userId]);

  useEffect(() => {
    void fetchCatchData();
  }, [fetchCatchData]);

  useEffect(() => {
    void fetchRatings();
  }, [fetchRatings]);

  useEffect(() => {
    void fetchReactions();
  }, [fetchReactions]);

  useEffect(() => {
    const ownerId = catchData?.user_id;
    if (!ownerId) {
      setIsFollowing(false);
      setFollowStatusLoaded(true);
      return;
    }
    if (!userId || userId === ownerId) {
      setIsFollowing(false);
      setFollowStatusLoaded(true);
      return;
    }
    setFollowStatusLoaded(false);
    void checkFollowStatus();
  }, [catchData?.user_id, userId, checkFollowStatus]);

  return {
    catchData,
    isUnavailable,
    ratings,
    hasRated,
    isLoading,
    reactionCount,
    userHasReacted,
    isFollowing,
    followStatusLoaded,
    setHasRated,
    setRatings,
    setReactionCount,
    setUserHasReacted,
    setIsFollowing,
    fetchReactions,
    fetchRatings,
  };
};
