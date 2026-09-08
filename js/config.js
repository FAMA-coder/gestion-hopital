// ============================================================
// js/config.js — Configuration de l'application
// ------------------------------------------------------------
// MODE :
//   'local'  => base de donnees dans le navigateur (IndexedDB),
//               aucun serveur necessaire.
//   'cloud'  => base de donnees centrale partagee hebergee sur
//               Supabase OU Firebase (voir cloud/DEPLOIEMENT.md).
//
// BACKEND (en mode 'cloud') :
//   'supabase' => renseigner SUPABASE_URL, SUPABASE_ANON_KEY et
//                 APP_SECRET (cle creee par le script SQL).
//   'firebase' => renseigner FIREBASE_DATABASE_URL et
//                 FIREBASE_API_KEY (cle Web API du projet).
// ============================================================
const APP_CONFIG = {
    MODE: 'local',
    BACKEND: 'supabase',   // 'supabase' | 'firebase'

    // ----- Supabase -----
    // Exemple : 'https://abcd1234.supabase.co'
    SUPABASE_URL: '',
    // Cle "anon" du projet Supabase (Parametres -> API Keys).
    SUPABASE_ANON_KEY: '',
    // Valeur de app_secret creee dans cloud/supabase-setup.sql.
    APP_SECRET: '',

    // ----- Firebase -----
    // Exemple : 'https://monprojet-default-rtdb.firebaseio.com'
    FIREBASE_DATABASE_URL: '',
    // Cle Web API (Parametres du projet -> Accompagnement des applications -> Cle Web API).
    FIREBASE_API_KEY: ''
};

window.APP_CONFIG = APP_CONFIG;