const personnelModule = {
    tab: 'personnel',

    async show() {
        UI.setPageTitle('Personnel');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'personnel' ? 'active' : ''}" onclick="personnelModule.switchTab('personnel')">Personnel</button>
                <button class="tab ${this.tab === 'gardes' ? 'active' : ''}" onclick="personnelModule.switchTab('gardes')">Gardes</button>
                <button class="tab ${this.tab === 'conges' ? 'active' : ''}" onclick="personnelModule.switchTab('conges')">Conges</button>
            </div>
            <div id="personnel-content"></div>
        `;
        container.innerHTML = html;
        await this.renderTab();
    },

    switchTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
        this.renderTab();
    },

    async renderTab() {
        const content = document.getElementById('personnel-content');
        if (this.tab === 'personnel') await this.renderPersonnel(content);
        else if (this.tab === 'gardes') await this.renderGardes(content);
        else await this.renderConges(content);
    },

    async renderPersonnel(container) {
        const personnel = await DB.getAll('personnel');
        const services = await DB.getAll('services');

        const typeBadge = (t) => {
            const colors = { Medecin: 'purple', Infirmier: 'info', Administratif: 'gray', Laborantin: 'warning', Technicien: 'warning', Prestataire: 'blue' };
            return UI.renderBadge(t, colors[t] || 'gray');
        };

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9786;', personnel.filter(p => p.type === 'Medecin').length, 'Medecins', 'purple')}
                ${UI.renderStatCard('&#9786;', personnel.filter(p => p.type === 'Infirmier').length, 'Infirmiers', 'blue')}
                ${UI.renderStatCard('&#9786;', personnel.filter(p => p.type === 'Administratif').length, 'Administratif', 'gray')}
                ${UI.renderStatCard('&#9786;', personnel.length, 'Total personnel', 'green')}
            </div>

            ${Auth.can('personnel', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="personnelModule.showForm()">+ Nouveau Personnel</button></div>' : ''}

            <div class="card">
                ${UI.renderTable([
                    { field: 'matricule', label: 'Matricule', render: (v) => `<strong>${v}</strong>` },
                    { label: 'Nom Complet', render: (v, row) => `${row.prenom} ${row.nom}` },
                    { field: 'type', label: 'Type', render: (v) => typeBadge(v) },
                    { field: 'sexe', label: 'Sexe', render: (v) => v === 'M' ? 'M' : 'F' },
                    { field: 'telephone', label: 'Telephone', render: (v) => v || '-' },
                    { field: 'dateEmbauche', label: 'Date Embauche', render: (v) => UI.formatDate(v) },
                    { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v, v === 'Actif' ? 'success' : 'gray') },
                    { label: 'Actions', render: (v, row) => `<button class="btn btn-sm btn-outline" onclick="personnelModule.printFiche('${row.id}')">&#128424; Fiche</button>` }
                ], personnel, { actions: false })}
            </div>
        `;
        container.innerHTML = html;
    },

    async renderGardes(container) {
        const personnel = await DB.getAll('personnel');
        const gardes = await DB.getAll('planningPersonnel');

        gardes.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        const getPersonnel = (id) => { const p = personnel.find(x => x.id === id); return p ? `${p.prenom} ${p.nom} (${p.type})` : id; };

        const gardeBadge = (g) => {
            const map = { Jour: 'blue', Nuit: 'purple', Off: 'gray', Vacances: 'gray' };
            return UI.renderBadge(g || 'Off', map[g] || 'gray');
        };

        // Stats gardes du jour
        const todayStr = new Date().toISOString().slice(0, 10);
        const gardesJour = gardes.filter(g => (g.date || '').slice(0, 10) === todayStr);
        const jour = gardesJour.filter(g => g.typeGarde === 'Jour').length;
        const nuit = gardesJour.filter(g => g.typeGarde === 'Nuit').length;

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9728;', jour, 'Gardes de jour (auj.)', 'blue')}
                ${UI.renderStatCard('&#9790;', nuit, 'Gardes de nuit (auj.)', 'purple')}
                ${UI.renderStatCard('&#128197;', gardes.length, 'Planning total', 'green')}
            </div>

            ${Auth.can('personnel', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="personnelModule.showGardeForm()">+ Planifier une Garde</button></div>' : ''}

            <div class="card">
                <div class="card-header"><h3>Planning des gardes</h3></div>
                ${UI.renderTable([
                    { field: 'personnelId', label: 'Personnel', render: (v) => `<strong>${getPersonnel(v)}</strong>` },
                    { field: 'date', label: 'Date', render: (v) => UI.formatDate(v) },
                    { field: 'typeGarde', label: 'Type', render: (v) => gardeBadge(v) },
                    { field: 'heureDebut', label: 'Heure Debut', render: (v) => v || '-' },
                    { field: 'heureFin', label: 'Heure Fin', render: (v) => v || '-' },
                    { label: 'Actions', render: (v, row) => {
                        if (row.typeGarde !== 'Off' && Auth.can('personnel', 3))
                            return `<button class="btn btn-sm btn-danger" onclick="personnelModule.removeGarde('${row.id}')">Suppr.</button>`;
                        return '';
                    }}
                ], gardes, { actions: false, emptyTitle: 'Aucune garde planifiee', emptyText: 'Aucun planning de garde.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showGardeForm() {
        const personnel = await DB.getAll('personnel');
        const formHtml = UI.buildForm([
            { name: 'personnelId', label: 'Personnel', type: 'select', required: true, options: personnel.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom} (${p.type})` })) },
            { name: 'date', label: 'Date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
            { name: 'typeGarde', label: 'Type de garde', type: 'select', required: true, options: [
                { value: 'Jour', label: 'Jour' }, { value: 'Nuit', label: 'Nuit' }, { value: 'Off', label: 'Repos' }
            ]},
            { name: 'heureDebut', label: 'Heure debut', type: 'time' },
            { name: 'heureFin', label: 'Heure fin', type: 'time' }
        ]);
        UI.showModal('Planifier une Garde', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="personnelModule.saveGarde()">Enregistrer</button>
        `);
    },

    async saveGarde() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.personnelId || !data.date) { UI.toast('Champs obligatoires manquants', 'error'); return; }
        data.id = DB.generateId();
        const gardes = await DB.getAll('planningPersonnel');
        const conflit = gardes.find(g => g.personnelId === data.personnelId && g.date === data.date && g.typeGarde !== 'Off' && data.typeGarde !== 'Off');
        if (conflit) {
            UI.toast('Conflit: ce personnel a deja une garde ce jour', 'error');
            return;
        }
        await DB.put('planningPersonnel', data);
        UI.toast('Garde planifiee', 'success');
        await Auth.log('Creation', 'personnel', `Garde ${data.date}`);
        UI.hideModal();
        this.renderTab();
    },

    async removeGarde(id) {
        const ok = await UI.confirm('Supprimer cette garde ?');
        if (ok) {
            await DB.delete('planningPersonnel', id);
            UI.toast('Garde supprimee', 'success');
            this.renderTab();
        }
    },

    async renderConges(container) {
        const conges = await DB.getAll('conges');
        const personnel = await DB.getAll('personnel');

        const getPersonnel = (id) => { const p = personnel.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };

        let html = `
            <div class="toolbar"><div class="toolbar-right">
                ${Auth.can('personnel', 3) ? '<button class="btn btn-primary" onclick="personnelModule.showCongeForm()">+ Demande de Conge</button>' : ''}
            </div></div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'personnelId', label: 'Personnel', render: (v) => `<strong>${getPersonnel(v)}</strong>` },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, 'info') },
                    { field: 'dateDebut', label: 'Date Debut', render: (v) => UI.formatDate(v) },
                    { field: 'dateFin', label: 'Date Fin', render: (v) => UI.formatDate(v) },
                    { field: 'statut', label: 'Statut', render: (v) => {
                        const colors = { EnAttente: 'warning', Valide: 'success', Refuse: 'danger' };
                        return UI.renderBadge(v === 'EnAttente' ? 'En attente' : v, colors[v] || 'gray');
                    }}
                ], conges, { actions: false, emptyTitle: 'Aucun conge', emptyText: 'Aucune demande de conge.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showForm() {
        const services = (await Meta.getServices()).filter(s => s.actif);
        const formHtml = UI.buildForm([
            { name: 'matricule', label: 'Matricule', required: true, placeholder: 'MED011' },
            { name: 'nom', label: 'Nom', required: true },
            { name: 'prenom', label: 'Prenom', required: true },
            { name: 'sexe', label: 'Sexe', type: 'select', required: true, options: [{ value: 'M', label: 'Masculin' }, { value: 'F', label: 'Feminin' }] },
            { name: 'dateNaissance', label: 'Date de naissance', type: 'date' },
            { name: 'telephone', label: 'Telephone', type: 'tel' },
            { name: 'type', label: 'Type', type: 'select', required: true, options: [
                { value: 'Medecin', label: 'Medecin' }, { value: 'Infirmier', label: 'Infirmier' },
                { value: 'Administratif', label: 'Administratif' }, { value: 'Laborantin', label: 'Laborantin' }, { value: 'Technicien', label: 'Technicien' }, { value: 'Prestataire', label: 'Prestataire' }
            ]},
            { name: 'serviceId', label: 'Service', type: 'select', options: services.map(s => ({ value: s.id, label: s.nom })) }
        ]);
        UI.showModal('Nouveau Personnel', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="personnelModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.matricule || !data.nom || !data.prenom) { UI.toast('Champs obligatoires manquants', 'error'); return; }
        data.id = DB.generateId();
        data.dateEmbauche = new Date().toISOString().slice(0, 10);
        data.statut = 'Actif';
        await DB.put('personnel', data);

        // Cree aussi l'enregistrement dans la table specialisee
        if (data.type === 'Medecin') {
            await DB.put('medecins', {
                id: DB.generateId(),
                personnelId: data.id,
                specialite: 'Generaliste',
                numeroOrdre: '',
                grade: 'Generaliste',
                consultationCout: 15000,
                disponible: true,
                serviceId: data.serviceId || null
            });
        } else if (data.type === 'Infirmier') {
            await DB.put('infirmiers', {
                id: DB.generateId(),
                personnelId: data.id,
                qualification: 'Infirmier Generaliste',
                serviceId: data.serviceId || null,
                tour: 'Jour'
            });
        }

        Cache.invalidate('medecins');
        UI.toast('Personnel enregistre', 'success');
        UI.hideModal();
        this.renderTab();
    },

    async printFiche(personnelId) {
        const p = await DB.get('personnel', personnelId);
        if (!p) return;
        const [services, medecins] = await Promise.all([DB.getAll('services'), DB.getAll('medecins')]);
        const svc = services.find(s => s.id === p.serviceId);
        const med = medecins.find(m => m.personnelId === p.id);
        const age = p.dateNaissance ? Math.floor((Date.now() - new Date(p.dateNaissance).getTime()) / 31557600000) : null;

        const body = `
            <div class="print-title">FICHE DE PERSONNEL</div>
            <table>
                <tbody>
                <tr><th>Matricule</th><td>${p.matricule || '-'}</td><th>Statut</th><td>${p.statut || '-'}</td></tr>
                <tr><th>Nom complet</th><td colspan="3"><strong>${p.prenom} ${p.nom}</strong></td></tr>
                <tr><th>Type</th><td>${p.type || '-'}</td><th>Age</th><td>${age !== null ? age + ' an(s)' : '-'}</td></tr>
                <tr><th>Sexe</th><td>${p.sexe === 'M' ? 'Masculin' : p.sexe === 'F' ? 'Feminin' : '-'}</td><th>Telephone</th><td>${p.telephone || '-'}</td></tr>
                <tr><th>Service</th><td>${svc ? svc.nom : '-'}</td><th>Spec. (Medecin)</th><td>${med ? (med.specialite || '-') : '-'}</td></tr>
                <tr><th>Date d'embauche</th><td colspan="3">${UI.formatDate(p.dateEmbauche)}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">L'employe</span></div>
                <div><span class="line">La direction des ressources humaines</span></div>
            </div>
        `;
        await Print.open('Fiche personnel - ' + p.prenom + ' ' + p.nom, body);
    },

    async showCongeForm() {
        const personnel = await DB.getAll('personnel');
        const formHtml = UI.buildForm([
            { name: 'personnelId', label: 'Personnel', type: 'select', required: true, options: personnel.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'type', label: 'Type de conge', type: 'select', required: true, options: [
                { value: 'Annuel', label: 'Annuel' }, { value: 'Maladie', label: 'Maladie' }, { value: 'Maternite', label: 'Maternite' }, { value: 'Autre', label: 'Autre' }
            ]},
            { name: 'dateDebut', label: 'Date debut', type: 'date', required: true },
            { name: 'dateFin', label: 'Date fin', type: 'date', required: true },
            { name: 'motif', label: 'Motif', type: 'textarea' }
        ]);
        UI.showModal('Demande de Conge', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="personnelModule.saveConge()">Enregistrer</button>
        `);
    },

    async saveConge() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.personnelId || !data.dateDebut || !data.dateFin) { UI.toast('Champs obligatoires manquants', 'error'); return; }

        // Validation des dates
        const debut = new Date(data.dateDebut);
        const fin = new Date(data.dateFin);
        if (fin < debut) { UI.toast('La date de fin doit etre posterieure a la date de debut', 'error'); return; }

        // Verifie un chevauchement de conge
        const conges = await DB.getAll('conges');
        const chevauche = conges.find(c => c.personnelId === data.personnelId && c.statut !== 'Refuse' &&
            new Date(c.dateDebut) <= fin && new Date(c.dateFin) >= debut);
        if (chevauche) { UI.toast('Conflit: ce personnel a deja un conge sur cette periode', 'error'); return; }

        data.id = DB.generateId();
        data.statut = 'EnAttente';
        await DB.put('conges', data);
        UI.toast('Demande de conge enregistree', 'success');
        UI.hideModal();
        this.renderTab();
    },

    cleanup() {}
};

window.personnelModule = personnelModule;
