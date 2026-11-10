import { useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  clearLocalNotifications,
  getLocalNotifications,
  LocalNotification,
  markAllLocalNotificationsRead,
  markLocalNotificationRead,
  restoreLocalNotificationBadge,
  subscribeLocalNotifications,
} from "@/lib/localNotifications";

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function LocalNotificationCenter() {
  const [notifications, setNotifications] = useState<LocalNotification[]>(getLocalNotifications);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    restoreLocalNotificationBadge();
    const unsubscribe = subscribeLocalNotifications(setNotifications);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "mnr_local_notifications") {
        setNotifications(getLocalNotifications());
        restoreLocalNotificationBadge();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-foreground/70 hover:text-foreground hover:bg-foreground/5"
          title="App alerts"
          aria-label={`App alerts${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(28rem,calc(100vw-2rem))] sm:w-[28rem] p-0 max-h-[75vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-semibold">
            App alerts <span className="text-muted-foreground">({unreadCount} unread)</span>
          </div>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllLocalNotificationsRead}>
                <CheckCheck className="mr-1 h-4 w-4" /> Mark read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearLocalNotifications} aria-label="Clear all app alerts">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No app alerts yet.</p>
          ) : notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markLocalNotificationRead(notification.id)}
              className={`w-full border-b px-4 py-3 text-left hover:bg-muted/60 ${notification.read ? "" : "bg-primary/5"}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-medium">{notification.title}</span>
                {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </span>
              {notification.description && (
                <span className="mt-1 block text-sm text-muted-foreground">{notification.description}</span>
              )}
              <span className="mt-1 block text-xs text-muted-foreground">{formatTime(notification.createdAt)}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
