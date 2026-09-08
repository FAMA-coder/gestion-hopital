const imagerieModule = {
    async show() {
        UI.setPageTitle('Imagerie Medicale');
        const container = document.getElementById('content-area');
        const exams = await DB.getAll('examensImagerie');
        const patients = await DB.getAll('patients');

        exams.sort((a, b) => new Date(b.dateDemande) - new Date(a.dateDemande));

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };

        const statsDemandes = exams.filter(e => e.statut === 'Demande').length;
        const statsPlanifiees = exams.filter(e => e.statut === 'Planifiee').length;
        const statsRealisees = exams.filter(e => e.statut === 'Realisee').length;

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9884;', statsDemandes, 'Demandes', 'warning')}
                ${UI.renderStatCard('&#9881;', statsPlanifiees, 'Planifiees', 'blue')}
                ${UI.renderStatCard('&#10003;', statsRealisees, 'Realisees', 'green')}
            </div>

            ${Auth.can('imagerie', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="imagerieModule.showForm()">+ Nouvel Examen Imagerie</button></div>' : ''}

            <div class="card">
                <div class="card-header"><h3>Examens d'imagerie</h3></div>
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, 'purple') },
                    { field: 'dateDemande', label: 'Date', render: (v) => UI.formatDate(v) },
                    { field: 'priorite', label: 'Priorite', render: (v) => UI.renderBadge(v, v === 'Urgente' ? 'danger' : 'info') },
                    { field: 'statut', label: 'Statut', render: (v) => {
                        const colors = { Demande: 'warning', Planifiee: 'info', Realisee: 'success' };
                        return UI.renderBadge(v, colors[v] || 'gray');
                    }},
                    { label: 'Actions', render: (v, row) => {
                        let btns = `<button class="btn btn-sm btn-outline" onclick="imagerieModule.printDemande('${row.id}')">&#128424; Bon</button>`;
                        if (row.statut === 'Demande' && Auth.can('imagerie', 3))
                            btns += `<button class="btn btn-sm btn-primary" onclick="imagerieModule.planifier('${row.id}')">Planifier</button>`;
                        if (row.statut === 'Planifiee' && Auth.can('imagerie', 3))
                            btns += `<button class="btn btn-sm btn-success" onclick="imagerieModule.showResultatForm('${row.id}')">Saisir resultat</button>`;
                        if (row.statut === 'Realisee')
                            btns += `<button class="btn btn-sm btn-outline" onclick="imagerieModule.printCompteRendu('${row.id}')">&#128424; C.R.</button>`;
                        return btns;
                    }}
                ], exams, { actions: false, emptyTitle: 'Aucun examen', emptyText: 'Aucun examen d\'imagerie enregistre.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showForm() {
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'medecinId', label: 'Medecin prescripteur', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'type', label: 'Type d\'examen', type: 'select', required: true, options: [
                { value: 'Radio', label: 'Radiographie' }, { value: 'Echographie', label: 'Echographie' },
                { value: 'IRM', label: 'IRM' }, { value: 'Scanner', label: 'Scanner' },
                { value: 'Mammographie', label: 'Mammographie' }
            ]},
            { name: 'priorite', label: 'Priorite', type: 'select', options: [{ value: 'Normale', label: 'Normale' }, { value: 'Urgente', label: 'Urgente' }] },
            { name: 'indications', label: 'Indications cliniques', type: 'textarea', placeholder: 'Indications pour l\'examen' }
        ]);
        UI.showModal('Nouvel Examen Imagerie', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="imagerieModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.type) { UI.toast('Champs obligatoires manquants', 'error'); return; }
        data.id = DB.generateId();
        data.dateDemande = new Date().toISOString();
        data.statut = 'Demande';
        await DB.put('examensImagerie', data);
        UI.toast('Examen d\'imagerie enregistre', 'success');
        UI.hideModal();
        this.show();
    },

    async planifier(id) {
        const e = await DB.get('examensImagerie', id);
        e.statut = 'Planifiee';
        await DB.put('examensImagerie', e);
        UI.toast('Examen planifie', 'success');
        this.show();
    },

    async showResultatForm(examenId) {
        const formHtml = `
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="4" placeholder="Description de l'examen..."></textarea>
            </div>
            <div class="form-group">
                <label>Conclusions</label>
                <textarea name="conclusions" rows="4" placeholder="Conclusions du radiologue..."></textarea>
            </div>
        `;
        UI.showModal('Saisie Resultat Imagerie', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-success" onclick="imagerieModule.saveResultat('${examenId}')">Valider</button>
        `);
    },

    async saveResultat(examenId) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        const examen = await DB.get('examensImagerie', examenId);

        const resultat = {
            id: DB.generateId(),
            examenId,
            patientId: examen.patientId,
            technicienId: Auth.currentUser.id,
            dateRealisation: new Date().toISOString(),
            description: data.description,
            conclusions: data.conclusions,
            images: [],
            validePar: Auth.currentUser.nomComplet,
            dateValidation: new Date().toISOString(),
            statut: 'Valide'
        };
        await DB.put('resultatsImagerie', resultat);

        examen.statut = 'Realisee';
        await DB.put('examensImagerie', examen);

        const libelles = { Radio: 'Radiographie', Echographie: 'Echographie', IRM: 'IRM', Scanner: 'Scanner', Mammographie: 'Mammographie' };
        const lib = libelles[examen.type] || examen.type;
        const tarifs = await DB.getAll('tarifs');
        const tarif = tarifs.find(t => t.categorie === 'Imagerie' && t.libelle === lib && t.actif !== false) || (await Billing.trouverTarif('Imagerie', null));
        const montant = tarif ? Number(tarif.montant) : 0;
        if (montant > 0) {
            await Billing.addLigne(examen.patientId, {
                description: 'Imagerie - ' + lib,
                montant,
                tarifId: tarif.id,
                source: 'examensImagerie',
                sourceId: examenId
            });
        }

        UI.toast('Resultat imagerie enregistre et valide', 'success');
        UI.hideModal();
        this.show();
    },

    async printDemande(examenId) {
        const e = await DB.get('examensImagerie', examenId);
        if (!e) return;
        const [patients, medecins] = await Promise.all([DB.getAll('patients'), Meta.getMedecins()]);
        const pat = patients.find(p => p.id === e.patientId);
        const med = medecins.find(m => m.id === e.medecinId);

        const body = `
            <div class="print-title">BON DE DEMANDE D'EXAMEN - IMAGERIE</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : e.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Examen</th><td>${e.type || '-'}</td><th>Priorite</th><td>${e.priorite || 'Normale'}</td></tr>
                <tr><th>Medecin prescripteur</th><td>${med ? med.label : (e.medecinId || '-')}</td><th>Date</th><td>${UI.formatDateTime(e.dateDemande)}</td></tr>
                <tr><th>Indications</th><td colspan="3">${e.indications || '-'}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">Le service d'imagerie</span></div>
            </div>
        `;
        await Print.open('Bon imagerie - ' + (pat ? pat.nom : ''), body);
    },

    async printCompteRendu(examenId) {
        const examen = await DB.get('examensImagerie', examenId);
        if (!examen) return;
        const resultats = await DB.getAll('resultatsImagerie');
        const r = resultats.filter(x => x.examenId === examenId).sort((a, b) => new Date(b.dateRealisation) - new Date(a.dateRealisation))[0];
        const [patients] = await Promise.all([DB.getAll('patients')]);
        const pat = patients.find(p => p.id === examen.patientId);

        const body = `
            <div class="print-title">COMPTE-RENDU D'IMAGERIE</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : examen.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Examen</th><td>${examen.type || '-'}</td><th>Date</th><td>${r ? UI.formatDateTime(r.dateRealisation) : UI.formatDateTime(examen.dateDemande)}</td></tr>
                <tr><th>Valide par</th><td colspan="3">${r ? (r.validePar || '-') : '-'}</td></tr>
                </tbody>
            </table>
            <h4 style="margin:12px 0 6px">Description</h4>
            <div style="border:1px solid #dadce0;padding:10px 12px;min-height:50px">${r ? (r.description || '-') : '-'}</div>
            <h4 style="margin:12px 0 6px">Conclusions</h4>
            <div style="border:1px solid #dadce0;padding:10px 12px;min-height:50px">${r ? (r.conclusions || '-') : '-'}</div>
            <div class="print-sign">
                <div><span class="line">Le radiologue</span></div>
                <div><span class="line">Le patient</span></div>
            </div>
        `;
        await Print.open('Compte-rendu imagerie - ' + (pat ? pat.nom : ''), body);
    },

    cleanup() {}
};

window.imagerieModule = imagerieModule;
