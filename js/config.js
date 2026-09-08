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
    MODE: 'cloud',
    BACKEND: 'firebase',   // 'supabase' | 'firebase'

    // ----- Supabase -----
    // Exemple : 'https://abcd1234.supabase.co'
    SUPABASE_URL: '',
    // Cle "anon" du projet Supabase (Parametres -> API Keys).
    SUPABASE_ANON_KEY: '',
    // Valeur de app_secret creee dans cloud/supabase-setup.sql.
    APP_SECRET: '',

    // ----- Firebase -----
    // Exemple : 'https://monprojet-default-rtdb.firebaseio.com'
    FIREBASE_DATABASE_URL: 'https://my-gest-hopital-default-rtdb.firebaseio.com',
    // Cle Web API (Parametres du projet -> Accompagnement des applications -> Cle Web API).
    FIREBASE_API_KEY: 'AIzaSyDHBNtIEWnDGjJ2R_o6lyHMu6dztBYCvQc',

    // ----- Compte ADMIN (global) -----
    // Compte maitre utilise UNIQUEMENT depuis le bouton "COMPTE ADMIN" de
    // l'ecran de demarrage. Il donne acces a la gestion (creation,
    // modification, suppression, supervision, blocage/deblocage) de tous
    // les hopitaux/cliniques de la plateforme. Aucun utilisateur d'hopital
    // ne peut se connecter sur ce compte (compare un hash SHA-256).
    GLOBAL_ADMIN: {
        login: 'FAMA',
        passHash: '3bada7c42bc20631daf5274f0d8ff3e82d8ee09b27dffd7828cda01cd3ab9123',
        nom: 'Compte Maitre'
    }
};

window.APP_CONFIG = APP_CONFIG;