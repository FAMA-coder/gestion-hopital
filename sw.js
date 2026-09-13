/* ============================================================
   sw.js — Service Worker (Gestion Hospitaliere)
   Strategie : cache-first pour les ressources statiques (shell)
   + reseau en secours ; les donnees restent dans IndexedDB.
   ============================================================ */
const VERSION = 'gesthopital-v11';
const PRECACHE = [
  './index.html',
  './manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/db.js',
  'js/auth.js',
  'js/ui.js',
  'js/meta.js',
  'js/storage.js',
'js/auto_backup.js',
    'js/config.js',
    'js/remote_db.js',
    'js/tenant.js',
    'js/sample_data.js',
  'js/init.js',
  'js/install.js',
  'js/excel.js',
  'js/charts.js',
  'js/print.js',
  'js/billing.js',
  'js/core/router.js',
  'js/core/state.js',
  'js/core/events.js',
  'js/core/cache.js',
  'js/core/logger.js',
  'js/modules/dashboard.js',
  'js/modules/receptions.js',
  'js/modules/admissions.js',
  'js/modules/patients.js',
  'js/modules/consultations.js',
  'js/modules/urgences.js',
  'js/modules/hospitalisations.js',
  'js/modules/services.js',
  'js/modules/tarifs.js',
  'js/modules/pharmacie.js',
  'js/modules/laboratoire.js',
  'js/modules/imagerie.js',
  'js/modules/chirurgie.js',
  'js/modules/personnel.js',
  'js/modules/remunerations.js',
  'js/modules/contrats.js',
  'js/modules/depenses.js',
  'js/modules/facturation.js',
  'js/modules/paiements.js',
  'js/modules/documents.js',
  'js/modules/reporting.js',
  'js/modules/parametres.js',
  'js/modules/aide.js',
  'js/modules/global_admin.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/favicon.png'
];

// Installation : precharger le "shell" de l'application
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activation : nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Interception : cache d'abord, puis reseau
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'default')) {
          const copy = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return resp;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      });
    })
  );
});