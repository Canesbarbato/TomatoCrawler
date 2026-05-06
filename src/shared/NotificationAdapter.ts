/**
 * NotificationAdapter.ts
 * Platform abstraction stub for browser/OS notifications.
 * Replace body with Capacitor LocalNotifications or Electron Notification API
 * behind this same interface — no game code changes required.
 */

export interface INotificationAdapter {
  requestPermission(): Promise<boolean>;
  schedule(title: string, body: string, delayMs: number): void;
}

class WebNotificationAdapter implements INotificationAdapter {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  schedule(title: string, body: string, delayMs: number): void {
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }, delayMs);
  }
}

export const NotificationAdapter: INotificationAdapter = new WebNotificationAdapter();
