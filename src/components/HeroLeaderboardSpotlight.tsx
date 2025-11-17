import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Fish, Sparkles, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import heroFish from "@/assets/hero-fish.jpg";
import { supabase } from "@/integrations/supabase/client";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { getProfilePath } from "@/lib/profile";
import { cn } from "@/lib/utils";

interface TopCatch {
  id: string;
  user_id: string | null;
  title: string | null;
  species_slug: string | null;
  weight: number | null;
  weight_unit: string | null;
  image_url: string | null;
  total_score: number | null;
  avg_rating: number | null;
  rating_count: number | null;
  created_at: string | null;
}

interface AnglerProfile {
  username: string | null;
}

const STATS_BAR_THEMES = [
  {
    id: "blue",
    label: "Blue",
    gradient: "from-blue-600 via-blue-500 to-cyan-500",
  },
  {
    id: "midnight",
    label: "Midnight",
    gradient: "from-slate-900 via-slate-800 to-slate-900",
  },
  {
    id: "emerald",
    label: "Emerald",
    gradient: "from-emerald-600 via-teal-500 to-cyan-500",
  },
  {
    id: "sunset",
    label: "Sunset",
    gradient: "from-rose-500 via-orange-500 to-amber-500",
  },
] as const;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatWeight = (weight: number | null, unit: string | null) => {
  if (weight === null || weight === undefined) return null;
  if (!unit) return `${weight}`;
  return `${weight} ${unit}`;
};

const formatSpecies = (species: string | null) => {
  if (!species) return "Unknown species";
  if (species === "other") return "Other species";
  return getFreshwaterSpeciesLabel(species) ?? species.replace(/_/g, " ");
};

