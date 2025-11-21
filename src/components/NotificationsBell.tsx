import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationListItem, type NotificationRow } from "@/components/notifications/NotificationListItem";
import { resolveNotificationPath } from "@/lib/notifications-utils";
import { cn } from "@/lib/utils";

interface NotificationsBellProps {
  buttonClassName?: string;
  iconClassName?: string;
  badgeClassName?: string;
}

export const NotificationsBell = ({
  buttonClassName,
  iconClassName,
  badgeClassName,
}: NotificationsBellProps) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const limit = 25;

  const {
    notifications,
    setNotifications,
    loading: isLoading,
    refresh,
    markOne,
    markAll,
    clearAll,
    markingAll,
    clearingAll,
  } = useNotifications(user?.id ?? null, limit);

  useEffect(() => {
    if (!authLoading && user) {
      void refresh();
    }
  }, [authLoading, refresh, user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:user:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as NotificationRow;
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            if (existingIds.has(newNotification.id)) return prev;
            return [newNotification, ...prev].slice(0, limit);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [limit, setNotifications, user]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      void refresh();
    }
  };

  const handleMarkAsRead = useCallback(
    (notification: NotificationRow) => {
      if (!notification.is_read) {
        void markOne(notification.id);
      }
    },
    [markOne]
  );

  const handleNavigate = useCallback(
    (notification: NotificationRow) => {
      if (!notification.is_read) {
        void markOne(notification.id);
      }

      const destination = resolveNotificationPath(notification);
      if (destination) {
        navigate(destination);
        setOpen(false);
      }
    },
    [markOne, navigate]
  );

  const handleMarkAllClick = useCallback(() => {
    if (unreadCount > 0 && !markingAll) {
      void markAll();
    }
  }, [markAll, markingAll, unreadCount]);

  const handleClearAll = useCallback(() => {
    if (!clearingAll) {
      void clearAll();
    }
  }, [clearAll, clearingAll]);

  if (authLoading || !user) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "group relative h-10 w-10 rounded-xl border border-transparent bg-white/0 transition-colors hover:bg-slate-100 md:h-11 md:w-11",
            buttonClassName,
          )}
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Open notifications"
          aria-expanded={open}
        >
          <Bell
            className={cn(
              "h-5 w-5 text-slate-600 transition-colors group-hover:text-primary md:h-6 md:w-6",
              iconClassName,
            )}
          />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md ring-2 ring-white",
                badgeClassName,
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[70] w-80 p-0" align="end">
        <div className="border-b px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 text-xs"
                onClick={() => {
                  void refresh();
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Loading
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 text-xs text-destructive"
                onClick={handleClearAll}
                disabled={notifications.length === 0 || clearingAll}
              >
                {clearingAll ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    Clearing…
                  </>
                ) : (
                  "Clear all"
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Stay up to date with the latest activity on your catches.</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={handleMarkAllClick}
              disabled={unreadCount === 0 || markingAll}
            >
              {markingAll ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Working…
                </>
              ) : (
                "Mark all read"
              )}
            </Button>
          </div>
        </div>
        <div className="p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              You’re all caught up!
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    onView={handleNavigate}
                    onMarkRead={handleMarkAsRead}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
