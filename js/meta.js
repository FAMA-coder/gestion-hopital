const Meta = {
    async getHopital() {
        return await DB.get('hopital', 'current') || null;
    },

    async saveHopital(data) {
        data.id = 'current';
        await DB.put('hopital', data);
        State.set('hopital', data);
    },

    async getServices() {
        return await Cache.getOrSet('services', () => DB.getAll('services'));
    },

    async getMedecins() {
        const personnel = await DB.getAll('personnel');
        const medecins = await DB.getAll('medecins');
        return medecins.map(m => {
            const p = personnel.find(x => x.id === m.personnelId);
            return { ...m, ...p, label: p ? `${p.prenom} ${p.nom}` : 'Inconnu' };
        });
    },

    async getMedecinsByService(serviceId) {
        const all = await this.getMedecins();
        return all.filter(m => m.serviceId === serviceId);
    },

    async getInfirmiers() {
        const personnel = await DB.getAll('personnel');
        const infirmiers = await DB.getAll('infirmiers');
        return infirmiers.map(i => {
            const p = personnel.find(x => x.id === i.personnelId);
            return { ...i, ...p, label: p ? `${p.prenom} ${p.nom}` : 'Inconnu' };
        });
    },

    async getPersonnel() {
        return await DB.getAll('personnel');
    },

    async getLits(serviceId) {
        const all = await DB.getAll('lits');
        if (serviceId) return all.filter(l => l.serviceId === serviceId);
        return all;
    },

    async getLitsDisponibles(serviceId) {
        const lits = await this.getLits(serviceId);
        return lits.filter(l => l.statut === 'Libre');
    },

    async getSalles(serviceId) {
        const all = await DB.getAll('salles');
        if (serviceId) return all.filter(s => s.serviceId === serviceId);
        return all;
    },

    async getTypesExamen() {
        return await DB.getAll('typesExamen');
    },

    async getMedicaments() {
        return await DB.getAll('medicaments');
    },

    async getAssurances() {
        return await DB.getAll('assurances');
    },

    async getUsers() {
        return await DB.getAll('users');
    },

    async getParametre(cle) {
        const p = await DB.get('parametres', cle);
        return p ? p.valeur : null;
    },

    async setParametre(cle, valeur, description = '') {
        await DB.put('parametres', { cle, valeur, description });
    },

    getDevise() {
        const h = State.get('hopital');
        return h ? h.devise : 'FCFA';
    }
};

window.Meta = Meta;
