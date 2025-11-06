import { useCallback } from "react";

export type NotificationType = "success" | "error" | "info";

export interface NotificationPayload {
  type: NotificationType;
  message: string;
}

/**
 * Minimal notification hook used throughout the app. For now, it simply logs messages to the console
 * and falls back to `alert` for errors to provide user feedback when no dedicated UI is present.
 */
export function useNotifications() {
  const addNotification = useCallback(({ type, message }: NotificationPayload) => {
    const prefix = `[${type.toUpperCase()}]`;
    if (type === "error") {
      console.error(prefix, message);
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(message);
      }
      return;
    }

    console.log(prefix, message);
  }, []);

  return { addNotification };
}
