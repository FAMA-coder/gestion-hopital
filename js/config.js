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

    // ----- Comptes de demonstration (empreintes SHA-256) -----
    // Meme principe que GLOBAL_ADMIN : aucun mot de passe en clair dans
    // les fichiers servis. Ces comptes sont livres avec des donnees de
    // demonstration ; leurs mots de passe restent notes dans un fichier
    // local non publie (build/mots-de-passe.txt).
    //
    // Rappel : « admin » est reinitialise a cette empreinte a chaque
    // demarrage (SampleData.ensureAdmin). Tout changement de mot de passe
    // fait dans Parametres -> Utilisateurs est donc annule au redemarrage :
    // c'est le comportement historique, preserve ici.
    //
    // Changer un mot de passe = remplacer l'empreinte par
    // SHA-256 du nouveau mot de passe (en minuscules, 64 caracteres).
    COMPTES_DEMO: {
        admin: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        dr_mukendi: '2e4e70b3503b8b88bb6e7ace3b31c61b541adaf83db4e6313b6550ad01284b18',
        dr_kabila: '2e4e70b3503b8b88bb6e7ace3b31c61b541adaf83db4e6313b6550ad01284b18',
        dr_lukusa: '2e4e70b3503b8b88bb6e7ace3b31c61b541adaf83db4e6313b6550ad01284b18',
        dr_chirurgien: '2e4e70b3503b8b88bb6e7ace3b31c61b541adaf83db4e6313b6550ad01284b18',
        infirmier1: '46eaec71494d8585c7921b037038c9cc996ab67f3c51cc4488e69f13f327ddcf',
        pharmacie: '47a0df34426c6c34a4ee69b75e8a5c31872cddc43df8fbe5d84a020ca5a3c623',
        laboratoire: '3705b578e8fcb1b82a94ad917881ec248bbd4111645e91aed3c19af12d82116f',
        radiologue: '4dc732eea7c619844f36f757216665499aff03a701c131fa6ca3995db645d4c5',
        caissier: '996ceb701a2aee908aa326b07f38768e16ccf99e621bd2319e46b19319391200',
        secretaire: 'ee63c6506c68d4613b9553820393f22db66a1dbc9ba6dc5640df9fce741e6258'
    }
};

window.APP_CONFIG = APP_CONFIG;