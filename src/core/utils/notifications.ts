
export const NOTIFICATION_MESSAGES = [
  "Track your cash, keep it from a crash!",
  "Save a bit more, stay away from poverty's door.",
  "Check your spend, make your budget your best friend.",
  "Little savings grow tall, so don't let your balance fall.",
  "Managing expense is true sense, savings brings you defense."
];

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function showNotification(message: string) {
  if (Notification.permission === "granted") {
    new Notification("Smart Spend", {
      body: message,
      icon: "/favicon.ico"
    });
  }
}
