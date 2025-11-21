import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Trophy, Fish, BarChart3, Loader2, Settings, Sparkles } from "lucide-react";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { createNotification } from "@/lib/notifications";
import { isRateLimitError, getRateLimitMessage } from "@/lib/rateLimit";
import { getProfilePath, isUuid } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";
import { ProfileNotificationsSection } from "@/components/ProfileNotificationsSection";
import ProfileNotFound from "@/components/ProfileNotFound";

interface Profile {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface Catch {
  id: string;
  title: string;
  image_url: string;
  ratings: { rating: number }[];
  weight: number | null;
  weight_unit: string | null;
  species: string | null;
  created_at: string;
}

interface FollowingProfile {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const PROFILE_STATUS_PLACEHOLDER = "Nothing here yet. Tell people what you fish for.";

const formatWeight = (weight: number | null, unit: string | null) => {
  if (weight === null || weight === undefined) return "-";
  return `${weight}${unit === "kg" ? "kg" : "lb"}`;
};

const formatSpecies = (species: string | null) => {
  if (!species) return "-";
  return getFreshwaterSpeciesLabel(species) ?? species.replace(/_/g, " ");
};

const buildProfileStatCards = (stats: {
  total: number;
  avgRating: string;
  heaviestCatch: Catch | null;
  topSpecies: { species: string; count: number } | null;
}) => [
  {
    label: "Total catches",
    value: stats.total ?? 0,
    hint: stats.total > 0 ? null : "Log your first catch",
    icon: <Fish className="h-5 w-5" />,
  },
  {
    label: "Average rating",
    value: stats.avgRating !== "-" ? stats.avgRating : "–",
    hint:
      stats.avgRating !== "-"
        ? null
        : "Ratings will appear once others review your catches.",
    icon: <Star className="h-5 w-5" />,
  },
  {
    label: "Heaviest catch",
    value: stats.heaviestCatch
      ? formatWeight(stats.heaviestCatch.weight, stats.heaviestCatch.weight_unit)
      : "–",
    hint: stats.heaviestCatch ? null : "Add weights to your catches to track PBs.",
    icon: <Trophy className="h-5 w-5" />,
  },
  {
    label: "Top species",
    value: stats.topSpecies
      ? `${formatSpecies(stats.topSpecies.species)} (${stats.topSpecies.count})`
      : "–",
    hint: stats.topSpecies ? null : "No catches yet — species will appear here.",
    icon: <BarChart3 className="h-5 w-5" />,
  },
];

const Profile = () => {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catches, setCatches] = useState<Catch[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingProfiles, setFollowingProfiles] = useState<FollowingProfile[]>([]);

  const profileId = profile?.id ?? null;
  const isOwnProfile = user?.id === profileId;

  const profileAvatarUrl = useMemo(
    () => resolveAvatarUrl({ path: profile?.avatar_path, legacyUrl: profile?.avatar_url }),
    [profile?.avatar_path, profile?.avatar_url]
  );

  const fetchProfile = useCallback(async () => {
    if (!slug) {
      setIsLoading(false);
      setIsNotFound(true);
      setProfile(null);
      setCatches([]);
      setFollowersCount(0);
      setFollowingProfiles([]);
      return;
    }
    setIsLoading(true);
    const slugIsUuid = isUuid(slug);
    let query = supabase
      .from("profiles")
      .select("id, username, avatar_path, avatar_url, bio")
      .limit(1);

    query = slugIsUuid ? query.eq("id", slug) : query.eq("username", slug);

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      setIsLoading(false);
      setIsNotFound(true);
      setProfile(null);
      setCatches([]);
      setFollowersCount(0);
      setFollowingProfiles([]);
      return;
    }

    const profileRow = data as Profile;
    setIsNotFound(false);
    setProfile(profileRow);
    setEditedBio(profileRow.bio || "");
    setIsLoading(false);

    if ((slugIsUuid || profileRow.username !== slug) && profileRow.username) {
      navigate(`/profile/${profileRow.username}`, { replace: true });
    }
  }, [navigate, slug]);

