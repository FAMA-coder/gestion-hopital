const aideModule = {
    async show() {
        UI.setPageTitle('Aide');
        const container = document.getElementById('content-area');

        const modules = [
            {
                nom: 'Tableau de bord', icone: '&#9632;', couleur: 'info',
                desc: 'Vue generale de l\'activite de l\'hopital au quotidien.',
                details: [
                    'Statistiques cles : nombre de patients, d\'admissions, de consultations et revenus encaisses.',
                    'Listes recentes des dernieres admissions et urgences.',
                    'Graphiques de suivi et alertes de vigilance (ex. lits, stocks).',
                    'Ce module sert de page d\'accueil apres la connexion.'
                ]
            },
            {
                nom: 'Admissions', icone: '&#9992;', couleur: 'info',
                desc: 'Enregistrement des patients admis a l\'hopital.',
                details: [
                    'Creation d\'une admission : patient, type (urgence, consultation, hospitalisation, programmee), service, medecin et motif.',
                    'Attribution automatique d\'un lit disponible lors de la creation.',
                    'Modification integrale d\'une admission (patient, type, service, medecin, motif, dates, statut, motif de sortie).',
                    'Suppression d\'une admission avec liberation du lit occupe.',
                    'Recherche instantanee par nom de patient ou matricule.'
                ]
            },
            {
                nom: 'Patients', icone: '&#9787;', couleur: 'info',
                desc: 'Registre central des patients.',
                details: [
                    'Fiche complete : identite, coordonnees, groupe sanguin, allergies et antecedents.',
                    'Recherche rapide par matricule ou nom.',
                    'Historique du patient : consultations, hospitalisations, ordonnances et factures.',
                    'Edition de la fiche et suivi de la date de creation.'
                ]
            },
            {
                nom: 'Consultations', icone: '&#9998;', couleur: 'info',
                desc: 'Suivi des consultations medicales.',
                details: [
                    'Saisie du motif, des symptomes, du diagnostic, de la prescription et des notes.',
                    'Impression d\'un ticket de consultation (bouton Ticket).',
                    'Edition complete d\'une consultation existante.',
                    'Le bouton d\'impression de billet apparait apres l\'enregistrement.'
                ]
            },
            {
                nom: 'Urgences', icone: '&#9888;', couleur: 'danger',
                desc: 'Gestion des cas d\'urgence.',
                details: [
                    'Enregistrement prioritaire des patients urgents.',
                    'Triage selon le niveau de severite (1 a 5).',
                    'Prise en charge immediate et suivi jusqu\'a la stabilisation, le transfert ou la sortie.',
                    'Consultation de l\'historique des urgences traitees.'
                ]
            },
            {
                nom: 'Hospitalisations', icone: '&#9829;', couleur: 'success',
                desc: 'Suivi des patients hospitalises.',
                details: [
                    'Duree de sejour, lit et service d\'affectation.',
                    'Dossier de soins et suivi hospitalier (parametres vitaux, observations).',
                    'Sortie du patient et mention du devenir.',
                    'Distinction entre hospitalisations en cours et terminees.'
                ]
            },
            {
                nom: 'Services & Lits', icone: '&#9881;', couleur: 'info',
                desc: 'Organisation du parc hospitalier.',
                details: [
                    'Creation, modification et suppression des services (actifs / inactifs).',
                    'Plan visuel des lits par service avec leur etat : libre, occupe, maintenance.',
                    'Bascule d\'un lit libre en maintenance et inversement.',
                    'Suivi du taux d\'occupation et de disponibilite.'
                ]
            },
            {
                nom: 'Pharmacie', icone: '&#9883;', couleur: 'success',
                desc: 'Gestion du stock pharmaceutique.',
                details: [
                    'Catalogue des medicaments : nom, forme, dosage, categorie, fournisseur.',
                    'Entrees et sorties de stock, suivi des quantites.',
                    'Alertes de stock bas et approvisionnement.',
                    'Dispensation des ordonnances aux patients.',
                    'Recherche instantanee dans le catalogue.'
                ]
            },
            {
                nom: 'Laboratoire', icone: '&#9878;', couleur: 'purple',
                desc: 'Gestion des examens biologiques.',
                details: [
                    'Types d\'analyses disponibles et leurs couts.',
                    'Demandes d\'examens par un medecin.',
                    'Saisie des resultats et compte rendu au prescripteur.',
                    'Suivi du statut des demandes (demande, en cours, realisee).'
                ]
            },
            {
                nom: 'Imagerie', icone: '&#9884;', couleur: 'purple',
                desc: 'Gestion des examens d\'imagerie.',
                details: [
                    'Demandes de radiologie, echographie, scanner, IRM.',
                    'Planification des examens et priorite (normale, urgente).',
                    'Interpretation et restitution des resultats.',
                    'Suivi du statut des demandes.'
                ]
            },
            {
                nom: 'Chirurgie', icone: '&#9986;', couleur: 'danger',
                desc: 'Gestion des actes chirurgicaux.',
                details: [
                    'Planification des interventions et affectation de la salle.',
                    'Suivi du bloc operatoire et duree estimee.',
                    'Type d\'anesthesie et equipe chirurgicale.',
                    'Comptes rendus operatoires et suivi post-operatoire.'
                ]
            },
            {
                nom: 'Personnel', icone: '&#9786;', couleur: 'info',
                desc: 'Gestion des ressources humaines.',
                details: [
                    'Fiche des employes : medecins, infirmiers et personnel administratif.',
                    'Matricules, coordonnees et statut.',
                    'Affectation aux services et planning de gardes.',
                    'Gestion des conges.'
                ]
            },
            {
                nom: 'Salaires & Honoraires', icone: '&#8381;', couleur: 'info',
                desc: 'Bulletins de salaire et honoraires avec calculs sociaux.',
                details: [
                    'Deux onglets : Salaires des employes et Honoraires des prestataires.',
                    'Saisie du salaire de base et des primes (anciennete, rendement, transport, risque...).',
                    'Calcul automatique : brut = base + primes, retenues INPS (9 %) et AMO (2 %), net a payer.',
                    'Part patronale (INPS 9 %, AMO 3 %) et cout total employeur.',
                    'Enregistrement du paiement (especes, virement, cheque, Mobile Money) et impression du bulletin.',
                    'Journal imprimable avec totaux (net, paye, reste a payer, charges patronales).'
                ]
            },
            {
                nom: 'Contrats', icone: '&#9776;', couleur: 'info',
                desc: 'Gestion des contrats (employes, prestataires, partenaires externes, stages).',
                details: [
                    'Types de contrats : Employe, Prestataire, Partenaire, Stage, Autre.',
                    'Lien avec le personnel interne ou nom/contact d\'un partenaire externe.',
                    'Suivi des periodes (debut, fin, CDI), montants et periodicite.',
                    'Statuts : Actif, En attente, Suspendu, Termine, Annule.',
                    'Actions : prolonger la duree, suspendre ou resilier avec motif.',
                    'Alertes d\'echeance dans les 30 jours.',
                    'Impression de la fiche de contrat et de la liste.'
                ]
            },
            {
                nom: 'Depenses', icone: '&#8599;', couleur: 'info',
                desc: 'Comptabilisation des depenses de l\'hopital.',
                details: [
                    'Categories : constructions, entretien, electricite, eau, telecom, achats de materiels et fournitures, transports, etc.',
                    'Saisie : libelle, montant, date, mode de paiement, beneficiaire, service concerne et reference.',
                    'Filtres par categorie, periode (Du/Au) et mode de paiement.',
                    'Repartition graphique par categorie et resume statistique.',
                    'Impression du journal des depenses et du resume par categorie.'
                ]
            },
            {
                nom: 'Facturation', icone: '&#9830;', couleur: 'warning',
                desc: 'Etablissement des factures.',
                details: [
                    'Creation des factures avec lignes de prestations.',
                    'Calcul automatique des montants, taxes et restes a payer.',
                    'Enregistrement des assurances et de leur couverture.',
                    'Impression des factures a remettre aux patients.'
                ]
            },
            {
                nom: 'Paiements', icone: '&#10003;', couleur: 'success',
                desc: 'Encaissement des paiements.',
                details: [
                    'Journal des encaissements effectues.',
                    'Choix du mode de paiement (especes, carte, virement, assurance, mutuelle).',
                    'Emission de quittances imprimables.',
                    'Suivi des restes a payer par facture.'
                ]
            },
            {
                nom: 'Documents', icone: '&#128196;', couleur: 'info',
                desc: 'Gestion documentaire.',
                details: [
                    'Creation de documents texte imprimables (courriers, certificats, lettres).',
                    'Depot et stockage de fichiers numeriques (PDF, images...).',
                    'Telechargement et impression des documents.',
                    'Organisation par service ou type.'
                ]
            },
            {
                nom: 'Reporting', icone: '&#9783;', couleur: 'purple',
                desc: 'Statistiques et indicateurs.',
                details: [
                    'Rapports d\'activite et indicateurs de performance.',
                    'Export des donnees vers Excel (CSV).',
                    'Vue d\'ensemble chiffree de l\'activite de l\'hopital.'
                ]
            },
            {
                nom: 'Parametres', icone: '&#9881;', couleur: 'info',
                desc: 'Configuration de l\'application.',
                details: [
                    'Informations de l\'hopital : nom, coordonnees, devise, slogan et logo.',
                    'Gestion des utilisateurs : creation, modification, activation / desactivation.',
                    'Roles personnalises et permissions par module.',
                    'Configuration de la sauvegarde automatique.'
                ]
            },
            {
                nom: 'Sauvegarde & Restauration', icone: '&#11015;', couleur: 'success',
                desc: 'Protection de vos donnees.',
                details: [
                    'Visualisation de l\'espace utilise par le navigateur et du quota disponible.',
                    'Sauvegarde manuelle de l\'ensemble des donnees (fichier ou dossier).',
                    'Restauration des donnees a partir d\'un fichier de sauvegarde.',
                    'Demande de stockage persistant pour eviter toute suppression.'
                ]
            },
            {
                nom: 'Aide', icone: '&#128214;', couleur: 'info',
                desc: 'Le guide que vous lisez en ce moment.',
                details: [
                    'Explications detaillees de chaque module de l\'application.',
                    'Ce module est accessible a tous les utilisateurs, sans permission particuliere.'
                ]
            }
        ];

        const moduleCards = modules.map(r => `
            <div class="card" style="margin-bottom:12px">
                <div class="card-header">
                    <h3><span style="margin-right:8px;color:var(--${r.couleur})">${r.icone}</span>${r.nom}</h3>
                </div>
                <div style="padding:10px 16px 4px;color:var(--text);font-size:14px;line-height:1.6">${r.desc}</div>
                <ul style="margin:8px 16px 14px;padding-left:20px;color:var(--text-secondary);font-size:13px;line-height:1.8">
                    ${r.details.map(d => `<li>${d}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        const section = (titre, intro, contenu) => `
            <div class="card" style="margin-bottom:12px">
                <div class="card-header"><h3>${titre}</h3></div>
                ${intro ? `<div style="padding:10px 16px 0;color:var(--text-secondary);font-size:14px;line-height:1.6">${intro}</div>` : ''}
                <div style="padding:8px 16px 14px;color:var(--text-secondary);font-size:13px;line-height:1.8">${contenu}</div>
            </div>
        `;

        container.innerHTML = `
            <div style="margin-bottom:16px;padding:20px;background:linear-gradient(135deg,#1a2332,#1a73e8);border-radius:var(--radius-lg);color:#fff">
                <h3 style="font-size:20px;margin-bottom:6px">Guide de l'application</h3>
                <p style="font-size:14px;opacity:0.9;line-height:1.6">Bienvenue ! Ce guide detaille le role de chaque onglet, les actions possibles, la gestion des comptes et des droits, la sauvegarde des donnees et l'installation de l'application. Utilisez le menu lateral pour parcourir les explications ci-dessous.</p>
            </div>

            <div style="font-size:15px;font-weight:600;color:var(--text);margin:18px 0 10px">Presentation des onglets</div>
            ${moduleCards}

            ${section('Se connecter a l\'application', 'Pour utiliser le programme, vous devez ouvrir une session avec un compte utilisateur.',
                `<p style="margin:0 0 8px">Sur l'ecran de connexion, saisissez votre nom d'utilisateur et votre mot de passe, puis cliquez sur <strong>"Se connecter"</strong>.</p>
                <ul style="margin:0;padding-left:20px">
                    <li>Un <strong>compte administrateur</strong> est cree par defaut (au premier lancement de l'application).</li>
                    <li>Si la session est deja ouverte, elle est restauree automatiquement au prochain chargement.</li>
                    <li>Cliquez sur <strong>Deconnexion</strong> en bas du menu pour fermer la session.</li>
                    <li>Si le mot de passe est oublie, un administrateur peut le reinitialiser dans <strong>Parametres &gt; Utilisateurs</strong>.</li>
                </ul>`)
            }

            ${section('Roles et permissions', 'Chaque utilisateur possede un role qui determine les modules accessibles et les actions autorisees.',
                `<ul style="margin:0;padding-left:20px">
                    <li><strong>Niveau 3 (Gestion) :</strong> peut tout faire dans le module (creer, modifier, supprimer, imprimer).</li>
                    <li><strong>Niveau 2 (Edition) :</strong> peut modifier les elements existants.</li>
                    <li><strong>Niveau 1 (Lecture) :</strong> peut consulter le module sans le modifier.</li>
                    <li><strong>Niveau 0 :</strong> aucun acces au module.</li>
                </ul>
                <p style="margin:10px 0 0">La configuration se fait dans <strong>Parametres &gt; Permissions</strong>. L'administrateur (<em>admin</em>) a toujours tous les droits. Les boutons d'action (Modifier, Supprimer, Ajouter) n'apparaissent que si votre role vous y autorise.</p>`)
            }

            ${section('Gestion des utilisateurs', 'Les comptes sont geres depuis <strong>Parametres &gt; Utilisateurs</strong>.',
                `<ul style="margin:0;padding-left:20px">
                    <li><strong>Creer</strong> un utilisateur : nom d'utilisateur, nom complet, role, service et mot de passe.</li>
                    <li><strong>Modifier</strong> un utilisateur : changer le role, le service ou le statut (actif / inactif).</li>
                    <li>Un compte <strong>desactive</strong> ne peut plus se connecter.</li>
                    <li>Il est impossible de se desactiver soi-meme (protection anti-blocage).</li>
                    <li>Le mot de passe peut etre saisi a nouveau pour le changer ; laissez vide pour le conserver.</li>
                </ul>`)
            }

            ${section('Roles personnalises', 'En plus des roles predefinis (Directeur, Medecin, Infirmier, Pharmacien, Caissier, Secretaire...), vous pouvez creer vos propres roles.',
                `<ul style="margin:0;padding-left:20px">
                    <li>Dans <strong>Parametres &gt; Roles</strong>, cliquez sur <strong>"Nouveau role"</strong> et donnez-lui un nom.</li>
                    <li>Puis affectez les permissions souhaitees a ce role depuis <strong>Parametres &gt; Permissions</strong>.</li>
                    <li>Enfin, affectez ce role a un ou plusieurs utilisateurs.</li>
                    <li>Un role personnalise utilise par des comptes ne peut pas etre supprime immediatement.</li>
                </ul>`)
            }

            ${section('Sauvegarde et protection des donnees', 'Les donnees sont stockees localement dans le navigateur (IndexedDB). Il est essentiel de les sauvegarder.',
                `<ul style="margin:0;padding-left:20px">
                    <li><strong>Sauvegarde manuelle</strong> : onglet <strong>Sauvegarde</strong>, bouton <strong>"Sauvegarder maintenant"</strong>. Choisissez un dossier ou le fichier sera telecharge.</li>
                    <li><strong>Sauvegarde automatique</strong> : <strong>Parametres &gt; Sauvegarde</strong> permet de programmer un backup periodique (minutes, heures, jours, semaines, mois).</li>
                    <li><strong>Restauration</strong> : rechargez un fichier de sauvegarde precedemment cree pour recuperer vos donnees.</li>
                    <li><strong>En cas de reinstallation ou de navigateur different</strong>, restituez a l'aide d'un fichier de sauvegarde.</li>
                    <li>Activez le <strong>stockage persistant</strong> pour limiter les risques de suppression automatique des donnees.</li>
                    <li>Pensez a exporter toutes les donnees avant de retirer des utilisateurs ou de changer de poste.</li>
                </ul>`)
            }

            ${section('Installer l\'application (mode hors-ligne)', 'L\'application peut etre installee comme une application de bureau pour demarrer plus rapidement.',
                `<ul style="margin:0;padding-left:20px">
                    <li>L'installation (PWA) est disponible lorsque l'application est ouverte via un <strong>serveur local</strong> (fichier <em>lancer.bat</em>) ou en ligne (adresse https).</li>
                    <li>Dans le navigateur (Chrome ou Edge), cliquez sur l'icone d'installation dans la barre d'adresse, ou menu &gt; <strong>"Installer Gestion Hospitaliere"</strong>.</li>
                    <li>Une fois installee, elle ouvre une fenetre dediee et fonctionne meme sans connexion (ajouts disponibles).</li>
                    <li>Pour ouvrir simplement le fichier sans installation, double-cliquez sur <strong>index.html</strong>.</li>
                </ul>`)
            }

            ${section('Impression et documents', 'Plusieurs modules permettent de generer des documents imprimables.',
                `<ul style="margin:0;padding-left:20px">
                    <li><strong>Consultations</strong> : bouton <strong>"Ticket"</strong> pour imprimer le billet de consultation.</li>
                    <li><strong>Facturation</strong> et <strong>Paiements</strong> : impression des factures et quittances.</li>
                    <li><strong>Documents</strong> : creation de documents texte imprimables et gestion de fichiers numeriques.</li>
                    <li>A l'impression, utilisez l'apercu du navigateur pour choisir la mise en page, les marges ou l'enregistrement en PDF.</li>
                </ul>`)
            }

            ${section('Recherche et filtres', 'Les listes de donnees sont filtrables pour retrouver rapidement un element.',
                `<ul style="margin:0;padding-left:20px">
                    <li>Dans <strong>Admissions</strong> et <strong>Pharmacie</strong>, saisissez un texte dans le champ de recherche : la liste se filtre instantanement pendant la frappe.</li>
                    <li>Recherchez par nom, prenom ou matricule selon le module.</li>
                    <li>Utilisez la pagination en bas des listes pour parcourir les resultats.</li>
                </ul>`)
            }

            ${section('Questions frequentes (FAQ)', 'Reponses aux interrogations courantes.',
                `<ul style="margin:0;padding-left:20px">
                    <li><strong>J'ai oublie mon mot de passe.</strong> Un administrateur peut le reinitialiser dans <strong>Parametres &gt; Utilisateurs</strong>.</li>
                    <li><strong>Ou sont stockees mes donnees ?</strong> Dans le navigateur (IndexedDB). Elles ne sont pas envoyees sur Internet.</li>
                    <li><strong>Comment recuperer mes donnees sur un autre appareil ?</strong> Faites une sauvegarde, puis restaurez-la sur l'autre appareil (onglet <strong>Sauvegarde</strong>).</li>
                    <li><strong>Pourquoi certains boutons n'apparaissent pas ?</strong> Votre role ne possede pas les permissions requises. Contactez un administrateur.</li>
                    <li><strong>L'onglet est-il vide ?</strong> Creez d'abord un element (patient, service, etc.) puis utilisez le bouton en haut a droite du module.</li>
                    <li><strong>Comment installer l'application ?</strong> Ouvrez via <em>lancer.bat</em> puis utilisez l'option d'installation du navigateur (voir section precedente).</li>
                </ul>`)
            }

            ${section('Conseils generaux', 'Quelques bonnes pratiques pour utiliser sereinement l\'application.',
                `<ul style="margin:0;padding-left:20px">
                    <li>Effectuez une <strong>sauvegarde reguliere</strong> pour ne jamais perdre vos donnees.</li>
                    <li><strong>Verifiez la devise et le nom de l'hopital</strong> dans <strong>Parametres</strong> avant de facturer.</li>
                    <li>Gardez vos identifiants <strong>confidentiels</strong> et changez le mot de passe administrateur par defaut.</li>
                    <li>Ne partagez pas un seul compte administrateur entre plusieurs personnes : creez des comptes par role.</li>
                </ul>`)
            }
        `;
    },

    cleanup() {}
};

window.aideModule = aideModule;
