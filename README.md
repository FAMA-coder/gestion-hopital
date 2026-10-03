# Gestion Hospitaliere

Application web de gestion complete d'un hopital moyen (HTML/CSS/JS vanilla + IndexedDB).

## Deploiement

L'application utilise des modules JavaScript (ES modules). Pour qu'elle fonctionne
correctement, il faut la servir via un serveur local (l'ouverture directe du fichier
`index.html` avec le protocole `file://` bloque les modules dans la plupart des navigateurs).

**Methode recommandee :** double-cliquer sur `lancer.bat` (Windows). Ce script demarre
un serveur web local et ouvre automatiquement l'application dans votre navigateur.

Alternative manuelle : lancer un serveur statique a la racine du projet, par exemple :
`python -m http.server 8080`, puis ouvrir `http://localhost:8080`.

## Comptes et base de donnees

La base est **vide** : `js/config.js` contient `SEED_DEMO: false`, donc
l'application ne cree plus aucun patient, consultation, lit, service ni compte
de demonstration. Elle cree uniquement :

| Utilisateur | Role | Origine |
|-------------|------|---------|
| FAMA | Compte maitre de la plateforme (bouton « COMPTE ADMIN » de l'ecran de demarrage) | `GLOBAL_ADMIN.passHash` |
| admin | Administrateur de l'hopital | `COMPTES_DEMO.admin` |

Ce sont les seuls comptes livres. Les autres utilisateurs se creent dans
**Parametres -> Utilisateurs**, avec le mot de passe de leur choix.

Aucun mot de passe n'est ecrit en clair dans les fichiers servis : chaque
compte est stocke sous forme d'empreinte SHA-256 dans `js/config.js`. Les
mots de passe sont notes dans un fichier **local et non publie** :
`build/mots-de-passe.txt` (le serveur local repond 403 sur `build/`, et le
fichier est absent du depot Git). Ne pas le copier dans un depot ni le diffuser.

Deux consequences a garder en tete :

- `admin` est **reinitialise** a son empreinte de configuration a chaque
  demarrage : un mot de passe change dans Parametres -> Utilisateurs est donc
  annule au redemarrage. C'est voulu, pour qu'un poste fraichement installe
  puisse toujours se connecter. Les autres comptes, eux, conservent leur mot de
  passe, et les anciens hachages 32 bits sont convertis en SHA-256 a la
  premiere connexion.
- Pour changer le mot de passe de `admin` : remplacer l'empreinte dans
  `js/config.js` par `SHA-256 du nouveau mot de passe` (minuscules, 64
  caracteres), puis relancer `Mettre-a-jour.bat` sur les postes installes.

Pour recharger le jeu de demonstration (formation, essais) : mettre
`SEED_DEMO: true` dans `js/config.js`, puis vider la base depuis
**Parametres -> Donnees**.

## Modules

1. **Tableau de bord** - Statistiques, graphiques (admissions/consultations par mois, revenus, répartition services), occupation lits
2. **Admissions** - Enregistrement des patients hospitalises
3. **Patients** - Dossiers patients complets
4. **Consultations** - Suivi des consultations medicales
5. **Urgences** - Triage et file d'attente des urgences
6. **Hospitalisations** - Suivi avec observations quotidiennes (temp, TA, pouls, traitement)
7. **Services & Lits** - Gestion des services et plan des lits
8. **Pharmacie** - Stock, ordonnances detaillees (lignes medicaments), dispensation, alertes, entrees stock
9. **Laboratoire** - Demandes d'examens et resultats
10. **Imagerie** - Examens radiologiques et comptes-rendus
11. **Chirurgie** - Interventions au bloc operatoire
12. **Personnel** - Medecins, infirmiers, planning des gardes (jour/nuit avec detection de conflit), congés
13. **Facturation** - Factures, encaissements, assurances, impression de facture
14. **Paiements** - Journal des encaissements (par mode/date/caissier), nouvel encaissement, impression de quittance
15. **Documents** - Documents imprimables (certificats, ordonnances, resultats, courriers, rapports) et fichiers numeriques (PDF/images) lies aux patients
16. **Reporting** - Statistiques et export CSV
17. **Parametres** - Configuration, logo hopital, utilisateurs, roles personnalisables, permissions par role, synchronisation, journal

## Fonctionnalites supplementaires

- **Permissions par role** : niveaux d'acces (0-3) par module et par role ; creation de roles personnalises (stockes dans le store `roles`) et ajout/suppression via l'onglet Permissions ; l'admin a toujours un acces total
- **Graphiques Canvas natifs** (js/charts.js) : diagrammes en barres, lignes et donuts - sans aucune dependance externe
- **Ordonnances detaillees** : medicaments, posologie, quantite, dispensation avec deduction du stock et gestion du statut (Prescrite/Dispensee/Partielle)
- **Planning des gardes** : planification jour/nuit/repos, detection de conflits, statistiques quotidiennes
- **Suivi hospitalisation** : observations quotidiennes avec parametres vitaux (temperature, tension, pouls)
- **Entrees de stock** : reapprovisionnement avec motif et historique des mouvements
- **Alertes stock** : stock bas, peremption proche (< 90j) et perimes
- **Gestion des utilisateurs** : creation, activation/desactivation et reinitialisation de mot de passe (page Parametres, role admin)
- **Orientation des urgences** : choix de la decision finale (ambulatoire / hospitalisation / transfert) avec creation automatique de l'admission, de l'hospitalisation et occupation d'un lit coherent avec le service
- **Gestion des lits** : passage d'un lit disponible en maintenance (et inverse) directement depuis le plan des lits ; les lits des hospitalisations/admissions en cours sont marques "Occupes"
- **Fiche patient enrichie** : consultations recentes, hospitalisations et ordonnances dans le dossier patient (dont email)
- **Exports CSV etendus** : patients, consultations, factures et medicaments
- **Gestion du personnel** : creation d'un medecin ou infirmier qui alimente automatiquement les referentiels (medecins/infirmiers) avec rattachement au service
- **Facturation fiabilisee** : plafond a l'encaissement (impossible de depasser le solde), statut "Impayee/Partielle/Entierement payee", modes de paiement incluant le virement bancaire ; les paiements alimentent le total encaisse du tableau de bord
- **Data de demonstration coherente** : lits attribues au bon service et occupes, paiements generes pour les factures reglees
- **Gestion de paiements (module Paiements)** : journal complet des encaissements avec resume (total encaisse, du jour, nombre d'operations), enregistrement d'un encaissement sur une facture, impression d'une **quittance**
- **Gestion des documents (module Documents)** : documents texte imprimables (certificat medical, ordonnance, resultat, courrier, rapport) avec variables dynamiques ({nom}, {prenom}, {date}, {medecin}), apercu et impression ; stockage de fichiers numeriques (PDF/images en base64) avec telechargement/ouverture
- **Impression** (js/print.js) : ouverture d'une fenetre d'impression avec en-tete institutionnel (nom, logo, coordonnees) utilisee par les quittances, les factures et les documents
- **Logo de l'hopital** : chargement d'une image (base64) dans Parametres > Hopital, affichee sur l'ecran de connexion, la barre laterale et les en-tetes imprimes
- **Permissions configurables par role** (Parametres > Permissions) : niveaux d'acces (0 aucun / 1 lecture / 2 ecriture / 3 total) reglables module par module et par role, persises dans le magasin `permissions` ; l'acces aux modules et aux boutons s'adapte immediatement
- **Synchronisation** (Parametres > Synchro) : en ligne, les postes se signalent leurs modifications via un marqueur et rafraichissent l'ecran ; en reseau local, un poste heberge la derniere image des donnees et les autres s'y connectent (voir section ci-dessous)

## Fiabilite et corrections appliquees

Les correctifs suivants garantissent un affichage correct des listes dans tous les modules :

- **Affichage des tableaux corrige** : chaque colonne definit desormais son champ (`field:`) ; sans cela, la valeur n'etait pas recuperee et les cellules affichaient "undefined"/"-". Correction appliquee a toutes les tables (admissions, patients, consultations, urgences, hospitalisations, services, pharmacie, laboratoire, imagerie, chirurgie, personnel, facturation, parametres, tableau de bord) et au sous-tableaux de la fiche patient.
- **Boutons d'action reactives** : les colonnes "Actions" (Demarrer une intervention, Planifier, Saisir un resultat, Encaisser, etc.) recuperaient le statut depuis une valeur inexistante ; elles utilisent desormais l'objet de la ligne (`row`).
- **Noms enrichis** : les colonnes affichent le nom du patient / medecin / service au lieu de l'identifiant brut.

## Synchronisation (onglet Parametres > Synchro)

Deux mecanismes complementaires, configures par un administrateur :

### 1. En ligne (mode cloud)

Les donnees sont dans la base centrale (Firebase / Supabase) : chaque poste ecrit
directement au meme endroit. La synchronisation sert a **signaler** les modifications
aux autres postes pour que leurs ecrans se rafraichissent.

- Un poste qui enregistre une donnee ecrit un **marqueur leger**
  `/sync/{hopital}/{dossier}.json` (`{ v, src, poste }`), sans jamais recopier les donnees.
- Tous les autres postes relisent ce marqueur a la frequence choisie (5 a 120 s) ;
  s'il a change et qu'il ne vient pas d'eux, le cache est vide, la session est
  revalidee et le module affiche est re-rendu.
- **Revalidation de session reelle** : apres chaque rafraichissement, le compte est
  relu dans la base. S'il a ete **supprime ou desactive** depuis un autre poste, la
  session est fermee et l'ecran de connexion revient ; si son role a change, les
  droits sont recalcules immediatement. Si la base est momentanement inaccessible,
  la session est conservee mais les droits restent refuses tant qu'ils n'ont pas
  pu etre relus.
- `v` sert uniquement a dater le marqueur : la detection repose sur son contenu,
  afin de rester fiable si les postes n'ont pas exactement la meme heure.
- Boutons **Synchroniser maintenant** et **Tester la connexion**.
- Configuration propre a chaque poste (`gh_sync_online` dans le stockage local) :
  nom du poste, dossier de synchronisation, frequence.

### 2. Reseau local (mode local / IndexedDB)

Chaque poste possede sa propre base dans son navigateur. Un poste heberge la
derniere image des donnees, les autres s'y connectent.

1. Sur le **poste serveur**, double-cliquer sur `lancer-reseau.bat`
   (le serveur demarre alors avec `-Sync` : il ecoute sur toutes les interfaces
   reseau au lieu de `127.0.0.1` uniquement). Sa fenetre affiche les adresses a
   utiliser sur les autres postes.
2. Recuperer le **secret partage** : il est masque dans la fenetre du serveur.
   Pour l'afficher en clair : `.\build\serveur.ps1 -Sync -ShowSecret`
   (il est aussi enregistre dans `build\.synchro\secret.txt`).
3. Sur chaque **poste client**, `Parametres > Synchro > Reseau local` :
   nom du poste, role « Poste client », adresse du poste serveur, port, puis le
   secret affiche.
4. Cote poste serveur, choisir le role « Poste serveur » et renseigner son nom de
   poste (aucune adresse a saisir).

- Protocole : `/__sync/state`, `/__sync/pull`, `/__sync/push`. Le secret transite
  par l'en-tete `X-Sync-Secret` (et non dans l'URL) : il n'apparait donc ni dans
  un journal du serveur, ni dans l'historique du navigateur.
- Le poste **interroge le serveur avant de pousser** : il ne peut donc pas ecraser
  une image plus recente avec une copie locale perimee. Si le serveur refuse
  quand meme l'image (course entre deux postes), le poste tire immediatement
  l'image gagnante : les modifications locales ne sont jamais perdues en silence.
- La version `v` est strictement croissante (`max(horloge, derniere version + 1)`) :
  une horloge systeme en retard ne peut pas faire perdre une ecriture.
- Une image est **validee avant import** : tronquee, vide ou inattendue, elle est
  refusee et rien n'est ecrit dans la base locale. L'import est aussi differe tant
  qu'un formulaire est ouvert (fenetre de saisie ou onglet Parametres), pour ne
  pas remplacer des valeurs en cours de saisie.
- Les ecritures sont groupees (1,5 s) pour ne pas envoyer une image a chaque frappe ;
  en cas d'echec, les tentatives sont espacees progressivement (4 s a 60 s).
- Volume : l'image contient tous les magasins, documents et fichiers inclus.
  Au-dela de ~24 Mo l'envoi est refuse (limite du serveur : 32 Mo) ; prevoyez
  l'onglet **Sauvegarde** pour les donnees volumineuses.
- Cote serveur, l'image est conservee **telle quelle** (`build\.synchro\etat.json`),
  accompagnee d'un petit fichier de metadonnees (`etat.meta.json`). La verification
  d'etat repond donc en quelques millisecondes et le tirage d'une image de 15 Mo
  en un tiers de seconde, quelle que soit sa taille.
- Les endpoints `/__sync/*` n'existent que si le serveur a ete lance avec `-Sync` ;
  le service worker les ignore (jamais de copie en cache, le secret ne reste pas
  dans le stockage du navigateur).
- Etat de synchronisation visible dans la barre superieure (`Synchro ...` / `LAN ...`).

### Ce que le serveur ne diffuse pas

`build/serveur.ps1` ne sert que les fichiers de l'application : toute requete
portant sur `build/`, `cloud/` ou un nom de fichier cache (`.git`, `.synchro`,
`.env`...) reçoit une erreur **403** au lieu du fichier. Cela interdit notamment
la lecture du secret de synchronisation et de l'image des donnees par un poste
du reseau local qui n'a pas le secret. Le secret est par ailleurs masque dans la
fenetre du serveur (`-ShowSecret` pour l'afficher) et transite par l'en-tete
`X-Sync-Secret` : il ne figure ni dans une URL, ni dans un journal.

### Points de vigilance

- Un seul poste serveur par etablissement ; les autres postes ne doivent pas etre
  fermes au moment ou il heberge la derniere image.
- Si Windows bloque l'acces, autoriser PowerShell dans le Pare-feu (demande au
  premier lancement avec `-Sync`).
- La synchronisation ne remplace pas la sauvegarde : l'onglet **Sauvegarde** reste
  la reference (export JSON manuel et automatique).
- Les reglages de synchronisation ne sont pas eux-memes synchronises.
- La synchro est un **tout ou rien** cote base locale : l'image hegemonique remplace
  la copie du poste. Ne travaillez pas a deux sur le meme registre pendant qu'un
  import est en cours ; l'ecran est rafraichi automatiquement apres l'import.
- Si deux postes modifient le meme registre hors ligne, la modification la plus
  recente l'emporte ; l'autre est perdue (c'est la regle du « plus recent gagne »).

## Structure

```
GestionHospitaliere/
├── index.html
├── lancer.bat              poste seul
├── lancer-reseau.bat       poste serveur de la synchro reseau local
├── css/styles.css
├── js/
│   ├── app.js (module principal qui importe tout), auth.js, db.js, ui.js, meta.js
│   ├── sync.js (synchro en ligne), lan.js (synchro reseau local)
│   ├── storage.js, excel.js, print.js, init.js, sample_data.js
│   ├── core/ (router, state, events, cache, logger)
│   └── modules/ (dashboard, admissions, patients, consultations, urgences,
│                 hospitalisations, services, pharmacie, laboratoire, imagerie,
│                 chirurgie, personnel, facturation, paiements, documents,
│                 reporting, parametres)
├── build/check.ps1, build/serveur.ps1
└── assets/
```

> **Note** : `app.js` importe tous les modules et `index.html` ne charge que
> `<script type="module" src="js/app.js">`. Ne modifiez pas cette architecture
> sans serveur local (voir section Deploiement).

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File build\check.ps1
```

Le script verifie statiquement (PowerShell, sans Node.js) :
- la syntaxe de tous les fichiers JS ;
- la coherence des imports de `app.js` ;
- l'enregistrement de chaque module (`window.*Module`) ;
- l'existence des methodes appelees sur les modules ;
- les references CSS/JS de `index.html`.

Si Node.js est disponible, une verification de syntaxe reelle (beaucoup plus
fiablee que le comptage d'accolades) s'obtient avec :

```powershell
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

> Note technique : si une base existante manque de certains magasins (par ex.
> `suiviHospitalisation`), la version de la base (`DB_VERSION` dans `js/db.js`,
> actuellement `3`) declenche la mise a niveau (nouveaux magasins `documents`
> et `documentsFichiers`). En cas de doute sur des donnees
> anciennes, utilisez le module **Sauvegarde** puis le bouton de reinitialisation.

## Sauvegarde

Les donnees sont stockees dans IndexedDB (local au navigateur). Utilisez le module **Sauvegarde** dans l'application pour exporter/importer les donnees en JSON.
