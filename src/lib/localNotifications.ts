export type LocalNotification = {
  id: string;
  title: string;
  description: string;
  type: string;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "mnr_local_notifications";
const MAX_NOTIFICATIONS = 100;
const listeners = new Set<(notifications: LocalNotification[]) => void>();
const badgeUnreadCounts: Record<"local" | "activity", number | null> = {
  local: 0,
  activity: null,
};

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function notificationText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value.map(notificationText).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object" && "props" in value) {
    const props = value.props;
    if (props && typeof props === "object" && "children" in props) {
      return notificationText(props.children);
    }
  }
  return "";
}

function isLocalNotification(value: unknown): value is LocalNotification {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LocalNotification>;
  return typeof item.id === "string"
    && typeof item.title === "string"
    && typeof item.description === "string"
    && typeof item.type === "string"
    && typeof item.createdAt === "string"
    && typeof item.read === "boolean";
}

export function getLocalNotifications(): LocalNotification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.error("Stored app notifications have an invalid format.");
      return [];
    }
    return parsed.filter(isLocalNotification);
  } catch (error) {
    console.error("Unable to load app notifications:", error);
    return [];
  }
}

function syncAppBadge() {
  if (typeof navigator === "undefined") return;
  const appNavigator = navigator as BadgeNavigator;
  const unreadCount = badgeUnreadCounts.activity ?? badgeUnreadCounts.local ?? 0;
  const update = unreadCount > 0
    ? appNavigator.setAppBadge?.(unreadCount)
    : appNavigator.clearAppBadge
      ? appNavigator.clearAppBadge()
      : appNavigator.setAppBadge?.(0);

  update?.catch((error: unknown) => {
    console.warn("Unable to update the PWA icon badge:", error);
  });
}

export function setNotificationBadgeCount(source: "local" | "activity", count: number | null) {
  badgeUnreadCounts[source] = count === null || !Number.isFinite(count)
    ? null
    : Math.max(0, Math.floor(count));
  syncAppBadge();
}

function saveNotifications(notifications: LocalNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error("Unable to save app notifications:", error);
  }
  setNotificationBadgeCount("local", notifications.filter((notification) => !notification.read).length);
  listeners.forEach((listener) => listener(notifications));
  window.dispatchEvent(new CustomEvent("mnr-local-notifications", { detail: notifications }));
}

export function subscribeLocalNotifications(listener: (notifications: LocalNotification[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addLocalNotification(title: string, description = "", type = "normal") {
  const notifications = getLocalNotifications();
  const notification: LocalNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: title || "In-app alert",
    description,
    type,
    createdAt: new Date().toISOString(),
    read: false,
  };
  const updated = [notification, ...notifications];
  const unread = updated.filter((item) => !item.read);
  const read = updated.filter((item) => item.read).slice(0, Math.max(0, MAX_NOTIFICATIONS - unread.length));
  saveNotifications([...unread, ...read]);
}

export function markLocalNotificationRead(id: string) {
  const notifications = getLocalNotifications();
  saveNotifications(notifications.map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification
  ));
}

export function markAllLocalNotificationsRead() {
  saveNotifications(getLocalNotifications().map((notification) => ({ ...notification, read: true })));
}

export function clearLocalNotifications() {
  saveNotifications([]);
}

export function restoreLocalNotificationBadge() {
  setNotificationBadgeCount("local", getLocalNotifications().filter((notification) => !notification.read).length);
}
