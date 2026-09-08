# Déploiement sur serveur (mode cloud) — Gestion Hospitalière

Cette application est un site statique (HTML/JS/CSS) qui stocke normalement ses
données dans le navigateur. Le **mode cloud** active une **base centrale partagée** :
tous les postes de la clinique utilisent alors **les mêmes données**, hébergées sur
**Supabase** (PostgreSQL) ou **Firebase** (Realtime Database), l'interface étant
servie par un hébergeur statique gratuit (GitHub Pages, Netlify, …).

```
 Navigateur (le site)                 Internet
 [ GestHopital ]  ---fetch----->  [ Base partagée (Supabase / Firebase) ]
        |                                  |
   js/config.js                       données centralisées,
   APP_CONFIG.MODE='cloud'            vues par tous les postes
```

> **Déjà sur Firebase ?** Utilisez la section « Version Firebase » ci-dessous
> (base `Realtime Database` + authentification anonyme).

---

## 1. Créer la base centrale (Supabase — gratuit, 10 min)

1. Aller sur https://supabase.com et créer un compte (email).
2. Créer un **New project** (nom : `gesthopital`, région proche : ex. `Frankfurt (eu-central-1)`, **mot de passe de la base à conserver** dans un endroit sûr).
3. Dans le projet : **SQL Editor → New query**.
4. Ouvrir le fichier `cloud/supabase-setup.sql`, **remplacer** sur la dernière ligne la valeur
   `REMPLACEZ_PAR_VOTRE_CLE_SECRETE` par une longue chaîne aléatoire (ex. 40 caractères),
   puis **Run**.
5. Récupérer dans **Paramètres → API** :
   - `Project URL` (ex. `https://abcd1234.supabase.co`)
   - `anon public` (clé anon, commence par `eyJ...`)

## 2. Configurer l'application

Éditer `js/config.js` :

```js
const APP_CONFIG = {
    MODE: 'cloud',                     // 'local' ou 'cloud'
    BACKEND: 'supabase',               // 'supabase' | 'firebase'
    SUPABASE_URL: 'https://...supabase.co',   // Project URL
    SUPABASE_ANON_KEY: 'eyJ...',             // clé anon
    APP_SECRET: 'VOTRE_CLE_SECRETE'           // celle du script SQL
};
```

> Le mode `local` (IndexedDB) reste utilisable pour tester hors ligne ; repassé
> à `cloud`, tout le monde partage la base.

## 2bis. Version Firebase (Realtime Database)

Si vous êtes déjà sur Firebase :

