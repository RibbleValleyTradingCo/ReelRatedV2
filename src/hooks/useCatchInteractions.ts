import { useCallback, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";
import html2canvas from "html2canvas";
import { formatSpecies, formatWeight, formatSlugLabel } from "@/lib/catch-formatting";
import type { CatchData } from "./useCatchData";
import { logger } from "@/lib/logger";
import { isRateLimitError, getRateLimitMessage } from "@/lib/rateLimit";

interface UseCatchInteractionsParams {
  catchId: string | undefined;
  catchData: CatchData | null;
  userId: string | undefined;
  userEmail: string | undefined;
  username: string | undefined;
  userRating: number;
  hasRated: boolean;
  isFollowing: boolean;
  userHasReacted: boolean;
  setIsFollowing: (value: boolean) => void;
  setReactionCount: (updater: number | ((prev: number) => number)) => void;
  setUserHasReacted: (value: boolean) => void;
  setHasRated: (value: boolean) => void;
  setFollowLoading: (value: boolean) => void;
  setReactionLoading: (value: boolean) => void;
  setDeleteLoading: (value: boolean) => void;
  setDeleteDialogOpen: (value: boolean) => void;
  setShareCopied: (value: boolean) => void;
  setDownloadLoading: (value: boolean) => void;
  shareCardRef: RefObject<HTMLDivElement>;
  fetchRatings: () => void;
}

export const useCatchInteractions = ({
  catchId,
  catchData,
  userId,
  userEmail,
  username,
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
}: UseCatchInteractionsParams) => {
  const navigate = useNavigate();

  const handleDeleteCatch = useCallback(async () => {
    if (!userId || !catchData) {
      toast.error("Unable to delete this catch");
      return;
    }

    setDeleteLoading(true);
    const { error } = await supabase
      .from("catches")
      .delete()
      .eq("id", catchData.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to delete catch");
      logger.error("Failed to delete catch", error, { catchId: catchData.id, userId });
      setDeleteLoading(false);
      return;
    }

    toast.success("Catch removed");
    setDeleteDialogOpen(false);
    setDeleteLoading(false);
    navigate("/feed");
  }, [catchData, navigate, userId, setDeleteLoading, setDeleteDialogOpen]);

  const handleToggleFollow = async () => {
    if (!userId || !catchData) {
      toast.error("Sign in to follow anglers");
      navigate("/auth");
      return;
    }

    if (userId === catchData.user_id) return;

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", userId)
        .eq("following_id", catchData.user_id);

      if (error) {
        toast.error("Failed to unfollow");
        logger.error("Failed to unfollow", error, { userId, ownerId: catchData.user_id });
      } else {
        setIsFollowing(false);
        toast.success("Unfollowed angler");
      }
    } else {
      const { error } = await supabase.rpc("follow_profile_with_rate_limit", {
        p_following_id: catchData.user_id,
      });

      if (error) {
        if (isRateLimitError(error)) {
          toast.error(getRateLimitMessage(error));
        } else {
          toast.error("Failed to follow angler");
        }
        logger.error("Failed to follow angler", error, { userId, ownerId: catchData.user_id });
      } else {
        setIsFollowing(true);
        toast.success("Following angler");
        const actorName = username ?? userEmail ?? "Someone";
        void createNotification({
          userId: catchData.user_id,
          actorId: userId,
          type: "new_follower",
          payload: {
            message: `${actorName} started following you.`,
            extraData: {
              follower_username: actorName,
            },
          },
        });
      }
    }

    setFollowLoading(false);
  };

  const handleToggleReaction = async () => {
    if (!userId || !catchData) {
      toast.error("Sign in to react");
      navigate("/auth");
      return;
    }

    setReactionLoading(true);

    if (userHasReacted) {
      const { error } = await supabase
        .from("catch_reactions")
        .delete()
        .eq("catch_id", catchData.id)
        .eq("user_id", userId);

      if (!error) {
        setReactionCount((count) => Math.max(0, count - 1));
        setUserHasReacted(false);
      } else {
        toast.error("Couldn't remove reaction");
        logger.error("Couldn't remove reaction", error, { catchId: catchData.id, userId });
      }
    } else {
      const { error } = await supabase.rpc("react_to_catch_with_rate_limit", {
        p_catch_id: catchData.id,
        p_reaction: "like",
      });

      if (error) {
        if (isRateLimitError(error)) {
          toast.error(getRateLimitMessage(error));
          setReactionLoading(false);
          return;
        }

        if (error.code === "23505") {
          setUserHasReacted(true);
        } else {
          toast.error("Couldn't add reaction");
          logger.error("Couldn't add reaction", error, { catchId: catchData.id, userId });
          setReactionLoading(false);
          return;
        }
      } else {
        setReactionCount((count) => count + 1);
        setUserHasReacted(true);
        if (catchData.user_id !== userId) {
          const actorName = username ?? userEmail ?? "Someone";
          void createNotification({
            userId: catchData.user_id,
            actorId: userId,
            type: "new_reaction",
            payload: {
              message: `${actorName} liked your catch "${catchData.title}".`,
              catchId: catchData.id,
              extraData: {
                catch_title: catchData.title,
              },
            },
          });
        }
      }
    }

    setReactionLoading(false);
  };

  const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  const catchUrl = publicSiteUrl
    ? `${publicSiteUrl.replace(/\/$/, "")}/catch/${catchId}`
    : typeof window !== "undefined"
    ? `${window.location.origin}/catch/${catchId}`
    : `/catch/${catchId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(catchUrl);
      setShareCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setShareCopied(false), 2000);
    } catch (error) {
      logger.error("Clipboard copy failed", error, { catchUrl });
      toast.error("Unable to copy link");
    }
  };

  const handleShareWhatsApp = (locationLabel?: string) => {
    if (!catchData) {
      window.open(`https://wa.me/?text=${encodeURIComponent(catchUrl)}`, "_blank");
      return;
    }
    const customFields = catchData.conditions?.customFields ?? {};
    const customSpecies = customFields.species;
    const speciesLabel = formatSpecies(catchData.species, customSpecies) ?? "a catch";
    const weightLabel = catchData.weight ? formatWeight(catchData.weight, catchData.weight_unit) : null;
    const messageParts = [
      `Check out ${catchData.title}`,
      weightLabel ? `(${weightLabel})` : null,
      speciesLabel ? `– ${speciesLabel}` : null,
      locationLabel ? `at ${locationLabel}` : null,
      `on ReelyRated: ${catchUrl}`,
    ].filter(Boolean);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(messageParts.join(" "))}`;
    window.open(waUrl, "_blank");
  };

  const handleDownloadShareImage = async () => {
    if (!catchData || !shareCardRef.current) return;
    setDownloadLoading(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeTitle = catchData.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      link.href = dataUrl;
      link.download = `${safeTitle || "catch"}-share.png`;
      link.click();
      toast.success("Share image saved");
    } catch (error) {
      logger.error("Failed to generate share image", error, { catchId: catchData?.id });
      toast.error("Unable to generate share image");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleAddRating = async () => {
    if (!userId || hasRated) return;
    if (!catchData || catchData.allow_ratings === false) {
      toast.error("Ratings are disabled for this catch");
      return;
    }

    const { error } = await supabase.rpc("rate_catch_with_rate_limit", {
      p_catch_id: catchId,
      p_rating: userRating,
    });

    if (error) {
      if (isRateLimitError(error)) {
        toast.error(getRateLimitMessage(error));
      } else {
        toast.error("Failed to add rating");
      }
    } else {
      toast.success("Rating added!");
      setHasRated(true);
      fetchRatings();
      if (catchData && catchData.user_id !== userId) {
        const actorName = username ?? userEmail ?? "Someone";
        void createNotification({
          userId: catchData.user_id,
          actorId: userId,
          type: "new_rating",
          payload: {
            message: `${actorName} rated your catch "${catchData.title}" ${userRating}/10.`,
            catchId: catchData.id,
            extraData: {
              rating: userRating,
            },
          },
        });
      }
    }
  };

  return {
    handleDeleteCatch,
    handleToggleFollow,
    handleToggleReaction,
    handleCopyLink,
    handleShareWhatsApp,
    handleDownloadShareImage,
    handleAddRating,
    catchUrl,
  };
};
