// Browser notification helper — wraps Notification API + Service Worker

let _swReg = null;

// ── Init: register SW, request permission ──────────────────────────────────────

export async function initNotifications() {
  if (!('serviceWorker' in navigator)) return;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Try to register periodic background sync (Chrome only, requires PWA install)
    if (_swReg.periodicSync) {
      try {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          await _swReg.periodicSync.register('check-reminders', { minInterval: 15 * 60 * 1000 });
        }
      } catch {
        // Periodic sync not supported — that's OK
      }
    }
  } catch (err) {
    console.warn('[notifications] SW registration failed:', err);
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// ── Show a notification — uses SW if available, else falls back to window.Notification

export function showBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const opts = {
      body,
      icon: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png',
      badge: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png',
      vibrate: [200, 100, 200],
      tag: 'reminder',
      requireInteraction: false,
    };
    if (_swReg?.showNotification) {
      _swReg.showNotification(title, opts);
    } else {
      new Notification(title, opts);
    }
  } catch (err) {
    console.warn('[notifications] showBrowserNotification failed:', err);
  }
}

// ── Sync reminder list to SW so it can check them when tab is closed ───────────

export function syncRemindersToSW(reminders) {
  if (!navigator.serviceWorker?.controller) return;
  try {
    navigator.serviceWorker.controller.postMessage({ type: 'SYNC_REMINDERS', reminders });
  } catch {
    // SW not ready yet — will sync on next check
  }
}
