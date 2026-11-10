import { toast as sonnerToast } from "sonner";
import { addLocalNotification, notificationText } from "@/lib/localNotifications";

const recordedMethods = new Set<PropertyKey>([
  "success",
  "info",
  "warning",
  "error",
  "custom",
  "message",
  "promise",
  "loading",
]);

function recordSonnerToast(method: PropertyKey, args: unknown[]) {
  const options = args[1] && typeof args[1] === "object"
    ? args[1] as { description?: unknown; loading?: unknown }
    : undefined;
  const message = method === "promise"
    ? notificationText(options?.loading) || "Processing"
    : method === "custom"
      ? "Custom alert"
      : notificationText(args[0]) || "In-app alert";
  addLocalNotification(
    message,
    notificationText(options?.description),
    typeof method === "string" ? method : "normal"
  );
}

export const toast: typeof sonnerToast = new Proxy(sonnerToast, {
  apply(target, thisArg, args: unknown[]) {
    recordSonnerToast("normal", args);
    return Reflect.apply(target, thisArg, args);
  },
  get(target, property, receiver) {
    const method = Reflect.get(target, property, receiver);
    if (typeof method !== "function" || !recordedMethods.has(property)) return method;
    return (...args: unknown[]) => {
      recordSonnerToast(property, args);
      return Reflect.apply(method, target, args);
    };
  },
});
