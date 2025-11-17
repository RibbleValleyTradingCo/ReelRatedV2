import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/components/AuthProvider";
import { createNotification } from "@/lib/notifications";
import { getProfilePath } from "@/lib/profile";
import ReportButton from "@/components/ReportButton";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/storage";
import { useRateLimit, formatResetTime } from "@/hooks/useRateLimit";
import { isRateLimitError, getRateLimitMessage } from "@/lib/rateLimit";

interface CatchCommentsProps {
  catchId: string;
  catchOwnerId: string;
  catchTitle?: string;
  currentUserId?: string | null;
}

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  } | null;
}

interface MentionSuggestion {
  id: string;
  username: string;
  avatar_path: string | null;
  avatar_url: string | null;
}

const highlightMentions = (text: string) => {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={index} className="text-primary font-medium">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export const CatchComments = memo(({ catchId, catchOwnerId, catchTitle, currentUserId }: CatchCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  // Rate limiting: max 30 comments per hour
  const { checkLimit, isLimited, attemptsRemaining, resetIn } = useRateLimit({
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000, // 1 hour
    storageKey: 'comment-submit-limit',
    onLimitExceeded: () => {
      const resetTime = formatResetTime(resetIn);
      toast.error(`Rate limit exceeded. You can only post 30 comments per hour. Try again in ${resetTime}.`);
    },
  });
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("catch_comments")
      .select(
        "id, body, created_at, user_id, profiles:user_id (id, username, avatar_path, avatar_url)",
      )
      .eq("catch_id", catchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load comments");
    } else {
      setComments((data as CommentRow[]) ?? []);
    }
    setIsLoading(false);
  }, [catchId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    let isMounted = true;

    if (!mentionActive) {
      setMentionSuggestions([]);
      setMentionLoading(false);
      return;
    }

    setMentionLoading(true);
    const query = supabase
      .from("profiles")
      .select("id, username, avatar_path, avatar_url")
      .limit(5)
      .neq("id", currentUserId ?? "");

    const request = mentionQuery
      ? query.ilike("username", `${mentionQuery}%`)
      : query.order("username", { ascending: true });

    request.then(({ data, error }) => {
      if (!isMounted) return;
      if (error || !data) {
        console.error("Failed to fetch mention suggestions", error);
        setMentionSuggestions([]);
      } else {
        setMentionSuggestions(data as MentionSuggestion[]);
        setMentionHighlightIndex(0);
      }
      setMentionLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [mentionActive, mentionQuery, currentUserId]);

  const resetMentionState = () => {
    setMentionActive(false);
    setMentionQuery("");
    setMentionStart(null);
    setMentionSuggestions([]);
    setMentionHighlightIndex(0);
    setMentionLoading(false);
  };

  const evaluateMentionTrigger = (value: string, cursor: number) => {
    const textBeforeCursor = value.slice(0, cursor);
    const mentionMatch = /(^|[\s.,!?])@([a-zA-Z0-9_]{0,30})$/.exec(textBeforeCursor);

    if (mentionMatch) {
      const queryText = mentionMatch[2];
      const startIndex = cursor - queryText.length - 1;
      setMentionActive(true);
      setMentionQuery(queryText);
      setMentionStart(startIndex);
    } else {
      resetMentionState();
    }
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = event.target;
    setNewComment(value);
    evaluateMentionTrigger(value, selectionStart ?? value.length);
  };

  const handleMentionSelection = (suggestion: MentionSuggestion) => {
    if (mentionStart === null || !textareaRef.current) {
      resetMentionState();
      return;
    }

    const selectionEnd = textareaRef.current.selectionStart ?? newComment.length;
    const before = newComment.slice(0, mentionStart);
    const after = newComment.slice(selectionEnd);
    const insertion = `@${suggestion.username} `;
    const updatedComment = `${before}${insertion}${after}`;

    setNewComment(updatedComment);
    resetMentionState();

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const newCursor = mentionStart + insertion.length;
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionActive || mentionSuggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionHighlightIndex((prev) => (prev + 1) % mentionSuggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionHighlightIndex((prev) =>
        prev === 0 ? mentionSuggestions.length - 1 : prev - 1
      );
    } else if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      event.preventDefault();
      handleMentionSelection(mentionSuggestions[mentionHighlightIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      resetMentionState();
    }
  };

  const handleSubmit = async () => {
    if (!currentUserId) {
      toast.error("You need to sign in to comment.");
      return;
    }
    if (!newComment.trim()) return;

    // Check rate limit (client-side)
    if (!checkLimit()) {
      return; // Rate limited - toast already shown by onLimitExceeded
    }

    setIsPosting(true);
    const body = newComment.trim();
    const { data: insertedCommentId, error } = await supabase.rpc(
      "create_comment_with_rate_limit",
      {
        p_catch_id: catchId,
        p_body: body,
      },
    );

    if (error) {
      if (isRateLimitError(error)) {
        toast.error(getRateLimitMessage(error));
      } else {
        toast.error("Failed to post comment");
      }
      setIsPosting(false);
      return;
    } else {
      const actorName = user?.user_metadata?.username ?? user?.email ?? "Someone";
      setNewComment("");
      resetMentionState();
      if (catchOwnerId && currentUserId !== catchOwnerId) {
        void createNotification({
          userId: catchOwnerId,
          actorId: currentUserId,
          type: "new_comment",
          payload: {
            message: `${actorName} commented on your catch "${catchTitle ?? "your catch"}".`,
            catchId,
            commentId: insertedCommentId ?? undefined,
          },
        });
      }

      const mentionMatches = Array.from(
        new Set(
          Array.from(body.matchAll(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+)/g)).map((match) => match[2])
        )
      );

      if (mentionMatches.length > 0) {
        const { data: mentionedProfiles, error: mentionError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("username", mentionMatches);

        if (!mentionError && mentionedProfiles) {
          await Promise.all(
            mentionedProfiles
              .filter((profileRow) => profileRow.id && profileRow.id !== currentUserId)
              .map((profileRow) =>
                createNotification({
                  userId: profileRow.id,
                  actorId: currentUserId,
                  type: "mention",
                    payload: {
                      message: `${actorName} mentioned you in a comment.`,
                      catchId,
                      commentId: insertedCommentId ?? undefined,
                      extraData: { catch_title: catchTitle },
                    },
                  })
              )
          );
        }
      }

      await fetchComments();
    }
    setIsPosting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentUserId && (
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Share your thoughts... Use @username to mention someone."
                rows={3}
              />
              {mentionActive && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                  <div className="max-h-48 overflow-y-auto">
                    {mentionLoading ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Searching anglers…</p>
                    ) : mentionSuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No anglers found</p>
                    ) : (
                      mentionSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition",
                            index === mentionHighlightIndex ? "bg-muted" : "hover:bg-muted"
                          )}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleMentionSelection(suggestion);
                          }}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={
                                resolveAvatarUrl({
                                  path: suggestion.avatar_path,
                                  legacyUrl: suggestion.avatar_url,
                                }) ?? ""
                              }
                            />
                            <AvatarFallback>
                              {suggestion.username?.[0]?.toUpperCase() ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">@{suggestion.username}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isPosting || isLimited}
                title={isLimited ? `Rate limited. Reset in ${formatResetTime(resetIn)}` : ''}
              >
                {isPosting
                  ? "Posting…"
                  : isLimited
                  ? `Limited (${formatResetTime(resetIn)})`
                  : attemptsRemaining < 30
                  ? `Post Comment (${attemptsRemaining} left)`
                  : "Post Comment"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to share one!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Link
                  to={getProfilePath({ username: comment.profiles?.username, id: comment.user_id })}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
                  aria-label={`View ${comment.profiles?.username ?? "angler"}'s profile`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={
                        resolveAvatarUrl({
                          path: comment.profiles?.avatar_path ?? null,
                          legacyUrl: comment.profiles?.avatar_url ?? null,
                        }) ?? ""
                      }
                    />
                    <AvatarFallback>
                      {comment.profiles?.username?.[0]?.toUpperCase() ?? "A"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={getProfilePath({ username: comment.profiles?.username, id: comment.user_id })}
                      className="font-semibold text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                      aria-label={`View ${comment.profiles?.username ?? "angler"}'s profile`}
                    >
                      {comment.profiles?.username ?? "Unknown angler"}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {highlightMentions(comment.body)}
                  </p>
                  <ReportButton
                    targetType="comment"
                    targetId={comment.id}
                    label="Report"
                    className="-ml-2 text-xs text-muted-foreground hover:text-destructive"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

CatchComments.displayName = "CatchComments";
