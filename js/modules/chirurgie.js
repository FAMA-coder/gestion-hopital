const chirurgieModule = {
    async show() {
        UI.setPageTitle('Chirurgie & Bloc Operatoire');
        const container = document.getElementById('content-area');
        const ops = await DB.getAll('operations');
        const patients = await DB.getAll('patients');

        const planifiees = ops.filter(o => o.statut === 'Planifiee');
        const enCours = ops.filter(o => o.statut === 'EnCours');
        const terminees = ops.filter(o => o.statut === 'Terminee').sort((a, b) => new Date(b.datePrevue) - new Date(a.datePrevue)).slice(0, 20);
        const medecins = await Meta.getMedecins();

        const enrich = (o) => {
            const p = patients.find(x => x.id === o.patientId);
            const m = medecins.find(x => x.id === o.medecinId);
            return { ...o, patientNom: p ? `${p.prenom} ${p.nom}` : o.patientId, chirurgienNom: m ? m.label : (o.medecinId || '-') };
        };

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9986;', planifiees.length, 'Planifiees', 'blue')}
                ${UI.renderStatCard('&#9829;', enCours.length, 'En cours', 'red')}
                ${UI.renderStatCard('&#10003;', terminees.length, 'Terminees', 'green')}
            </div>

            ${Auth.can('chirurgie', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="chirurgieModule.showForm()">+ Planifier Intervention</button> <button class="btn btn-outline" onclick="chirurgieModule.printProgramme()">&#128424; Programme operatoire</button></div>' : ''}

            <div class="card">
                <div class="card-header"><h3>Interventions planifiees</h3></div>
                ${UI.renderTable([
                    { field: 'patientNom', label: 'Patient', render: (v) => `<strong>${v}</strong>` },
                    { field: 'typeIntervention', label: 'Type', render: (v) => UI.renderBadge(v, 'purple') },
                    { field: 'chirurgienNom', label: 'Chirurgien', render: (v) => v },
                    { field: 'datePrevue', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'dureeEstimee', label: 'Duree', render: (v) => `${v} min` },
                    { field: 'anesthesie', label: 'Anesthesie', render: (v) => v },
                    { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v, v === 'EnCours' ? 'danger' : 'warning') },
                    { label: 'Actions', render: (v, row) => {
                        if (row.statut === 'Planifiee' && Auth.can('chirurgie', 3))
                            return `<button class="btn btn-sm btn-danger" onclick="chirurgieModule.startOp('${row.id}')">Demarrer</button>`;
                        if (row.statut === 'EnCours' && Auth.can('chirurgie', 3))
                            return `<button class="btn btn-sm btn-success" onclick="chirurgieModule.finishOp('${row.id}')">Terminer</button>`;
                        return '';
                    }}
                ], [...planifiees, ...enCours].map(enrich), { actions: false, emptyTitle: 'Aucune intervention', emptyText: 'Aucune intervention planifiee.' })}
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Interventions terminees</h3></div>
                ${UI.renderTable([
                    { field: 'patientNom', label: 'Patient', render: (v) => v },
                    { field: 'typeIntervention', label: 'Type', render: (v) => v },
                    { field: 'chirurgienNom', label: 'Chirurgien', render: (v) => v },
                    { field: 'datePrevue', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'statut', label: 'Statut', render: () => UI.renderBadge('Terminee', 'success') },
                    { label: 'Actions', render: (v, row) => `<button class="btn btn-sm btn-outline" onclick="chirurgieModule.printCompteRendu('${row.id}')">&#128424; C.R.</button>` }
                ], terminees.map(enrich), { actions: false })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showForm() {
        const patients = await DB.getAll('patients');
        const medecins = (await Meta.getMedecins()).filter(m => m.specialite && m.specialite.toLowerCase().includes('chirurg'));
        const salles = (await DB.getAll('salles')).filter(s => s.serviceId === 'svc2');

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'medecinId', label: 'Chirurgien', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'typeIntervention', label: 'Type d\'intervention', required: true, placeholder: 'Ex: Appendicectomie' },
            { name: 'datePrevue', label: 'Date prevue', type: 'datetime-local', required: true },
            { name: 'dureeEstimee', label: 'Duree estimee (min)', type: 'number', required: true, default: '60' },
            { name: 'salleId', label: 'Salle', type: 'select', options: salles.map(s => ({ value: s.id, label: s.numero })) },
            { name: 'anesthesie', label: 'Type d\'anesthesie', type: 'select', options: [
                { value: 'Locale', label: 'Locale' }, { value: 'Generale', label: 'Generale' }, { value: 'Locoregionale', label: 'Locoregionale' }
            ]}
        ]);
        UI.showModal('Planifier Intervention', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="chirurgieModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.typeIntervention) { UI.toast('Champs obligatoires manquants', 'error'); return; }

        // Conflit de salle sur le meme creneau
        if (data.salleId && data.datePrevue) {
            const ops = await DB.getAll('operations');
            const conflit = ops.find(o => o.salleId === data.salleId && o.datePrevue === data.datePrevue && o.statut !== 'Terminee');
            if (conflit) {
                UI.toast('Conflit: la salle est deja reservee sur ce creneau', 'error');
                return;
            }
        }

        data.id = DB.generateId();
        data.statut = 'Planifiee';
        data.compteRendu = '';
        await DB.put('operations', data);
        UI.toast('Intervention planifiee', 'success');
        UI.hideModal();
        this.show();
    },

    async startOp(id) {
        const o = await DB.get('operations', id);
        o.statut = 'EnCours';
        await DB.put('operations', o);
        UI.toast('Intervention demarree', 'success');
        this.show();
    },

    async finishOp(id) {
        const o = await DB.get('operations', id);
        o.statut = 'Terminee';
        o.compteRendu = 'Compte-rendu a rediger';
        await DB.put('operations', o);

        const tarifs = await DB.getAll('tarifs');
        const tChir = tarifs.find(t => t.categorie === 'Chirurgie' && t.libelle === o.typeIntervention && t.actif !== false) || tarifs.find(t => t.categorie === 'Chirurgie' && t.actif !== false);
        const montantChir = tChir ? Number(tChir.montant) : 0;
        if (montantChir > 0) {
            await Billing.addLigne(o.patientId, {
                description: 'Chirurgie - ' + o.typeIntervention,
                montant: montantChir,
                tarifId: tChir.id,
                source: 'operations',
                sourceId: id
            });
        }

        UI.toast('Intervention terminee', 'success');
        this.show();
    },

    async printProgramme() {
        const ops = await DB.getAll('operations');
        const patients = await DB.getAll('patients');
        const planifiees = ops.filter(o => o.statut === 'Planifiee' || o.statut === 'EnCours')
            .sort((a, b) => new Date(a.datePrevue) - new Date(b.datePrevue));
        const medecins = await Meta.getMedecins();
        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getMed = (id) => { const m = medecins.find(x => x.id === id); return m ? m.label : (id || '-'); };

        const rows = planifiees.map(o => `<tr>
            <td>${UI.formatDateTime(o.datePrevue)}</td><td><strong>${getPat(o.patientId)}</strong></td>
            <td>${o.typeIntervention || '-'}</td><td>${getMed(o.medecinId)}</td><td>${o.dureeEstimee || '-'} min</td><td>${o.anesthesie || '-'}</td>
        </tr>`).join('');

        const body = `
            <div class="print-title">PROGRAMME OPERATOIRE</div>
            <table>
                <thead><tr><th>Date prevue</th><th>Patient</th><th>Intervention</th><th>Chirurgien</th><th>Duree</th><th>Anesthesie</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6">Aucune intervention planifiee</td></tr>'}</tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le chirurgien chef</span></div>
                <div><span class="line">Le bloc operatoire</span></div>
            </div>
        `;
        await Print.open('Programme operatoire', body);
    },

    async printCompteRendu(operationId) {
        const o = await DB.get('operations', operationId);
        if (!o) return;
        const [patients] = await Promise.all([DB.getAll('patients')]);
        const pat = patients.find(p => p.id === o.patientId);
        const cr = (o.compteRendu && o.compteRendu !== 'Compte-rendu a rediger') ? o.compteRendu : '';

        const body = `
            <div class="print-title">COMPTE-RENDU OPERATOIRE</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : o.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Intervention</th><td>${o.typeIntervention || '-'}</td><th>Date</th><td>${UI.formatDateTime(o.datePrevue)}</td></tr>
                <tr><th>Anesthesie</th><td>${o.anesthesie || '-'}</td><th>Salle</th><td>${o.salleId || '-'}</td></tr>
                <tr><th>Statut</th><td colspan="3">${o.statut}</td></tr>
                </tbody>
            </table>
            <h4 style="margin:12px 0 6px">Compte-rendu</h4>
            <div style="border:1px solid #dadce0;padding:10px 12px;min-height:80px">${cr || 'Compte-rendu opereatoire non renseigne.'}</div>
            <div class="print-sign">
                <div><span class="line">Le chirurgien</span></div>
                <div><span class="line">Le patient</span></div>
            </div>
        `;
        await Print.open('Compte-rendu operatoire - ' + (pat ? pat.nom : ''), body);
    },

    cleanup() {}
};

window.chirurgieModule = chirurgieModule;
