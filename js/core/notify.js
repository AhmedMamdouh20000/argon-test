// إشعارات المتصفح (Web Notifications API)

export function isNotifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotifyPermission() {
  if (!isNotifySupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotifyPermission() {
  if (!isNotifySupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendBrowserNotification(title, body = '', tag = 'mukhattati') {
  if (!isNotifySupported() || Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, {
      body,
      dir: 'rtl',
      lang: 'ar',
      icon: 'icons/icon-192.png',
      tag
    });
  } catch {
    return null;
  }
}
