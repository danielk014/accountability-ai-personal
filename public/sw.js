// Accountable Service Worker — handles push notifications and background reminder checks

const DB_NAME = 'accountable-sw';
const STORE = 'reminders';

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveReminders(reminders) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  store.clear();
  for (const r of reminders) store.put(r);
  return new Promise((resolve) => { tx.oncomplete = resolve; });
}

async function loadReminders() {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

// ── SW lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Messages from the main app ─────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, reminders } = event.data || {};

  if (type === 'SYNC_REMINDERS' && Array.isArray(reminders)) {
    // Store latest reminders so SW can check them when app is not open
    saveReminders(reminders);
  }

  if (type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title || 'Accountable', {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'reminder',
      requireInteraction: false,
    });
  }
});

// ── Periodic background sync — check reminders when browser wakes SW ───────────
// (Chrome only, requires site to be added to home screen / installed as PWA)

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndFireReminders());
  }
});

async function checkAndFireReminders() {
  const reminders = await loadReminders();
  if (!reminders.length) return;

  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();

  for (const r of reminders) {
    if (r.fired) continue;

    let shouldFire = false;

    if (r.type === 'daily' && r.time) {
      const [rh, rm] = r.time.split(':').map(Number);
      // Fire if within 5 minutes of scheduled time (periodic sync isn't exact)
      const diff = Math.abs((hh * 60 + mm) - (rh * 60 + rm));
      shouldFire = diff <= 5;
    } else if (r.type === 'once' && r.datetime) {
      shouldFire = now >= new Date(r.datetime);
    }

    if (shouldFire) {
      // Check if any app window is already open and visible
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appOpen = windowClients.some(c => c.visibilityState === 'visible');
      if (appOpen) continue; // app will handle it

      await self.registration.showNotification('Accountable reminder', {
        body: r.text,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: `reminder-${r.id}`,
        requireInteraction: true,
      });
    }
  }
}

// ── Push events from backend (requires VAPID/server setup) ────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'Accountable', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Accountable', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'reminder',
      requireInteraction: false,
    })
  );
});

// ── Notification click → open / focus the app ─────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
