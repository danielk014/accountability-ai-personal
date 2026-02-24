import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initNotifications, requestNotificationPermission } from '@/lib/notifications'

// Register service worker and request notification permission as early as possible
initNotifications().then(() => {
  // Request permission after a short delay so it doesn't pop immediately on load
  setTimeout(requestNotificationPermission, 3000);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