  const fetchUserCatches = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase
      .from("catches")
      .select("id, title, image_url, weight, weight_unit, species, created_at, ratings (rating)")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCatches(data);
    }
  }, [profileId]);

  const fetchFollowers = useCallback(async () => {
    if (!profileId) return;
    const { count, error } = await supabase
      .from("profile_follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId);

    if (!error && count !== null) {
      setFollowersCount(count);
    }
  }, [profileId]);

  const fetchFollowingProfiles = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase
      .from("profile_follows")
      .select(
        `
          followed_profile:profiles!profile_follows_following_id_fkey (
            id,
            username,
            avatar_path,
            avatar_url,
            bio
          )
        `
      )
      .eq("follower_id", profileId);

    if (!error && data) {
      const parsed = (data as { followed_profile: FollowingProfile | null }[])
        .map((row) => row.followed_profile)
        .filter((profileRow): profileRow is FollowingProfile => !!profileRow);
      setFollowingProfiles(parsed);
    }
  }, [profileId]);

  const fetchFollowStatus = useCallback(async () => {
    if (!profileId || !user || user.id === profileId) return;
    const { data, error } = await supabase
      .from("profile_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profileId)
      .maybeSingle();

    if (!error) {
      setIsFollowing(!!data);
    }
  }, [profileId, user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profileId) return;
    void fetchUserCatches();
    void fetchFollowers();
    void fetchFollowingProfiles();
  }, [profileId, fetchFollowers, fetchFollowingProfiles, fetchUserCatches]);

  useEffect(() => {
    if (!profileId || !user || user.id === profileId) {
      setIsFollowing(false);
      return;
    }
    void fetchFollowStatus();
  }, [profileId, user, fetchFollowStatus]);

  const handleToggleFollow = async () => {
    if (!user || !profileId) {
      toast.error("Sign in to follow anglers");
      navigate("/auth");
      return;
    }
    if (user.id === profileId) return;

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);

      if (error) {
        toast.error("Failed to unfollow");
      } else {
        setIsFollowing(false);
        setFollowersCount((count) => Math.max(0, count - 1));
      }
    } else {
      const { error } = await supabase.rpc("follow_profile_with_rate_limit", {
        p_following_id: profileId,
      });

      if (error) {
        if (isRateLimitError(error)) {
          toast.error(getRateLimitMessage(error));
        } else {
          toast.error("Failed to follow");
        }
      } else {
        setIsFollowing(true);
        setFollowersCount((count) => count + 1);
        void createNotification({
          userId: profileId,
          actorId: user.id,
          type: "new_follower",
          payload: {
            message: `${user.user_metadata?.username ?? user.email ?? "Someone"} started following you.`,
          },
        });
      }
    }

    setFollowLoading(false);
  };

  const handleUpdateBio = async () => {
    if (!user || !isOwnProfile) return;

    const { error } = await supabase
      .from("profiles")
      .update({ bio: editedBio })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update bio");
    } else {
      toast.success("Bio updated!");
      setIsEditing(false);
      fetchProfile();
    }
  };

  const overallStats = useMemo(() => {
    const total = catches.length;
    const allRatings = catches.flatMap((catchItem) => catchItem.ratings.map((r) => r.rating));
    const avgRating =
      allRatings.length > 0
        ? (allRatings.reduce((acc, rating) => acc + rating, 0) / allRatings.length).toFixed(1)
        : "-";

    const heaviestCatch = catches
      .filter((catchItem) => catchItem.weight !== null)
      .reduce<Catch | null>((prev, curr) => {
        if (!prev) return curr;
        if (!prev.weight) return curr;
        if (!curr.weight) return prev;
        return curr.weight > prev.weight ? curr : prev;
      }, null);

    const speciesCount = new Map<string, number>();
    catches.forEach((catchItem) => {
      if (catchItem.species) {
        speciesCount.set(catchItem.species, (speciesCount.get(catchItem.species) ?? 0) + 1);
      }
    });
    const topSpeciesEntry = Array.from(speciesCount.entries()).sort((a, b) => b[1] - a[1])[0];

    const latestCatch = catches[0] ?? null;

    return {
      total,
      avgRating,
      heaviestCatch,
      topSpecies: topSpeciesEntry ? { species: topSpeciesEntry[0], count: topSpeciesEntry[1] } : null,
      latestCatch,
      followingCount: followingProfiles.length,
    };
  }, [catches, followingProfiles]);

  const statIconClasses =
    "flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-500";

  const statsCards = useMemo(
    () =>
      buildProfileStatCards({
        total: overallStats.total,
        avgRating: overallStats.avgRating,
        heaviestCatch: overallStats.heaviestCatch,
        topSpecies: overallStats.topSpecies,
      }),
    [overallStats]
  );

  if (isNotFound) {
    return <ProfileNotFound />;
  }

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading profile…
        </div>
      </div>
    );
  }

  const profileBio = profile.bio && profile.bio.trim().length > 0
    ? profile.bio
    : "No intro yet. Add your favourite waters and target species.";

  const totalFollowers = followersCount ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-10">
          <section
            aria-label="Angler profile overview"
            className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white shadow-xl min-h-[320px] md:min-h-[280px]"
          >
            <div className="absolute -top-24 right-10 h-56 w-56 rounded-full bg-sky-500/30 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/3 translate-y-1/3 rounded-full bg-sky-600/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25)_0%,_rgba(15,23,42,0.92)_45%,_rgba(10,12,15,0.98)_100%)]" />
            <div className="relative z-10 flex flex-col gap-8 px-5 py-6 md:flex-row md:items-start md:justify-between md:px-6 md:py-7 lg:gap-10 lg:px-8">
              <div className="flex flex-col items-center gap-6 text-center md:flex-1 md:items-start md:text-left">
                <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-start md:gap-6">
                  <div className="flex justify-center md:justify-start">
                    <Avatar className="h-20 w-20 ring-4 ring-white/80 ring-offset-4 ring-offset-slate-900 shadow-2xl md:h-24 md:w-24">
                      <AvatarImage src={profileAvatarUrl ?? ""} />
                      <AvatarFallback className="text-2xl">
                        {profile.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex w-full flex-1 flex-col items-center gap-3 text-center md:items-start md:text-left">
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100 shadow-sm md:mt-0">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {isOwnProfile ? "Your angler profile" : "Angler spotlight"}
                    </span>
                    <h1 className="text-3xl font-bold text-white leading-tight line-clamp-2 md:text-4xl md:leading-snug md:line-clamp-none">
                      {profile.username}
                    </h1>
                    {isEditing && isOwnProfile ? (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                        <Textarea
                          value={editedBio}
                          onChange={(e) => setEditedBio(e.target.value)}
                          placeholder="Tell us about yourself..."
                          rows={3}
                          className="bg-white text-slate-900"
                        />
                        <div className="flex flex-wrap gap-3">
                          <Button size="sm" onClick={handleUpdateBio} className="h-9 rounded-full bg-sky-500 text-white hover:bg-sky-600">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" className="h-9 rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setIsEditing(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-slate-100/80 line-clamp-3 md:line-clamp-none">
                        {profileBio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-wrap justify-center gap-3 md:justify-start md:gap-4">
                  {isOwnProfile && (
                    <Button
                      className="h-10 rounded-full bg-sky-500 px-6 text-sm font-semibold text-white hover:bg-sky-600"
                      onClick={() => navigate("/add-catch")}
                    >
                      Add catch
                    </Button>
                  )}

                  {isOwnProfile ? (
                    <>
                      <Button
                        variant="outline"
                        className="h-10 rounded-full border-white/40 bg-white/10 px-5 text-sm text-white hover:bg-white/20"
                        onClick={() => setIsEditing(true)}
                      >
                        Status
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 rounded-full border-white/40 bg-white/10 px-5 text-sm text-white hover:bg-white/20"
                        asChild
                      >
                        <Link to="/insights">View my stats</Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 rounded-full border-white/40 bg-white/10 px-5 text-sm text-white hover:bg-white/20"
                        asChild
                      >
                        <Link to="/settings/profile" className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          Account settings
                        </Link>
                      </Button>
                    </>
                  ) : user ? (
                    <Button
                      className="h-10 rounded-full bg-sky-500 px-5 text-sm font-semibold text-white hover:bg-sky-600"
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                    >
                      {followLoading ? "Updating…" : isFollowing ? "Following" : "Follow angler"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-10 rounded-full border-white/40 bg-white/10 px-5 text-sm text-white/80"
                      disabled
                    >
                      Sign in to follow anglers
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-white/40 bg-white/10 px-5 text-sm text-white hover:bg-white/20"
                    onClick={() => navigate("/feed")}
                  >
                    View community feed
                  </Button>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-4 md:flex-none md:w-56 md:grid-cols-1 lg:w-60">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Total catches</p>
                  <p className="mt-2 text-2xl font-semibold">{catches.length}</p>
                  {catches.length === 0 && (
                    <p className="text-xs text-white/60">Log your first catch to start your profile.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-white/70">Followers</p>
                  <p className="mt-2 text-2xl font-semibold">{totalFollowers}</p>
                  {totalFollowers === 0 && (
                    <p className="text-xs text-white/60">Followers will appear once anglers subscribe to you.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Angler stats</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statsCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={statIconClasses}>{card.icon}</div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {card.label}
                      </p>
                      <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                    </div>
                  </div>
                  {card.hint && (
                    <p className="mt-3 text-xs text-slate-500">{card.hint}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {isOwnProfile && (
            <ProfileNotificationsSection userId={profileId} />
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {isOwnProfile ? "Anglers you follow" : `${profile.username} follows`}
              </h2>
              {isOwnProfile && followingProfiles.length > 0 && (
                <span className="text-sm text-slate-500">{followingProfiles.length} angler{followingProfiles.length === 1 ? "" : "s"}</span>
              )}
            </div>
            {followingProfiles.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {followingProfiles.map((angler) => (
                  <Link
                    key={angler.id}
                    to={getProfilePath({ username: angler.username, id: angler.id })}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={resolveAvatarUrl({ path: angler.avatar_path, legacyUrl: angler.avatar_url }) ?? ""}
                      />
                      <AvatarFallback>{angler.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{angler.username}</p>
                      <p className="truncate text-xs text-slate-500">
                        {angler.bio || "No bio yet"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">You’re not following anyone yet</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Browse the feed and follow anglers to see their PBs here.
                </p>
                <Button
                  className="mt-4 h-10 rounded-full bg-sky-500 px-5 text-sm font-semibold text-white hover:bg-sky-600"
                  onClick={() => navigate("/feed")}
                >
                  Go to feed
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {isOwnProfile ? "Your catches" : `${profile.username}'s catches`}
              </h2>
              <span className="text-sm text-slate-500">{catches.length} logged</span>
            </div>
            {catches.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Fish className="h-12 w-12 text-slate-400" />
                <h3 className="text-base font-semibold text-slate-900">No catches yet</h3>
                <p className="text-sm text-slate-500">Add your first session to start building your reel.</p>
                {isOwnProfile ? (
                  <Button
                    className="h-10 rounded-full bg-sky-500 px-5 text-sm font-semibold text-white hover:bg-sky-600"
                    onClick={() => navigate("/add-catch")}
                  >
                    Add catch
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-slate-300 px-5 text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => navigate("/feed")}
                  >
                    Browse feed
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {catches.map((catchItem) => (
                  <Card
                    key={catchItem.id}
                    className="overflow-hidden border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    onClick={() => navigate(`/catch/${catchItem.id}`)}
                  >
                    <CardContent className="p-0">
                      <img
                        src={catchItem.image_url}
                        alt={catchItem.title}
                        className="h-48 w-full object-cover"
                      />
                      <div className="space-y-3 p-4">
                        <p className="truncate text-sm font-semibold text-slate-900">{catchItem.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {catchItem.species ? formatSpecies(catchItem.species) : "Species unknown"}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{new Date(catchItem.created_at).toLocaleDateString("en-GB")}</span>
                          <span>{formatWeight(catchItem.weight, catchItem.weight_unit)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;