1. **Console Firebase** → votre projet → **Realtime Database** → **Créer une base de données**
   (mode « Mode verrouillé », sur l'offre gratuite Spark).
2. **Rules** → coller les règles suivantes (accès réservé aux sessions anonymes,
   identifiées par l'application) puis **Publish** :
   ```json
   { "rules": { ".read": "auth != null", ".write": "auth != null" } }
   ```
3. **Build → Authentication → Sign-in method → Anonyme → Activer** (obligatoire :
   l'application s'identifie ainsi, un jeton par navigateur).
4. Récupérer :
   - l'**URL de la base** Realtime Database (ex. `https://monprojet-default-rtdb.firebaseio.com`),
   - la **clé Web API** du projet (Paramètres → Général → clé d'API Web).
5. Renseigner `js/config.js` :
   ```js
   const APP_CONFIG = {
       MODE: 'cloud',
       BACKEND: 'firebase',
       FIREBASE_DATABASE_URL: 'https://monprojet-default-rtdb.firebaseio.com',
       FIREBASE_API_KEY: 'AIza...'
   };
   ```

## 3. Héberger le site (GitHub Pages ou Netlify — gratuit)

**Via GitHub Pages** (si vous disposez d'un compte GitHub) :
1. Créer un dépôt **privé** (ex. `gesthopital`) et y verser le contenu de
   `GestionHospitaliere/` (avec `js/config.js` déjà rempli).
2. Dépôt → **Settings → Pages** → Source : **Deploy from a branch**, branche
   `main`, dossier **root** → **Save**.
3. L'URL est `https://<utilisateur>.github.io/<depot>/`.

**Via Netlify** :

1. Construire un dossier à déployer avec uniquement le site :
   `index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`
   (le dossier `cloud/` n'est pas nécessaire sur l'hébergeur).
2. Sur https://app.netlify.com → **Drop** → glisser-déposer ce dossier.
3. Après déploiement, Netlify fournit l'adresse **URL de l'application**
   (ex. `https://gesthopital.netlify.app`).

Alternatives : **Vercel** (`vercel` CLI ou import dossier), **Cloudflare Pages**.

## 4. Valider

1. Ouvrir l'URL de l'application.
2. Se connecter avec le compte maître : `FAMA` / `aminatN1FA@`.
3. Créer une donnée (ex. un patient) sur un poste, puis vérifier sur un second
   poste après un rechargement (F5) qu'elle apparaît. La base est partagée.

---

# FICHE DE CONNEXION ET DE GESTION

## Mise en ligne effective

| Elément                                   | Valeur                                                          |
|-------------------------------------------|-----------------------------------------------------------------|
| **Hébergeur du site**                     | GitHub Pages (dépôt `gestion-hopital` de `FAMA-coder`)          |
| **Dépôt**                                 | https://github.com/FAMA-coder/gestion-hopital                   |
| **Backend de données**                    | **Firebase Realtime Database** (projet `my-gest-hopital`)       |
| **Base Realtime**                         | https://my-gest-hopital-default-rtdb.firebaseio.com             |
| **Authentification base**                 | Firebase Auth **anonyme** (fournisseur « Anonyme » activé)      |
| **Règles de la base**                     | `{ "rules": { ".read": "auth != null", ".write": "auth != null" } }` |
| **Clé Web API**                           | dans `js/config.js` → `FIREBASE_API_KEY`                        |

> Les valeurs de connexion sont centralisées dans `js/config.js` (mode `cloud`,
> backend `firebase`). Pour changer de base : modifier ce fichier puis repousser
> sur le dépôt GitHub.

## Informations de connexion

| Elément                                   | Valeur                                                               |
|-------------------------------------------|----------------------------------------------------------------------|
| **URL de l'application**                  | https://FAMA-coder.github.io/gestion-hopital/                        |
| **Serveur de données**                    | Firebase Realtime Database — https://my-gest-hopital-default-rtdb.firebaseio.com |
| **Compte maître (super administrateur)**  | Utilisateur : `FAMA` — Mot de passe : `aminatN1FA@`                  |
| **Compte administrateur**                 | Utilisateur : `admin` — Mot de passe : `admin123`                    |
| **Comptes de démonstration**              | `dr_mukendi`/`med123`, `infirmier1`/`inf123`, `pharmacie`/`pharm123` |

Le compte **FAMA** est invisible et intouchable par tout autre compte ; lui seul
peut saisir/modifier les informations de l'hôpital dans **Paramètres → Hôpital**.

## Règles de gestion importantes

- **Une seule source de vérité** : les données sont centralisées. Dernière
  écriture gagnante en cas d'édition simultanée du même enregistrement.
- **Lecture différée** : les listes sont mises en cache ~5 minutes côté
  navigateur. Recharger (F5) pour voir les modifications des autres postes.
- **Sauvegardes** : Paramètres → Sauvegarde (export/import JSON), ou sauvegarde
  automatique (Sauvegarde → activer). Faites un export régulier, et conservez une
  copie du mot de passe de la base (Supabase) / du projet (Firebase).

## Migration d'une base locale existante vers le cloud

1. Sur l'ancien poste **en local** : onglet **Sauvegarde → Exporter** (fichier JSON).
2. Après déploiement cloud : onglet **Sauvegarde → Restaurer** et choisir ce fichier.
3. Le script de seed recrée automatiquement les comptes `FAMA` et `admin`
   manquants.

## Sécurité (à connaître)

- L'application embarque ses clés d'accès dans `js/config.js` : toute personne
  disposant de ces valeurs peut accéder aux données. Considérez-les comme
  confidentielles à l'équipe (idéalement dépôt GitHub **privé**).
- **Note déploiement actuel** : le dépôt `gestion-hopital` est actuellement
  **public** (le jeton GitHub ne permettait pas de créer un dépôt privé). La
  clé Web API seule ne donne pas accès à la base (les règles exigent
  `auth != null`), mais passer le dépôt en privé est recommandé : attention,
  l'adresse Pages ne sera alors consultable que par les comptes GitHub invités
  comme collaborateurs du dépôt.
- **Supabase — rotation du secret** : dans Supabase (SQL Editor), exécuter
  `update public.app_config set valeur='NOUVELLE_CLE' where cle='app_secret';`
  puis modifier `APP_SECRET` dans `js/config.js` et redéployer.
- **Firebase** : l'accès passe par l'authentification anonyme (les règles
  exigent `auth != null`). Activez **uniquement** le fournisseur « Anonyme ».
- Évolution recommandée si besoin d'une protection par compte utilisateur :
  lier les comptes de l'application à ceux du fournisseur (Supabase Auth /
  Firebase Authentication).

## Dépannage

| Symptôme                                    | Cause / action                                                  |
|---------------------------------------------|-----------------------------------------------------------------|
| « Stockage distant (HTTP 401) »             | Supabase : secret erroné (`APP_SECRET`). Firebase : clé/règles. |
| « Stockage distant (HTTP 403) »             | Firebase : règles ou auth anonyme non activée.                  |
| « Stockage distant (HTTP 404) »             | Supabase : SQL non exécuté. Firebase : URL de base erronée.     |
| « Connexion Firebase impossible »           | `FIREBASE_API_KEY` invalide ou « Anonyme » désactivée.          |
| Page blanche à la connexion cloud           | Vérifier la console (F12) ; mode `cloud` sans URL renseignée.   |
| Deux postes ne voient pas leurs données     | Recharger la page ; vérifier que les deux utilisent le même `APP_CONFIG`. |