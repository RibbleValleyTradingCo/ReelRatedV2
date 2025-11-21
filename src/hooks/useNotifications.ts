import { useCallback, useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
} from "@/lib/notifications";
import { toast } from "sonner";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const useNotifications = (userId: string | null | undefined, limit = 50) => {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const data = await fetchNotifications(userId, limit);
    setNotifications(data);
    setLoading(false);
  }, [limit, userId]);

  const markOne = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      await markNotificationAsRead(notificationId, userId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }
            : item
        )
      );
    },
    [userId]
  );

  const markAll = useCallback(async () => {
    if (!userId || markingAll) return;
    setMarkingAll(true);
    try {
      const result = await markAllNotificationsAsRead(userId);
      if (!result) {
        toast.error("Unable to mark notifications as read. Please try again.");
        return;
      }
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }))
      );
    } catch (error) {
      console.error("Failed to mark notifications as read", error);
      toast.error("Unable to mark notifications as read. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, userId]);

  const clearAll = useCallback(async () => {
    if (!userId || clearingAll) return;
    setClearingAll(true);
    try {
      const success = await clearAllNotifications(userId);
      if (!success) {
        toast.error("Unable to clear notifications. Please try again.");
        return;
      }
      setNotifications([]);
    } catch (error) {
      console.error("Failed to clear notifications", error);
      toast.error("Unable to clear notifications. Please try again.");
    } finally {
      setClearingAll(false);
    }
  }, [clearingAll, userId]);

  return {
    notifications,
    setNotifications,
    loading,
    markingAll,
    clearingAll,
    refresh,
    markOne,
    markAll,
    clearAll,
  };
};
