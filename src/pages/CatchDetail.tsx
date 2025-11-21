import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthUser } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Fish as FishIcon,
  Wrench,
  Star,
  Clock,
  Wind,
  Thermometer,
  Droplets,
  Eye,
  EyeOff,
  Heart,
  Share2,
  Copy,
  Trash2,
  Layers,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { calculateAverageRating, formatWeight, formatSpecies, formatEnum, formatSlugLabel } from "@/lib/catch-formatting";
import { CatchComments } from "@/components/CatchComments";
import { useCatchData } from "@/hooks/useCatchData";
import type { CatchData, Rating } from "@/hooks/useCatchData";
import { useCatchInteractions } from "@/hooks/useCatchInteractions";
import { createNotification } from "@/lib/notifications";
import { getProfilePath } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";
import { canViewCatch, shouldShowExactLocation } from "@/lib/visibility";
import type { Database } from "@/integrations/supabase/types";
import html2canvas from "html2canvas";
import ShareCard from "@/components/ShareCard";
import ReportButton from "@/components/ReportButton";

const CatchDetail = () => {
  const { id } = useParams();
  const { user } = useAuthUser();
  const navigate = useNavigate();
  const [userRating, setUserRating] = useState<number>(5);
  const [followLoading, setFollowLoading] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  const {
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
  } = useCatchData({
    catchId: id,
    userId: user?.id,
  });

  const ownerId = catchData?.user_id ?? null;

  const {
    handleDeleteCatch,
    handleToggleFollow,
    handleToggleReaction,
    handleCopyLink,
    handleShareWhatsApp,
    handleDownloadShareImage,
    handleAddRating,
    catchUrl,
  } = useCatchInteractions({
    catchId: id,
    catchData,
    userId: user?.id,
    userEmail: user?.email,
    username: user?.user_metadata?.username,
    userRating,
    hasRated,
    isFollowing,
    userHasReacted,
    setIsFollowing,
    setReactionCount,
    setUserHasReacted,
    setHasRated,
    setFollowLoading,
    setReactionLoading,
    setDeleteLoading,
    setDeleteDialogOpen,
    setShareCopied,
    setDownloadLoading,
    shareCardRef,
    fetchRatings,
  });

  const ownerAvatarUrl = useMemo(
    () =>
      resolveAvatarUrl({
        path: catchData?.profiles?.avatar_path ?? null,
        legacyUrl: catchData?.profiles?.avatar_url ?? null,
      }),
    [catchData?.profiles?.avatar_path, catchData?.profiles?.avatar_url]
  );

  useEffect(() => {
    if (!catchData) return;
    const needsFollowCheck =
      catchData.visibility === "followers" && user?.id !== catchData.user_id;
    if (needsFollowCheck && !followStatusLoaded) {
      return;
    }

    const allowed = canViewCatch(
      catchData.visibility,
      catchData.user_id,
      user?.id,
      isFollowing ? [catchData.user_id] : []
    );

    if (!allowed) {
      toast.error("You do not have access to this catch");
      navigate("/feed");
    }
  }, [catchData, followStatusLoaded, isFollowing, navigate, user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">Loading...</div>
      </div>
    );
  }

  if (isUnavailable || !catchData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Card className="max-w-lg text-center">
            <CardHeader>
              <CardTitle>This catch is no longer available</CardTitle>
              <CardDescription>
                It may have been removed or set to private. Head back to the community feed to explore other catches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/feed">Return to feed</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const customFields = catchData.conditions?.customFields ?? {};
  const customSpecies = customFields.species;
  const customMethod = customFields.method;
  const gpsData = catchData.conditions?.gps;
  const showGpsMap = !catchData.hide_exact_spot && gpsData;
  const profile = catchData.profiles ?? {
    username: "Unknown angler",
    avatar_url: null,
  };
  const shareSpecies = formatSpecies(catchData.species_slug, customSpecies ?? catchData.custom_species);
  const shareWeight = formatWeight(catchData.weight, catchData.weight_unit);
  const shareDate = catchData.caught_at ?? catchData.created_at;
  const methodLabel = (() => {
    if (catchData.method_tag === "other") {
      return customMethod ?? "Other";
    }
    if (catchData.method_tag) {
      return formatSlugLabel(catchData.method_tag);
    }
    return customMethod ?? "";
  })();
  const canShowExactLocation = shouldShowExactLocation(
    catchData.hide_exact_spot,
    catchData.user_id,
    user?.id
  );
  const locationLabel = canShowExactLocation
    ? catchData.location_label ?? undefined
    : undefined;
  const displayLocationLabel = locationLabel ?? (catchData.hide_exact_spot ? "Undisclosed venue" : catchData.location_label ?? undefined);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="pointer-events-none fixed -top-[2000px] left-0 opacity-0" ref={shareCardRef}>
          <ShareCard
            photoUrl={catchData.image_url}
            species={shareSpecies ?? undefined}
            weight={shareWeight ?? undefined}
            venue={locationLabel}
            date={shareDate ?? undefined}
            angler={profile.username}
          />
        </div>
        {/* Hero Section */}
        <div className="relative mb-8">
          <img
            src={catchData.image_url}
            alt={catchData.title}
            className="w-full h-[500px] object-cover rounded-xl"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-8 rounded-b-xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {catchData.species_slug && catchData.weight && (
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl font-bold text-white">
                      {catchData.weight}{catchData.weight_unit === 'kg' ? 'kg' : 'lb'}
                    </span>
                    <span className="text-2xl text-white/90">{formatSpecies(catchData.species_slug, customSpecies ?? catchData.custom_species)}</span>
                  </div>
                )}
                <h1 className="text-3xl font-bold text-white mb-2">{catchData.title}</h1>
                {canShowExactLocation && catchData.location_label ? (
                  <Link
                    to={`/venues/${encodeURIComponent(catchData.location_label)}`}
                    className="flex items-center gap-2 text-white/90 underline-offset-4 hover:underline"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{catchData.location_label}</span>
                  </Link>
                ) : catchData.hide_exact_spot ? (
                  <div className="flex items-center gap-2 text-white/70">
                    <MapPin className="w-4 h-4" />
                    <span>Undisclosed venue</span>
                  </div>
                ) : null}
                {catchData.session && (
                  <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                    <Layers className="w-4 h-4" />
                    <Link
                      to={`/sessions?session=${catchData.session.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      View session{catchData.session.title ? `: ${catchData.session.title}` : ""}
                    </Link>
                  </div>
                )}
                {catchData.caught_at && (
                  <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(catchData.caught_at), "MMMM dd, yyyy")}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={getProfilePath({ username: catchData.profiles?.username, id: catchData.user_id })}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={ownerAvatarUrl ?? ""} />
                    <AvatarFallback>{profile.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-white">{profile.username}</span>
                </Link>
                {user && user.id !== ownerId && (
                  <Button
                    size="sm"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`border border-white/40 text-white ${
                      isFollowing ? "bg-white/30 hover:bg-white/40" : "bg-white/10 hover:bg-white/20"
                    }`}
                    variant="ghost"
                  >
                    {followLoading ? "Updating…" : isFollowing ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={userHasReacted ? "ocean" : "outline"}
              onClick={handleToggleReaction}
              disabled={reactionLoading || !catchData}
              className="flex items-center gap-2"
            >
              <Heart className="h-4 w-4" fill={userHasReacted ? "currentColor" : "none"} />
              {reactionLoading ? "Saving…" : userHasReacted ? "Liked" : "Like"}
            </Button>
            <span className="text-sm text-muted-foreground">{reactionCount} like{reactionCount === 1 ? "" : "s"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleShareWhatsApp(locationLabel)} className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share to WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {shareCopied ? "Copied" : "Copy link"}
            </Button>
            <Button
              size="sm"
              variant="ocean"
              onClick={handleDownloadShareImage}
              disabled={downloadLoading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadLoading ? "Preparing…" : "Download share image"}
            </Button>
            <ReportButton
              targetType="catch"
              targetId={catchData.id}
              label="Report catch"
              className="text-destructive hover:text-destructive"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Story */}
            {catchData.description && (
              <Card>
                <CardHeader>
                  <CardTitle>The Story</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{catchData.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Gallery */}
            {catchData.gallery_photos && catchData.gallery_photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Gallery</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {catchData.gallery_photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <CatchComments
              catchId={catchData.id}
              catchOwnerId={catchData.user_id}
              catchTitle={catchData.title}
              currentUserId={user?.id ?? null}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rating */}
            {catchData.allow_ratings && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-accent fill-accent" />
                    <CardTitle>Rating</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{calculateAverageRating(ratings)}</div>
                    <p className="text-sm text-muted-foreground mt-1">{ratings.length} ratings</p>
                  </div>

                  {user && !hasRated && (
                    <div className="space-y-3 pt-4 border-t">
                      <p className="font-medium text-sm">Rate this catch (1-10)</p>
                      <Slider
                        value={[userRating]}
                        onValueChange={(value) => setUserRating(value[0])}
                        min={1}
                        max={10}
                        step={1}
                        className="py-4"
                      />
                      <div className="text-center text-2xl font-bold">{userRating}</div>
                      <Button onClick={handleAddRating} className="w-full" size="sm">
                        Submit Rating
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Session Details */}
            <Card>
              <CardHeader>
                <CardTitle>Session Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {displayLocationLabel && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Location</div>
                      <div className="text-muted-foreground">{displayLocationLabel}</div>
                    </div>
                  </div>
                )}
                {catchData.peg_or_swim && !catchData.hide_exact_spot && (
                  <div className="flex items-start gap-2">
                    <Layers className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Peg/Swim</div>
                      <div className="text-muted-foreground">{catchData.peg_or_swim}</div>
                    </div>
                  </div>
                )}
                {catchData.hide_exact_spot && catchData.peg_or_swim && (
                  <div className="flex items-start gap-2">
                    <EyeOff className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-muted-foreground text-xs">
                      Exact peg/swim hidden by angler
                    </div>
                  </div>
                )}
                {catchData.length && (
                  <div className="flex items-start gap-2">
                    <FishIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Length</div>
                      <div className="text-muted-foreground">
                        {catchData.length}{catchData.length_unit}
                      </div>
                    </div>
                  </div>
                )}
                {catchData.water_type_code && (
                  <div className="flex items-start gap-2">
                    <Droplets className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Water Type</div>
                      <div className="text-muted-foreground">{formatEnum(catchData.water_type_code)}</div>
                    </div>
                  </div>
                )}
                {catchData.time_of_day && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Time of Day</div>
                      <div className="text-muted-foreground">{formatEnum(catchData.time_of_day)}</div>
                    </div>
                  </div>
                )}
                {showGpsMap && gpsData && (
                  <div className="space-y-2">
                    <div className="font-medium">GPS Pin</div>
                    <div className="overflow-hidden rounded-lg border">
                      <iframe
                        title="Pinned fishing location"
                        src={`https://www.google.com/maps?q=${gpsData.lat},${gpsData.lng}&z=15&output=embed`}
                        width="100%"
                        height="220"
                        loading="lazy"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {gpsData.label ?? `Dropped at ${gpsData.lat.toFixed(5)}, ${gpsData.lng.toFixed(5)}`}
                      {gpsData.accuracy ? ` (±${Math.round(gpsData.accuracy)}m)` : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tactics */}
            {(catchData.method_tag || customMethod || catchData.bait_used || catchData.equipment_used) && (
              <Card>
                <CardHeader>
                  <CardTitle>Tactics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                {(catchData.method_tag || customMethod) && (
                  <div>
                    <div className="font-medium">Method</div>
                    <div className="text-muted-foreground">
                      {methodLabel}
                    </div>
                  </div>
                )}
                  {catchData.bait_used && (
                    <div>
                      <div className="font-medium">Bait</div>
                      <div className="text-muted-foreground">{catchData.bait_used}</div>
                    </div>
                  )}
                  {catchData.equipment_used && (
                    <div>
                      <div className="font-medium">Equipment</div>
                      <div className="text-muted-foreground">{catchData.equipment_used}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Conditions */}
            {catchData.conditions && Object.keys(catchData.conditions as Record<string, unknown>).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Conditions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {catchData.conditions.weather && (
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-primary" />
                      <span className="font-medium">Weather:</span>
                      <span className="text-muted-foreground">{formatEnum(catchData.conditions.weather)}</span>
                    </div>
                  )}
                  {catchData.conditions.airTemp && (
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-primary" />
                      <span className="font-medium">Air Temp:</span>
                      <span className="text-muted-foreground">{catchData.conditions.airTemp}°C</span>
                    </div>
                  )}
                  {catchData.conditions.waterClarity && (
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-primary" />
                      <span className="font-medium">Water:</span>
                      <span className="text-muted-foreground">{formatEnum(catchData.conditions.waterClarity)}</span>
                    </div>
                  )}
                  {catchData.conditions.windDirection && (
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-primary" />
                      <span className="font-medium">Wind:</span>
                      <span className="text-muted-foreground">{catchData.conditions.windDirection}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {catchData.tags && catchData.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {catchData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {user && user.id === ownerId && (
        <div className="container mx-auto px-4 pb-12 max-w-5xl">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-destructive">Need to remove this catch?</p>
                <p className="text-destructive/80">
                  Deleting a catch will remove its ratings, reactions, and comments permanently.
                </p>
              </div>
              <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => !deleteLoading && setDeleteDialogOpen(open)}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleteLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteLoading ? "Deleting…" : "Delete catch"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this catch?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removing this log will also clear its ratings, reactions, and comments. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async (event) => {
                        event.preventDefault();
                        await handleDeleteCatch();
                      }}
                    >
                      {deleteLoading ? "Deleting…" : "Delete catch"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatchDetail;
