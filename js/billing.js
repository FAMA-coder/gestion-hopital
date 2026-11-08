const Billing = {
    CATEGORIES: ['Consultation', 'Examen', 'Imagerie', 'Hospitalisation', 'Chirurgie', 'Acte', 'Prestation', 'Ticket d\'entree'],

    async getOpenFacture(patientId) {
        const factures = await DB.getAll('factures');
        let facture = factures.find(f => f.patientId === patientId && f.statut === 'Impayee');
        if (!facture) {
            facture = {
                id: DB.generateId(),
                patientId,
                date: new Date().toISOString(),
                lignes: [],
                montantTotal: 0,
                montantPaye: 0,
                resteApayer: 0,
                statut: 'Impayee',
                modePaiement: null
            };
            await DB.put('factures', facture);
        }
        return facture;
    },

    async addLigne(patientId, ligne) {
        if (!ligne || !Number(ligne.montant) || Number(ligne.montant) <= 0) return null;
        const facture = await this.getOpenFacture(patientId);
        if (!facture.lignes) facture.lignes = [];
        facture.lignes.push({
            description: ligne.description || 'Prestation',
            montant: Number(ligne.montant),
            tarifId: ligne.tarifId || null,
            source: ligne.source || null,
            sourceId: ligne.sourceId || null
        });
        facture.montantTotal = facture.lignes.reduce((s, l) => s + Number(l.montant || 0), 0);
        facture.resteApayer = facture.montantTotal - (facture.montantPaye || 0);
        if (facture.resteApayer <= 0) facture.statut = 'EntierementPayee';
        else if (facture.montantPaye > 0) facture.statut = 'PartiellementPayee';
        else facture.statut = 'Impayee';
        await DB.put('factures', facture);
        return facture;
    },

    async trouverTarif(categorie, serviceId) {
        const tarifs = await DB.getAll('tarifs');
        const actifs = tarifs.filter(t => t.categorie === categorie && t.actif !== false);
        return actifs.find(t => t.serviceId === serviceId) || actifs.find(t => t.serviceId === null || !t.serviceId) || null;
    },

    async montantConsultation(medecin) {
        if (medecin && Number(medecin.consultationCout)) return Number(medecin.consultationCout);
        const t = await this.trouverTarif('Consultation', medecin && medecin.serviceId);
        return t ? Number(t.montant) : 0;
    },

    async montantExamen(typeExamen) {
        if (typeExamen && Number(typeExamen.cout)) return Number(typeExamen.cout);
        const t = await this.trouverTarif('Examen', typeExamen && typeExamen.serviceId);
        return t ? Number(t.montant) : 0;
    },

    // ------------------------------------------------------------
    // Ticket d'entree au service (paiement a la reception/orientation)
    // ------------------------------------------------------------
    // Tarif applique, par ordre de priorite :
    //   1. champ "Ticket d'entree" defini sur le service (Services & Lits) ;
    //   2. tarif actif de categorie "Ticket d'entree" propre au service ;
    //   3. tarif actif de categorie "Ticket d'entree" general (sans service) ;
    //   4. tarif actif "Prestation" rattache au service ;
    //   5. tarif actif "Consultation" du service (repli, tarif le plus bas).
    // Retourne null si aucun montant n'est defini.
    async tarifTicketEntree(serviceId) {
        if (!serviceId) return null;
        const services = await Meta.getServices();
        const svc = services.find(s => s.id === serviceId);
        if (svc && Number(svc.tarifEntree) > 0) {
            return {
                id: 'service-' + svc.id,
                categorie: 'Ticket d\'entree',
                libelle: 'Ticket d\'entree - ' + svc.nom,
                montant: Number(svc.tarifEntree),
                serviceId: svc.id,
                source: 'service',
                actif: true
            };
        }
        const tarifs = (await DB.getAll('tarifs')).filter(t => t.actif !== false && Number(t.montant) > 0);
        const ticket = tarifs.find(t => t.categorie === 'Ticket d\'entree' && t.serviceId === serviceId)
            || tarifs.find(t => t.categorie === 'Ticket d\'entree' && !t.serviceId);
        if (ticket) return ticket;

        const byMontant = (a, b) => Number(a.montant) - Number(b.montant);
        const prestation = tarifs
            .filter(t => t.categorie === 'Prestation' && t.serviceId === serviceId)
            .sort(byMontant)[0];
        if (prestation) return Object.assign({}, prestation, { source: 'prestation' });

        const consultation = tarifs
            .filter(t => t.categorie === 'Consultation' && t.serviceId === serviceId)
            .sort(byMontant)[0];
        if (consultation) return Object.assign({}, consultation, { source: 'consultation' });

        return null;
    },

    // Encaisse le ticket d'entree : cree une facture dediee (deja soldee)
    // et un encaissement, sans toucher aux autres factures du patient.
    async encaisserTicketEntree(patientId, service, tarif, mode) {
        const montant = Number(tarif && tarif.montant);
        if (!patientId || !service || !(montant > 0)) return null;
        const now = new Date().toISOString();
        const libelle = 'Ticket d\'entree - ' + service.nom;
        const facture = {
            id: DB.generateId(),
            patientId,
            date: now,
            description: libelle,
            lignes: [{ description: libelle, montant, tarifId: tarif.id || null, source: 'receptions', sourceId: service.id }],
            montantTotal: montant,
            montantPaye: montant,
            resteApayer: 0,
            statut: 'EntierementPayee',
            modePaiement: mode || 'Especes',
            type: 'TicketEntree',
            serviceId: service.id
        };
        await DB.put('factures', facture);
        const paiement = {
            id: DB.generateId(),
            factureId: facture.id,
            patientId,
            date: now,
            montant,
            mode: facture.modePaiement,
            caissierId: (Auth.currentUser && Auth.currentUser.id) || null,
            type: 'TicketEntree',
            serviceId: service.id
        };
        await DB.put('paiements', paiement);
        return { facture, paiement };
    }
};

window.Billing = Billing;