const hospitalisationsModule = {
    tab: 'enCours',

    async show() {
        UI.setPageTitle('Hospitalisations');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'enCours' ? 'active' : ''}" onclick="hospitalisationsModule.switchTab('enCours')">En cours</button>
                <button class="tab ${this.tab === 'sorties' ? 'active' : ''}" onclick="hospitalisationsModule.switchTab('sorties')">Sorties</button>
            </div>
            <div id="hosp-content"></div>
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
        const content = document.getElementById('hosp-content');
        if (this.tab === 'enCours') await this.renderEnCours(content);
        else await this.renderSorties(content);
    },

    async renderEnCours(container) {
        const hosps = await DB.getAll('hospitalisations');
        const patients = await DB.getAll('patients');
        const services = await DB.getAll('services');
        const lits = await DB.getAll('lits');

        const enCours = hosps.filter(h => h.statut === 'EnCours');

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getSvc = (id) => { const s = services.find(x => x.id === id); return s ? s.nom : '-'; };
        const getLit = (id) => { const l = lits.find(x => x.id === id); return l ? l.numero : '-'; };

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9829;', enCours.length, 'Patients hospitalises', 'red')}
                ${UI.renderStatCard('&#10010;', enCours.filter(h => new Date(h.dateEntree).toDateString() === new Date().toDateString()).length, 'Entre(e)s aujourd\'hui', 'blue')}
            </div>

            ${Auth.can('hospitalisations', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="hospitalisationsModule.showForm()">+ Nouvelle Hospitalisation</button></div>' : ''}

            <div class="card">
                <div class="card-header"><h3>Patients hospitalises</h3></div>
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'serviceId', label: 'Service', render: (v) => getSvc(v) },
                    { field: 'litId', label: 'Lit', render: (v) => getLit(v) },
                    { field: 'dateEntree', label: 'Entree', render: (v) => UI.formatDate(v) },
                    { field: 'dateSortiePrevu', label: 'Sortie prevue', render: (v) => UI.formatDate(v) },
                    { field: 'diagnostic', label: 'Diagnostic', render: (v) => v || '-' },
                    { field: 'dateEntree', label: 'Jours', render: (v) => {
                        const days = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
                        return `${Math.max(days, 1)}j`;
                    }},
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-outline" onclick="hospitalisationsModule.viewSuivi('${row.id}')">Suivi</button>
                        ${Auth.can('hospitalisations', 3) ? `<button class="btn btn-sm btn-success" onclick="hospitalisationsModule.sortie('${row.id}')">Sortie</button>` : ''}
                    ` }
                ], enCours, { actions: false, emptyTitle: 'Aucune hospitalisation', emptyText: 'Aucun patient actuellement hospitalise.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async renderSorties(container) {
        const hosps = await DB.getAll('hospitalisations');
        const patients = await DB.getAll('patients');
        const services = await DB.getAll('services');

        const terminees = hosps.filter(h => h.statut === 'Terminee').sort((a, b) => new Date(b.dateEntree) - new Date(a.dateEntree)).slice(0, 40);

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getSvc = (id) => { const s = services.find(x => x.id === id); return s ? s.nom : '-'; };

        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3>Sorties d'hospitalisation</h3></div>
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'serviceId', label: 'Service', render: (v) => getSvc(v) },
                    { field: 'dateEntree', label: 'Entree', render: (v) => UI.formatDate(v) },
                    { field: 'dateSortieReel', label: 'Sortie', render: (v) => UI.formatDate(v) },
                    { field: 'diagnostic', label: 'Diagnostic', render: (v) => v || '-' },
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-outline" onclick="hospitalisationsModule.printBulletinSortie('${row.id}')">&#128424; Bulletin</button>
                    ` }
                ], terminees, { actions: false })}
            </div>
        `;
    },

    async showForm() {
        const patients = await DB.getAll('patients');
        const services = (await Meta.getServices()).filter(s => s.actif);
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'serviceId', label: 'Service', type: 'select', required: true, options: services.map(s => ({ value: s.id, label: s.nom })) },
            { name: 'medecinId', label: 'Medecin responsable', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'diagnostic', label: 'Diagnostic', required: true, placeholder: 'Diagnostic d\'entree' },
            { name: 'dateSortiePrevu', label: 'Date sortie prevue', type: 'date' }
        ]);

        UI.showModal('Nouvelle Hospitalisation', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="hospitalisationsModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.serviceId || !data.medecinId || !data.diagnostic) {
            UI.toast('Remplissez les champs obligatoires', 'error'); return;
        }
        data.id = DB.generateId();
        data.dateEntree = new Date().toISOString();
        data.statut = 'EnCours';

        const litsDispo = await Meta.getLitsDisponibles(data.serviceId);
        if (litsDispo.length > 0) {
            data.litId = litsDispo[0].id;
            await DB.put('lits', { ...litsDispo[0], statut: 'Occupe' });
        } else {
            data.litId = null;
            UI.toast('Aucun lit disponible: patient enregistre sans lit', 'warning');
        }

        // Lie automatiquement une admission existante en cours pour ce patient si possible
        const admissions = await DB.getAll('admissions');
        const admEnCours = admissions.find(a => a.patientId === data.patientId && a.statut === 'EnCours');
        if (admEnCours) {
            data.admissionId = admEnCours.id;
            await DB.put('admissions', { ...admEnCours, litId: data.litId || admEnCours.litId });
        } else {
            // Cree une admission de type Hospitalisation liee
            const adm = {
                id: DB.generateId(),
                patientId: data.patientId,
                dateAdmission: data.dateEntree,
                motif: 'Hospitalisation (' + data.diagnostic + ')',
                type: 'Hospitalisation',
                serviceId: data.serviceId,
                litId: data.litId,
                medecinId: data.medecinId,
                statut: 'EnCours',
                dateSortie: null,
                motifSortie: null
            };
            await DB.put('admissions', adm);
            data.admissionId = adm.id;
        }

        await DB.put('hospitalisations', data);
        UI.toast('Hospitalisation enregistree', 'success');
        UI.hideModal();
        this.renderTab();
    },

    async viewSuivi(id) {
        const hosp = await DB.get('hospitalisations', id);
        const patients = await DB.getAll('patients');
        const services = await DB.getAll('services');
        const lits = await DB.getAll('lits');
        const suivis = await DB.getAll('suiviHospitalisation');
        const hospSuivis = suivis.filter(s => s.hospitalisationId === id).sort((a, b) => new Date(b.date) - new Date(a.date));

        const pat = patients.find(p => p.id === hosp.patientId);
        const svc = services.find(s => s.id === hosp.serviceId);
        const lit = lits.find(l => l.id === hosp.litId);

        const suiviHtml = hospSuivis.length === 0
            ? '<div class="empty-state"><p>Aucune observation enregistree.</p></div>'
            : hospSuivis.map(s => `
                <div class="suivi-item">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                        <strong>${UI.formatDateTime(s.date)}</strong>
                        <span class="badge badge-info">par ${s.par || '-'}</span>
                    </div>
                    ${s.temperature ? `<p><strong>Temp:</strong> ${s.temperature}°C</p>` : ''}
                    ${s.ta ? `<p><strong>TA:</strong> ${s.ta} mmHg</p>` : ''}
                    ${s.pouls ? `<p><strong>Pouls:</strong> ${s.pouls} bpm</p>` : ''}
                    ${s.observation ? `<p><strong>Observation:</strong> ${s.observation}</p>` : ''}
                    ${s.traitement ? `<p><strong>Traitement:</strong> ${s.traitement}</p>` : ''}
                </div>
            `).join('');

        UI.showModal(`Suivi hospitalisation - ${pat ? pat.prenom + ' ' + pat.nom : ''}`, `
            <div style="margin-bottom:16px">
                <p><strong>Service:</strong> ${svc ? svc.nom : '-'} | <strong>Lit:</strong> ${lit ? lit.numero : (hosp.litId || 'Non affecte')} | <strong>Entree:</strong> ${UI.formatDate(hosp.dateEntree)}</p>
                <p><strong>Diagnostic:</strong> ${hosp.diagnostic || '-'}</p>
            </div>
            ${Auth.can('hospitalisations', 3) ? `
            <div class="card" style="background:var(--bg)">
                <div class="card-header"><h3>Ajouter une observation</h3></div>
                <div class="form-group"><label>Temperature (°C)</label><input type="number" id="suivi-temp" step="0.1"></div>
                <div class="form-group"><label>Tension arterielle (mmHg)</label><input type="text" id="suivi-ta" placeholder="120/80"></div>
                <div class="form-group"><label>Pouls (bpm)</label><input type="number" id="suivi-pouls"></div>
                <div class="form-group"><label>Observation</label><textarea id="suivi-obs" placeholder="Examen clinique, evolution..."></textarea></div>
                <div class="form-group"><label>Traitement / Prescription</label><textarea id="suivi-traitement" placeholder="Traitements administres..."></textarea></div>
                <button class="btn btn-primary" onclick="hospitalisationsModule.addSuivi('${id}')">Ajouter l'observation</button>
            </div>` : ''}
            <div style="margin-top:16px">
                <h4>Historique des observations (${hospSuivis.length})</h4>
                ${suiviHtml}
            </div>
        `, `<button class="btn btn-outline" onclick="UI.hideModal()">Fermer</button>`);
    },

    async addSuivi(id) {
        const observation = document.getElementById('suivi-obs').value;
        const traitement = document.getElementById('suivi-traitement').value;
        if (!observation && !traitement) { UI.toast('Ajoutez une observation ou un traitement', 'warning'); return; }

        await DB.put('suiviHospitalisation', {
            id: DB.generateId(),
            hospitalisationId: id,
            date: new Date().toISOString(),
            temperature: document.getElementById('suivi-temp').value,
            ta: document.getElementById('suivi-ta').value,
            pouls: document.getElementById('suivi-pouls').value,
            observation,
            traitement,
            par: Auth.currentUser.nomComplet
        });
        UI.toast('Observation ajoutee', 'success');
        this.viewSuivi(id);
    },

    async sortie(id) {
        const hosp = await DB.get('hospitalisations', id);
        hosp.statut = 'Terminee';
        hosp.dateSortieReel = new Date().toISOString();

        // Libere le lit
        if (hosp.litId) {
            const lit = await DB.get('lits', hosp.litId);
            if (lit) { lit.statut = 'Libre'; await DB.put('lits', lit); }
        }

        // Synchronise l'admission liee
        if (hosp.admissionId) {
            const adm = await DB.get('admissions', hosp.admissionId);
            if (adm && adm.statut === 'EnCours') {
                adm.statut = 'Terminee';
                adm.dateSortie = hosp.dateSortieReel;
                adm.motifSortie = 'Sortie d\'hospitalisation';
                adm.litId = null;
                await DB.put('admissions', adm);
            }
        }

        await DB.put('hospitalisations', hosp);

        const jours = Math.max(1, Math.ceil((new Date(hosp.dateSortieReel) - new Date(hosp.dateEntree)) / 86400000));
        const lits = await DB.getAll('lits');
        const lit = hosp.litId ? lits.find(l => l.id === hosp.litId) : null;
        const tHosp = await Billing.trouverTarif('Hospitalisation', hosp.serviceId);
        const jourCout = (tHosp ? Number(tHosp.montant) : 0) || (lit && Number(lit.jourCout)) || 0;
        const montantHosp = jourCout ? jourCout * jours : 0;
        if (montantHosp > 0) {
            await Billing.addLigne(hosp.patientId, {
                description: 'Hospitalisation - ' + jours + ' jour(s)',
                montant: montantHosp,
                tarifId: tHosp ? tHosp.id : null,
                source: 'hospitalisations',
                sourceId: id
            });
        }

        UI.toast('Sortie enregistree', 'success');
        this.renderTab();
    },

    async printBulletinSortie(id) {
        const hosp = await DB.get('hospitalisations', id);
        if (!hosp) return;
        const [patients, services, lits, medecins] = await Promise.all([DB.getAll('patients'), DB.getAll('services'), DB.getAll('lits'), Meta.getMedecins()]);
        const pat = patients.find(p => p.id === hosp.patientId);
        const svc = services.find(s => s.id === hosp.serviceId);
        const lit = hosp.litId ? lits.find(l => l.id === hosp.litId) : null;
        const med = medecins.find(m => m.id === hosp.medecinId);
        const duree = hosp.dateEntree && hosp.dateSortieReel
            ? Math.max(1, Math.ceil((new Date(hosp.dateSortieReel) - new Date(hosp.dateEntree)) / 86400000)) + ' jour(s)'
            : '-';

        const body = `
            <div class="print-title">BULLETIN DE SORTIE</div>
            <table>
                <tbody>
                <tr><th>N. Hospitalisation</th><td>${hosp.id.slice(-8).toUpperCase()}</td><th>Entree</th><td>${UI.formatDateTime(hosp.dateEntree)}</td></tr>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : hosp.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Service</th><td>${svc ? svc.nom : '-'}</td><th>Lit</th><td>${lit ? lit.numero : (hosp.litId || '-')}</td></tr>
                <tr><th>Medecin</th><td>${med ? med.label : (hosp.medecinId || '-')}</td><th>Duree</th><td>${duree}</td></tr>
                <tr><th>Diagnostic</th><td colspan="3">${hosp.diagnostic || '-'}</td></tr>
                <tr><th>Date sortie</th><td colspan="3">${UI.formatDateTime(hosp.dateSortieReel)}</td></tr>
                </tbody>
            </table>
            <p style="margin-top:12px;color:#5f6368">Recommandations de sortie du service d'hospitalisation. Merci de respecter la conduite indiquee par le medecin traitant.</p>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">Le medecin</span></div>
            </div>
        `;
        await Print.open('Bulletin de sortie - ' + (pat ? pat.nom : ''), body);
    },

    cleanup() {}
};

window.hospitalisationsModule = hospitalisationsModule;
