const urgencesModule = {
    async show() {
        UI.setPageTitle('Urgences');
        await this.renderView();
    },

    async renderView() {
        const container = document.getElementById('content-area');
        const urgences = await DB.getAll('urgences');
        const patients = await DB.getAll('patients');

        const enAttente = urgences.filter(u => u.statut === 'EnAttente').sort((a, b) => a.niveauTriage - b.niveauTriage);
        const enCours = urgences.filter(u => u.statut === 'EnCours');
        const terminees = urgences.filter(u => u.statut === 'Terminee').sort((a, b) => new Date(b.dateArrivee) - new Date(a.dateArrivee)).slice(0, 20);

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const niveauLabel = (n) => ['', 'Critique', 'Urgent', 'Peu Urgent', 'Non Urgent', 'Differe'][n] || 'N/A';

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9888;', enAttente.length, 'En attente', 'red')}
                ${UI.renderStatCard('&#9829;', enCours.length, 'En cours de prise en charge', 'orange')}
                ${UI.renderStatCard('&#10003;', terminees.length, 'Terminees aujourd\'hui', 'green')}
            </div>

            ${Auth.can('urgences', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="urgencesModule.showForm()">+ Nouvelle Urgence</button></div>' : ''}

            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>File d'attente (triage)</h3></div>
                    ${enAttente.length === 0 ? '<div class="empty-state"><p>Aucune urgence en attente</p></div>' :
                    enAttente.map(u => `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid var(--border-light)">
                            <span class="badge urgency-${u.niveauTriage}">N${u.niveauTriage} - ${niveauLabel(u.niveauTriage)}</span>
                            <div style="flex:1">
                                <strong>${getPat(u.patientId)}</strong><br>
                                <small>${u.motif}</small><br>
                                <small style="color:var(--text-secondary)">${UI.formatDateTime(u.dateArrivee)}</small>
                            </div>
                            ${Auth.can('urgences', 3) ? `<button class="btn btn-sm btn-primary" onclick="urgencesModule.takeCharge('${u.id}')">Prendre en charge</button>` : ''}
                        </div>
                    `).join('')}
                </div>

                <div class="card">
                    <div class="card-header"><h3>En cours de prise en charge</h3></div>
                    ${enCours.length === 0 ? '<div class="empty-state"><p>Aucune urgence en cours</p></div>' :
                    enCours.map(u => `
                        <div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid var(--border-light)">
                            <span class="badge urgency-${u.niveauTriage}">N${u.niveauTriage}</span>
                            <div style="flex:1">
                                <strong>${getPat(u.patientId)}</strong><br>
                                <small>${u.motif}</small>
                            </div>
                            ${Auth.can('urgences', 3) ? `<button class="btn btn-sm btn-success" onclick="urgencesModule.terminate('${u.id}')">Terminer</button>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Historique recent</h3></div>
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => getPat(v) },
                    { field: 'dateArrivee', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'niveauTriage', label: 'Triage', render: (v) => UI.renderBadge(`N${v} - ${niveauLabel(v)}`, `urgency-${v}`) },
                    { field: 'motif', label: 'Motif', render: (v) => v },
                    { field: 'decision', label: 'Decision', render: (v) => UI.renderBadge(v || '-', v === 'Hospitalisation' ? 'danger' : 'success') },
                    { label: 'Actions', render: (v, row) => `<button class="btn btn-sm btn-outline" onclick="urgencesModule.printBillet('${row.id}')">&#128424; Billet</button>` }
                ], terminees, { actions: false })}
            </div>
        `;

        container.innerHTML = html;
    },

    async showForm() {
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'niveauTriage', label: 'Niveau de triage', type: 'select', required: true, options: [
                { value: 1, label: '1 - Critique' }, { value: 2, label: '2 - Urgent' },
                { value: 3, label: '3 - Peu Urgent' }, { value: 4, label: '4 - Non Urgent' }, { value: 5, label: '5 - Differe' }
            ]},
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de la consultation urgente' },
            { name: 'medecinId', label: 'Medecin', type: 'select', options: medecins.map(m => ({ value: m.id, label: m.label })) }
        ]);

        UI.showModal('Nouvelle Urgence', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-danger" onclick="urgencesModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.niveauTriage || !data.motif) {
            UI.toast('Remplissez les champs obligatoires', 'error');
            return;
        }
        data.id = DB.generateId();
        data.dateArrivee = new Date().toISOString();
        data.statut = 'EnAttente';
        await DB.put('urgences', data);
        UI.toast('Urgence enregistree', 'success');
        UI.hideModal();
        this.renderView();
    },

    async takeCharge(id) {
        const u = await DB.get('urgences', id);
        u.statut = 'EnCours';
        u.datePriseEnCharge = new Date().toISOString();
        await DB.put('urgences', u);
        UI.toast('Prise en charge enregistree', 'success');
        this.renderView();
    },

    askDecision() {
        return new Promise(resolve => {
            const canHosp = Auth.can('hospitalisations', 2);
            UI.showModal('Decision finale', `
                <p style="margin-bottom:12px">Quelle est l'orientation de ce patient apres la prise en charge ?</p>
            `, `
                <button class="btn btn-outline" onclick="UI.hideModal(); urgencesModule._decisionResolve('Ambulatoire')">Ambulatoire</button>
                ${canHosp ? '<button class="btn btn-primary" onclick="UI.hideModal(); urgencesModule._decisionResolve(\'Hospitalisation\')">Hospitalisation</button>' : ''}
                <button class="btn btn-warning" onclick="UI.hideModal(); urgencesModule._decisionResolve('Transfert')">Transfert</button>
            `);
            this._decisionResolve = resolve;
        });
    },

    async terminate(id) {
        const u = await DB.get('urgences', id);
        const choix = await this.askDecision();
        if (!choix) return;

        u.statut = 'Terminee';
        u.dateSortie = new Date().toISOString();
        u.decision = choix;
        await DB.put('urgences', u);

        if (choix === 'Hospitalisation' && Auth.can('hospitalisations', 2)) {
            const patients = await DB.getAll('patients');
            const services = (await Meta.getServices()).filter(s => s.actif);
            const lits = await Meta.getLitsDisponibles();
            const pat = patients.find(p => p.id === u.patientId);
            if (services.length > 0 && lits.length > 0) {
                const hospHtml = UI.buildForm([
                    { name: 'serviceId', label: 'Service', type: 'select', required: true, options: services.map(s => ({ value: s.id, label: s.nom })) },
                    { name: 'litId', label: 'Lit disponible', type: 'select', options: lits.map(l => ({ value: l.id, label: l.numero })) }
                ]);
                UI.showModal('Orienter en hospitalisation', `<p>Patient: <strong>${pat ? pat.prenom + ' ' + pat.nom : u.patientId}</strong></p>${hospHtml}`, `
                    <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
                    <button class="btn btn-primary" onclick="urgencesModule.creerHospitalisation('${u.patientId}')">Hospitaliser</button>
                `);
            } else {
                UI.toast('Urgence terminee (pas de lit/service disponible pour l\'hospitalisation)', 'warning');
            }
        } else {
            UI.toast('Urgence terminee', 'success');
        }
        await Auth.log('Terminaison', 'urgences', `Patiente ${u.patientId} -> ${choix}`);
        this.renderView();
    },

    async creerHospitalisation(patientId) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.serviceId || !data.litId) { UI.toast('Service et lit requis', 'error'); return; }

        const lit = await DB.get('lits', data.litId);
        const admission = {
            id: DB.generateId(),
            patientId,
            dateAdmission: new Date().toISOString(),
            motif: 'Admission depuis urgences',
            type: 'Urgence',
            serviceId: data.serviceId,
            litId: data.litId,
            medecinId: null,
            statut: 'EnCours',
            dateSortie: null,
            motifSortie: null
        };
        await DB.put('admissions', admission);

        const hosp = {
            id: DB.generateId(),
            patientId,
            admissionId: admission.id,
            serviceId: data.serviceId,
            litId: data.litId,
            dateEntree: new Date().toISOString(),
            dateSortiePrevu: null,
            dateSortieReel: null,
            medecinId: null,
            diagnostic: 'A l\'admission depuis les urgences',
            statut: 'EnCours'
        };
        await DB.put('hospitalisations', hosp);

        if (lit) { lit.statut = 'Occupe'; await DB.put('lits', lit); }

        UI.toast('Patient hospitalise avec succes', 'success');
        await Auth.log('Hospitalisation', 'urgences', `Patient ${patientId}`);
        UI.hideModal();
        this.renderView();
    },

    async printBillet(id) {
        const u = await DB.get('urgences', id);
        if (!u) return;
        const [patients, medecins] = await Promise.all([DB.getAll('patients'), Meta.getMedecins()]);
        const pat = patients.find(p => p.id === u.patientId);
        const med = medecins.find(m => m.id === u.medecinId);
        const niveaux = ['', 'Critique', 'Urgent', 'Peu Urgent', 'Non Urgent', 'Differe'];

        const body = `
            <div class="print-title">BILLET DE PRISE EN CHARGE - URGENCES</div>
            <table>
                <tbody>
                <tr><th>N. Urgence</th><td>${u.id.slice(-8).toUpperCase()}</td><th>Date arrivee</th><td>${UI.formatDateTime(u.dateArrivee)}</td></tr>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : u.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Triage</th><td>N${u.niveauTriage} - ${niveaux[u.niveauTriage] || 'N/A'}</td><th>Medecin</th><td>${med ? med.label : (u.medecinId || '-')}</td></tr>
                <tr><th>Motif</th><td colspan="3">${u.motif || '-'}</td></tr>
                <tr><th>Statut</th><td>${u.statut === 'Terminee' ? 'Terminee' : u.statut}</td><th>Decision</th><td>${u.decision || '-'}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">Le service des urgences</span></div>
            </div>
        `;
        await Print.open('Billet urgence - ' + (pat ? pat.nom : ''), body);
    },

    cleanup() {}
};

window.urgencesModule = urgencesModule;