const formatRelativeTime = (iso: string | null) => {
  if (!iso) return "Moments ago";
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "Recently";
  const diff = Date.now() - created.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "Just now";
  if (diff < hour) {
    const mins = Math.round(diff / minute);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const hrs = Math.round(diff / hour);
    return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(diff / day);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const HeroLeaderboardSpotlight = () => {
  const navigate = useNavigate();
  const [topCatch, setTopCatch] = useState<TopCatch | null>(null);
  const [angler, setAngler] = useState<AnglerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsThemeIndex, setStatsThemeIndex] = useState(0);

  const topCatchRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const fetchTopCatch = useCallback(
    async (isBackground = false) => {
      if (loadingRef.current && isBackground) {
        return;
      }

      if (!isBackground) {
        setLoading(true);
      }
      loadingRef.current = true;
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from("leaderboard_scores_detailed")
          .select(
            "id, user_id, title, species_slug, weight, weight_unit, image_url, total_score, avg_rating, rating_count, created_at",
          )
          .order("total_score", { ascending: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (queryError) {
          throw queryError;
        }

        if (!data) {
          setTopCatch(null);
          setAngler(null);
          topCatchRef.current = null;
          return;
        }

        const normalized: TopCatch = {
          id: data.id,
          user_id: data.user_id ?? null,
          title: data.title ?? null,
          species_slug: data.species_slug ?? null,
          weight: toNumber(data.weight),
          weight_unit: data.weight_unit ?? null,
          image_url: data.image_url ?? null,
          total_score: toNumber(data.total_score),
          avg_rating: toNumber(data.avg_rating),
          rating_count: toNumber(data.rating_count),
          created_at: data.created_at ?? null,
        };

        setTopCatch(normalized);
        topCatchRef.current = normalized.id;

        if (normalized.user_id) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", normalized.user_id)
            .maybeSingle();

          if (profileError) {
            console.warn("Failed to fetch angler profile", profileError);
            setAngler(null);
          } else {
            setAngler(profileData ?? null);
          }
        } else {
          setAngler(null);
        }
      } catch (caughtError) {
        console.error("Error loading leaderboard spotlight", caughtError);
        setError("Leaderboard is warming up. Be the first to claim the spotlight!");
        setTopCatch(null);
        setAngler(null);
        topCatchRef.current = null;
      } finally {
        loadingRef.current = false;
        if (!isBackground) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchTopCatch(false);
  }, [fetchTopCatch]);

  useEffect(() => {
    const channel = supabase
      .channel("hero_top_catch_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catches",
        },
        (payload) => {
          if (
            payload.eventType === "DELETE" &&
            payload.old &&
            payload.old.id === topCatchRef.current
          ) {
            void fetchTopCatch(true);
          } else if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            void fetchTopCatch(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTopCatch]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-medium text-slate-500">
        Loading top catch…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-medium text-slate-500">
        {error}
      </div>
    );
  }

  if (!topCatch) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-medium text-slate-500">
        Be the first to log a catch and get featured here! 🎣
      </div>
    );
  }

  const scoreValue =
    topCatch.total_score !== null && topCatch.total_score !== undefined
      ? topCatch.total_score.toFixed(1)
      : "—";
  const weightLabel = formatWeight(topCatch.weight, topCatch.weight_unit) ?? "—";
  const hasRatings =
    topCatch.rating_count && topCatch.rating_count > 0 && topCatch.avg_rating !== null;
  const ratingValue =
    hasRatings && topCatch.avg_rating !== null ? topCatch.avg_rating.toFixed(1) : "—";
  const ratingCount = topCatch.rating_count ?? 0;
  const initials =
    angler?.username && angler.username.length > 0
      ? angler.username
          .split("")
          .filter((char) => /[a-z0-9]/i.test(char))
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "RR";
  const relativeTime = formatRelativeTime(topCatch.created_at);
  const speciesLabel = formatSpecies(topCatch.species_slug);
  const usernameDisplay = angler?.username ? `@${angler.username}` : "ReelyRated";
  const statsTheme = STATS_BAR_THEMES[statsThemeIndex] ?? STATS_BAR_THEMES[0];

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-right-6 motion-safe:duration-500">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
          Live • Featured Catch
        </span>
      </div>

      <div className="group relative cursor-pointer overflow-hidden rounded-3xl shadow-2xl transition-all duration-500 hover:shadow-[0_35px_60px_-15px_rgba(30,64,175,0.35)]">
        <div className="relative h-64 overflow-hidden bg-slate-200 md:h-72">
          <img
            src={topCatch.image_url ?? heroFish}
            alt={topCatch.title ?? speciesLabel}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/45 via-slate-900/0 to-transparent md:from-slate-900/35" />

          <div className="absolute right-4 top-4">
            <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-yellow-300 to-yellow-400 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg transition-transform group-hover:scale-110">
              <Crown className="h-4 w-4" aria-hidden="true" />
              <span>#1 Ranked</span>
            </div>
          </div>
        </div>

        <div className={cn("bg-gradient-to-r px-6 py-5 text-white transition-colors duration-300", statsTheme.gradient)}>
          <div className="flex flex-wrap items-center justify-center gap-5 text-center sm:gap-8">
            <div className="flex min-w-[120px] flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 shadow-sm backdrop-blur-md">
                <Trophy className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                Overall Score
              </span>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black md:text-4xl">{scoreValue}</span>
              </div>
            </div>
            <div className="flex min-w-[120px] flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 shadow-sm backdrop-blur-md">
                <Fish className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                Recorded Weight
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold md:text-3xl">{weightLabel}</span>
              </div>
            </div>
            <div className="flex min-w-[120px] flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 shadow-sm backdrop-blur-md">
                <Sparkles className="h-5 w-5 text-yellow-200" aria-hidden="true" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
                Average Rating
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold md:text-3xl">{ratingValue}</span>
              </div>
              <span className="text-xs font-medium text-white/60">
                {ratingCount > 0 ? `${ratingCount} rating${ratingCount === 1 ? "" : "s"}` : "Awaiting ratings"}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================
             INFO SECTION - REFINED DETAILS
             ======================================== */}
        <div className="border-t-4 border-blue-600 bg-white">
          {/* Title & Species Section */}
          <div className="px-5 pb-4 pt-5">
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-100">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="truncate">{speciesLabel}</span>
            </div>

            <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 md:text-lg">
              {topCatch.title ?? "Untitled catch"}
            </h3>
          </div>

          {/* ENHANCED Angler Section - Gray background for separation */}
          <div className="border-t border-gray-200 bg-gray-50 px-5 pb-4 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 opacity-75 blur-sm" aria-hidden="true" />
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-md ring-2 ring-white md:h-10 md:w-10">
                    {initials.slice(0, 1)}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col">
                  {angler?.username && topCatch.user_id ? (
                    <Link
                      to={getProfilePath({ username: angler.username, id: topCatch.user_id })}
                      className="truncate text-sm font-bold text-gray-900 transition-colors hover:text-blue-600"
                    >
                      {usernameDisplay}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-bold text-gray-900">{usernameDisplay}</span>
                  )}
                  <span className="text-xs text-gray-500">{relativeTime}</span>
                </div>
              </div>

              <button
                type="button"
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 hover:shadow"
                onClick={() => navigate(`/catch/${topCatch.id}`)}
              >
                <span>View</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
        <span className="uppercase tracking-[0.24em] text-gray-400">Data palette</span>
        {STATS_BAR_THEMES.map((theme, index) => (
          <button
            key={theme.id}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              index === statsThemeIndex
                ? "border-blue-500 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600",
            )}
            onClick={() => setStatsThemeIndex(index)}
          >
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HeroLeaderboardSpotlight;
