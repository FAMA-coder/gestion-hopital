const Billing = {
    CATEGORIES: ['Consultation', 'Examen', 'Imagerie', 'Hospitalisation', 'Chirurgie', 'Acte', 'Prestation'],

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
    }
};

window.Billing = Billing;