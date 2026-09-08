const laboratoireModule = {
    tab: 'demandes',

    async show() {
        UI.setPageTitle('Laboratoire');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'demandes' ? 'active' : ''}" onclick="laboratoireModule.switchTab('demandes')">Demandes d'examens</button>
                <button class="tab ${this.tab === 'resultats' ? 'active' : ''}" onclick="laboratoireModule.switchTab('resultats')">Resultats</button>
            </div>
            <div id="lab-content"></div>
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
        const content = document.getElementById('lab-content');
        if (this.tab === 'demandes') await this.renderDemandes(content);
        else await this.renderResultats(content);
    },

    async renderDemandes(container) {
        const demandes = await DB.getAll('demandesExamen');
        const patients = await DB.getAll('patients');
        const types = await DB.getAll('typesExamen');

        demandes.sort((a, b) => new Date(b.dateDemande) - new Date(a.dateDemande));

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getType = (id) => { const t = types.find(x => x.id === id); return t ? t.nom : id; };

        const badgePriorite = (p) => {
            const colors = { Normale: 'info', Urgente: 'warning', TresUrgente: 'danger' };
            return UI.renderBadge(p, colors[p] || 'gray');
        };

        let html = `
            <div class="toolbar"><div class="toolbar-right">
                ${Auth.can('laboratoire', 3) ? '<button class="btn btn-primary" onclick="laboratoireModule.showDemandeForm()">+ Nouvelle Demande</button>' : ''}
            </div></div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'typeExamenId', label: 'Type Examen', render: (v) => getType(v) },
                    { field: 'dateDemande', label: 'Date', render: (v) => UI.formatDate(v) },
                    { field: 'priorite', label: 'Priorite', render: (v) => badgePriorite(v) },
                    { field: 'statut', label: 'Statut', render: (v) => {
                        const colors = { Demande: 'warning', EnCours: 'info', Realisee: 'success' };
                        return UI.renderBadge(v, colors[v] || 'gray');
                    }},
                    { label: 'Actions', render: (v, row) => {
                        let btns = `<button class="btn btn-sm btn-outline" onclick="laboratoireModule.printDemande('${row.id}')">&#128424; Bon</button>`;
                        if (row.statut === 'Demande' && Auth.can('laboratoire', 3)) {
                            btns += `<button class="btn btn-sm btn-primary" onclick="laboratoireModule.startExam('${row.id}')">Demarrer</button>`;
                        }
                        if (row.statut === 'EnCours' && Auth.can('laboratoire', 3)) {
                            btns += `<button class="btn btn-sm btn-success" onclick="laboratoireModule.showResultatForm('${row.id}')">Saisir resultat</button>`;
                        }
                        return btns;
                    }}
                ], demandes, { actions: false, emptyTitle: 'Aucune demande', emptyText: 'Aucune demande d\'examen.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async renderResultats(container) {
        const resultats = await DB.getAll('resultatsExamen');
        const patients = await DB.getAll('patients');

        resultats.sort((a, b) => new Date(b.dateRealisation) - new Date(a.dateRealisation));

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };

        let html = `
            <div class="card">
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'dateRealisation', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v === 'Valide' ? 'Valide' : 'En attente', v === 'Valide' ? 'success' : 'warning') },
                    { field: 'validePar', label: 'Valide par', render: (v) => v || '-' },
                    { label: 'Actions', render: (v, row) => `<button class="btn btn-sm btn-outline" onclick="laboratoireModule.printResultat('${row.id}')">&#128424; Resultat</button>` }
                ], resultats, { actions: false, emptyTitle: 'Aucun resultat', emptyText: 'Aucun resultat d\'examen enregistre.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showDemandeForm() {
        const patients = await DB.getAll('patients');
        const types = await DB.getAll('typesExamen');
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'typeExamenId', label: 'Type d\'examen', type: 'select', required: true, options: types.map(t => ({ value: t.id, label: `${t.nom} (${UI.formatMoney(t.cout)})` })) },
            { name: 'medecinId', label: 'Medecin prescripteur', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'priorite', label: 'Priorite', type: 'select', options: [{ value: 'Normale', label: 'Normale' }, { value: 'Urgente', label: 'Urgente' }, { value: 'TresUrgente', label: 'Tres Urgente' }] },
            { name: 'motif', label: 'Motif / Clinical context', placeholder: 'Contexte clinique' }
        ]);
        UI.showModal('Nouvelle Demande d\'Examen', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="laboratoireModule.saveDemande()">Enregistrer</button>
        `);
    },

    async saveDemande() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.typeExamenId) { UI.toast('Champs obligatoires manquants', 'error'); return; }
        data.id = DB.generateId();
        data.dateDemande = new Date().toISOString();
        data.statut = 'Demande';
        await DB.put('demandesExamen', data);
        UI.toast('Demande enregistree', 'success');
        UI.hideModal();
        this.renderTab();
    },

    async startExam(id) {
        const d = await DB.get('demandesExamen', id);
        d.statut = 'EnCours';
        await DB.put('demandesExamen', d);
        UI.toast('Examen demarre', 'success');
        this.renderTab();
    },

    async showResultatForm(demandeId) {
        const formHtml = `
            <div class="form-group">
                <label>Resultats (texte)</label>
                <textarea name="resultats" rows="6" placeholder="Saisir les resultats de l'analyse..."></textarea>
            </div>
        `;
        UI.showModal('Saisie Resultat', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-success" onclick="laboratoireModule.saveResultat('${demandeId}')">Valider</button>
        `);
    },

    async saveResultat(demandeId) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        const demande = await DB.get('demandesExamen', demandeId);

        const resultat = {
            id: DB.generateId(),
            demandeId,
            patientId: demande.patientId,
            laborantinId: Auth.currentUser.id,
            dateRealisation: new Date().toISOString(),
            resultats: [{ text: data.resultats }],
            statut: 'Valide',
            validePar: Auth.currentUser.nomComplet,
            dateValidation: new Date().toISOString()
        };
        await DB.put('resultatsExamen', resultat);

        demande.statut = 'Realisee';
        await DB.put('demandesExamen', demande);

        const types = await DB.getAll('typesExamen');
        const te = types.find(t => t.id === demande.typeExamenId);
        const montant = await Billing.montantExamen(te);
        if (montant > 0) {
            await Billing.addLigne(demande.patientId, {
                description: 'Examen ' + (te ? te.nom : ''),
                montant,
                source: 'demandesExamen',
                sourceId: demandeId
            });
        }

        UI.toast('Resultat enregistre et valide', 'success');
        UI.hideModal();
        this.renderTab();
    },

    async printDemande(demandeId) {
        const d = await DB.get('demandesExamen', demandeId);
        if (!d) return;
        const [patients, types, medecins] = await Promise.all([DB.getAll('patients'), DB.getAll('typesExamen'), Meta.getMedecins()]);
        const pat = patients.find(p => p.id === d.patientId);
        const te = types.find(t => t.id === d.typeExamenId);
        const med = medecins.find(m => m.id === d.medecinId);

        const body = `
            <div class="print-title">BON DE DEMANDE D'EXAMEN - LABORATOIRE</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : d.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Examen</th><td>${te ? te.nom : d.typeExamenId}</td><th>Priorite</th><td>${d.priorite || 'Normale'}</td></tr>
                <tr><th>Medecin prescripteur</th><td>${med ? med.label : (d.medecinId || '-')}</td><th>Date</th><td>${UI.formatDateTime(d.dateDemande)}</td></tr>
                <tr><th>Motif</th><td colspan="3">${d.motif || '-'}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">Le laboratoire</span></div>
            </div>
        `;
        await Print.open('Bon de demande - ' + (pat ? pat.nom : ''), body);
    },

    async printResultat(resultatId) {
        const r = await DB.get('resultatsExamen', resultatId);
        if (!r) return;
        const [patients, demandes, types] = await Promise.all([DB.getAll('patients'), DB.getAll('demandesExamen'), DB.getAll('typesExamen')]);
        const pat = patients.find(p => p.id === r.patientId);
        const demande = demandes.find(d => d.id === r.demandeId);
        const te = types.find(t => t.id === demande && demande.typeExamenId);

        const resultats = (r.resultats || []).map(x => `<p>${x.text || x || ''}</p>`).join('');

        const body = `
            <div class="print-title">FEUILLE DE RESULTATS - LABORATOIRE</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : r.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Examen</th><td>${te ? te.nom : (demande ? demande.typeExamenId : '-')}</td><th>Date realisation</th><td>${UI.formatDateTime(r.dateRealisation)}</td></tr>
                <tr><th>Valide par</th><td>${r.validePar || '-'}</td><th>Date validation</th><td>${r.dateValidation ? UI.formatDateTime(r.dateValidation) : '-'}</td></tr>
                </tbody>
            </table>
            <h4 style="margin:12px 0 6px">Resultats</h4>
            <div style="border:1px solid #dadce0;padding:10px 12px;min-height:60px">${resultats || '-'}</div>
            <p style="margin-top:10px;color:#5f6368;font-size:11px">Document medico-legal : a conserver dans le dossier du patient.</p>
            <div class="print-sign">
                <div><span class="line">Le laborantin</span></div>
                <div><span class="line">Le patient</span></div>
            </div>
        `;
        await Print.open('Resultat examen - ' + (pat ? pat.nom : ''), body);
    },

    cleanup() {}
};

window.laboratoireModule = laboratoireModule;
