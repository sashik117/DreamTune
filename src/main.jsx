import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/i18n'

const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (window.Capacitor?.isNativePlatform?.() || isLocalPreview) {
  document.documentElement.classList.add('capacitor-native');
}

if (isLocalPreview) {
  document.documentElement.classList.add('dreamtune-local-preview');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => caches?.keys?.())
    .then((keys = []) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => {});
}
