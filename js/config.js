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
    //
    // SECURITE : le mot de passe n'existe qu'en SHA-256 ci-dessous. Il ne
    // figure en clair dans aucun fichier servi (afficher la source ne
    // donne donc plus acces au compte maitre) :
    //   - console ADMIN global : comparaison directe avec cette empreinte ;
    //   - compte « FAMA » de la base : meme empreinte reappliquee au
    //     demarrage (SampleData.ensureMaitre), comme pour « admin ».
    // Changer le mot de passe = remplacer cette empreinte par
    // SHA-256 du nouveau mot de passe (en minuscules, 64 caracteres).
    GLOBAL_ADMIN: {
        login: 'FAMA',
        passHash: '21ee22b2761b19fd2777e370b936f216cec013b4c0048ff5b0a468234a796cf2',
        nom: 'Compte Maitre'
    },

    // ----- Jeu de demonstration -----
    // false : la base reste VIDE. Aucun patient, consultation, lit ni
    //         compte de demonstration n'est cree automatiquement.
    //         Seuls le compte maitre (FAMA) et le compte admin sont
    //         crees, puis reinitialises a chaque demarrage.
    // true  : comportement historique : le jeu de demonstration est
    //         charge au premier lancement (utile pour une formation).
    SEED_DEMO: false,

    // ----- Comptes livres (empreintes SHA-256) -----
    // Meme principe que GLOBAL_ADMIN : aucun mot de passe en clair dans
    // les fichiers servis. Ces comptes sont livres avec des donnees de
    // demonstration ; leurs mots de passe restent notes dans un fichier
    // local non publie (build/mots-de-passe.txt).
    //
    // Avec SEED_DEMO = false, cette liste sert uniquement a fixer le
    // mot de passe du compte admin, qui est reinitialise a chaque
    // demarrage. Les autres comptes de demonstration ont ete retires.
    //
    // Changer un mot de passe = remplacer l'empreinte par
    // SHA-256 du nouveau mot de passe (en minuscules, 64 caracteres).
    COMPTES_DEMO: {
        admin: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
    }
};

window.APP_CONFIG = APP_CONFIG;