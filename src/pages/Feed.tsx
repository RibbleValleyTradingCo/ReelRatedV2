import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser, useAuthLoading } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { canViewCatch } from "@/lib/visibility";
import { useSearchParams } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { FeedFilters } from "@/components/feed/FeedFilters";
import { CatchCard } from "@/components/feed/CatchCard";
import { logger } from "@/lib/logger";

const capitalizeFirstWord = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

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
  [key: string]: unknown;
} | null;

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

interface Catch {
  id: string;
  title: string;
  image_url: string;
  user_id: string;
  location: string;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  created_at: string;
  visibility: string | null;
  hide_exact_spot: boolean | null;
  session_id: string | null;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  };
  ratings: { rating: number }[];
  comments: { id: string }[];
  reactions: { user_id: string }[] | null;
  conditions: CatchConditions;
}

const PAGE_SIZE = 18;
const sanitizeCustomSpeciesInput = (value: string) => {
  const allowed = value.replace(/[^a-zA-Z0-9\s\-'\u2019]/g, "");
  return allowed.replace(/\s+/g, " ").trim();
};

const Feed = () => {
  const { user } = useAuthUser();
  const { loading } = useAuthLoading();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catches, setCatches] = useState<Catch[]>([]);
  const [filteredCatches, setFilteredCatches] = useState<Catch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [customSpeciesFilter, setCustomSpeciesFilter] = useState("");
  const [feedScope, setFeedScope] = useState<"all" | "following">("all");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(0);
  const sessionFilter = searchParams.get("session");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) {
      setCatches([]);
      setFilteredCatches([]);
      setHasMore(false);
      setNextCursor(0);
      setIsLoading(false);
      return;
    }

    let active = true;
    const loadCatches = async () => {
      setIsLoading(true);
      setHasMore(false);
      setNextCursor(0);
      const baseQuery = supabase
        .from("catches")
        .select(`
          *,
          profiles:user_id (username, avatar_path, avatar_url),
          ratings (rating),
          comments:catch_comments (id),
          reactions:catch_reactions (user_id)
        `)
        .is("deleted_at", null)
        .is("comments.deleted_at", null)
        .order("created_at", { ascending: false });

      const query = sessionFilter
        ? baseQuery.eq("session_id", sessionFilter)
        : baseQuery.range(0, PAGE_SIZE - 1);

      const { data, error } = await query;

      if (!active) return;

      if (error) {
        toast.error("Failed to load catches");
        logger.error("Failed to load catches", error, { userId: user?.id });
        setCatches([]);
        setHasMore(false);
        setNextCursor(0);
      } else {
        const fetched = (data as Catch[]) ?? [];
        setCatches(fetched);
        if (sessionFilter) {
          setHasMore(false);
          setNextCursor(fetched.length);
        } else {
          setHasMore(fetched.length === PAGE_SIZE);
          setNextCursor(fetched.length);
        }
      }

      setIsLoading(false);
    };

    void loadCatches();

    return () => {
      active = false;
    };
  }, [sessionFilter, user]);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      setFeedScope("all");
      return;
    }

    const loadFollowing = async () => {
      const { data, error} = await supabase
        .from("profile_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (error) {
        logger.error("Failed to load followed anglers", error, { userId: user.id });
        setFollowingIds([]);
        return;
      }

      setFollowingIds((data ?? []).map((row) => row.following_id));
    };

    void loadFollowing();
  }, [user]);

  const calculateAverageRating = (ratings: { rating: number }[]) => {
    if (ratings.length === 0) return "0";
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const filterAndSortCatches = useCallback(() => {
    let filtered = [...catches];

    filtered = filtered.filter((catchItem) =>
      canViewCatch(catchItem.visibility as VisibilityType | null, catchItem.user_id, user?.id, followingIds)
    );

    if (sessionFilter) {
      filtered = filtered.filter((catchItem) => catchItem.session_id === sessionFilter);
    }

    if (feedScope === "following") {
      if (followingIds.length === 0) {
        filtered = [];
      } else {
        filtered = filtered.filter((catchItem) => followingIds.includes(catchItem.user_id));
      }
    }

    if (speciesFilter !== "all") {
      filtered = filtered.filter((catchItem) => {
        if (speciesFilter === "other") {
          if (catchItem.species !== "other") {
            return false;
          }
          if (!customSpeciesFilter) {
            return true;
          }
          const customValue = (catchItem.conditions?.customFields?.species ?? "").toLowerCase();
          return customValue.startsWith(customSpeciesFilter.toLowerCase());
        }
        return catchItem.species === speciesFilter;
      });
    }

    if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "highest_rated") {
      filtered.sort((a, b) => {
        const avgA = calculateAverageRating(a.ratings);
        const avgB = calculateAverageRating(b.ratings);
        return parseFloat(avgB) - parseFloat(avgA);
      });
    } else if (sortBy === "heaviest") {
      filtered.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    }

    setFilteredCatches(filtered);
  }, [catches, feedScope, followingIds, speciesFilter, customSpeciesFilter, sortBy, user?.id, sessionFilter]);

  useEffect(() => {
    filterAndSortCatches();
  }, [filterAndSortCatches]);

  useEffect(() => {
    if (speciesFilter !== "other" && customSpeciesFilter) {
      setCustomSpeciesFilter("");
    }
  }, [speciesFilter, customSpeciesFilter]);

  const handleCustomSpeciesFilterChange = useCallback(
    (value: string) => {
      const sanitized = sanitizeCustomSpeciesInput(value);
      setCustomSpeciesFilter(sanitized);
    },
    [setCustomSpeciesFilter],
  );

  const handleLoadMore = useCallback(async () => {
    if (!user || !hasMore || isFetchingMore || sessionFilter) {
      return;
    }

    setIsFetchingMore(true);
    const { data, error } = await supabase
      .from("catches")
      .select(`
        *,
        profiles:user_id (username, avatar_path, avatar_url),
        ratings (rating),
        comments:catch_comments (id),
        reactions:catch_reactions (user_id)
      `)
      .is("deleted_at", null)
      .is("comments.deleted_at", null)
      .order("created_at", { ascending: false })
      .range(nextCursor, nextCursor + PAGE_SIZE - 1);

    if (error) {
      toast.error("Unable to load more catches");
      logger.error("Failed to load additional catches", error, { userId: user?.id });
    } else {
      const newRows = (data as Catch[]) ?? [];
      setCatches((prev) => [...prev, ...newRows]);
      setNextCursor((prev) => prev + newRows.length);
      setHasMore(newRows.length === PAGE_SIZE);
    }

    setIsFetchingMore(false);
  }, [hasMore, isFetchingMore, nextCursor, sessionFilter, user]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <LoadingState message="Loading your feed..." fullscreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Community Catches</h1>

        <FeedFilters
          feedScope={feedScope}
          onFeedScopeChange={setFeedScope}
          speciesFilter={speciesFilter}
          onSpeciesFilterChange={setSpeciesFilter}
          customSpeciesFilter={customSpeciesFilter}
          onCustomSpeciesFilterChange={handleCustomSpeciesFilterChange}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          userDisabled={!user}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCatches.map((catchItem) => (
            <CatchCard key={catchItem.id} catchItem={catchItem} userId={user?.id} />
          ))}
        </div>

        {!sessionFilter && hasMore && (
          <div className="mt-10 flex justify-center">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isFetchingMore}
              className="min-w-[200px]"
            >
              {isFetchingMore ? "Loading…" : "Load more catches"}
            </Button>
          </div>
        )}

        {filteredCatches.length === 0 && (
          <EmptyState
            message={
              catches.length === 0
                ? user
                  ? "No catches yet. Be the first to share!"
                  : "No catches shared yet. Sign in to start logging your trips."
                : sessionFilter
                  ? "No catches logged for this session yet."
                  : feedScope === "following"
                    ? "No catches from anglers you follow yet. Explore the full feed or follow more people."
                    : user
                      ? "No catches match your filters."
                      : "No catches match these filters yet. Try changing them or browsing other anglers’ catches."
            }
            actionLabel={user ? "Log Your First Catch" : undefined}
            onActionClick={user ? () => navigate("/add-catch") : undefined}
          />
        )}
      </div>
    </div>
  );
};

export default Feed;
