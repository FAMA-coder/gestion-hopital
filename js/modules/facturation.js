const facturationModule = {
    tab: 'factures',

    async show() {
        UI.setPageTitle('Facturation & Caisse');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'factures' ? 'active' : ''}" onclick="facturationModule.switchTab('factures')">Factures</button>
                <button class="tab ${this.tab === 'assurances' ? 'active' : ''}" onclick="facturationModule.switchTab('assurances')">Assurances</button>
            </div>
            <div id="facturation-content"></div>
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
        const content = document.getElementById('facturation-content');
        if (this.tab === 'factures') await this.renderFactures(content);
        else await this.renderAssurances(content);
    },

    async renderFactures(container) {
        const factures = await DB.getAll('factures');
        const patients = await DB.getAll('patients');

        factures.sort((a, b) => new Date(b.date) - new Date(a.date));

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };

        const totalFactures = factures.reduce((s, f) => s + f.montantTotal, 0);
        const totalEncaisse = factures.reduce((s, f) => s + (f.montantPaye || 0), 0);
        const totalImpaye = factures.reduce((s, f) => s + (f.resteApayer || 0), 0);

        const statutBadge = (s) => {
            const colors = { Impayee: 'warning', PartiellementPayee: 'info', EntierementPayee: 'success', Annulee: 'danger' };
            return UI.renderBadge(s === 'PartiellementPayee' ? 'Partielle' : s === 'Impayee' ? 'Impayee' : s, colors[s] || 'gray');
        };

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9830;', UI.formatMoney(totalFactures), 'Total facture', 'purple')}
                ${UI.renderStatCard('&#10003;', UI.formatMoney(totalEncaisse), 'Total encaisse', 'green')}
                ${UI.renderStatCard('&#10007;', UI.formatMoney(totalImpaye), 'Impayes', 'red')}
            </div>

            ${Auth.can('facturation', 1) ? '<div style="margin-bottom:16px"><button class="btn btn-outline" onclick="facturationModule.showReleveForm()">&#128424; Releve de compte patient</button></div>' : ''}
            ${Auth.can('facturation', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="facturationModule.showFactureForm()">+ Nouvelle Facture</button></div>' : ''}

            <div class="card">
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'date', label: 'Date', render: (v) => UI.formatDate(v) },
                    { field: 'montantTotal', label: 'Total', render: (v) => `<strong>${UI.formatMoney(v)}</strong>` },
                    { field: 'montantPaye', label: 'Paye', render: (v) => UI.formatMoney(v) },
                    { field: 'resteApayer', label: 'Reste', render: (v) => UI.formatMoney(v) },
                    { field: 'modePaiement', label: 'Mode', render: (v) => UI.renderBadge(v, 'info') },
                    { field: 'statut', label: 'Statut', render: (v) => statutBadge(v) },
                    { label: 'Actions', render: (v, row) => {
                        let btns = `<button class="btn btn-sm btn-outline" title="Imprimer la facture" onclick="facturationModule.printFacture('${row.id}')">&#128424;</button>`;
                        if (row.statut !== 'EntierementPayee' && row.statut !== 'Annulee' && Auth.can('facturation', 3))
                            btns += `<button class="btn btn-sm btn-success" onclick="facturationModule.showPaiementForm('${row.id}')">Encaisser</button>`;
                        return btns;
                    }}
                ], factures, { actions: false, emptyTitle: 'Aucune facture', emptyText: 'Aucune facture enregistree.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async renderAssurances(container) {
        const assurances = await DB.getAll('assurances');
        let html = `
            ${Auth.can('facturation', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="facturationModule.showAssuranceForm()">+ Nouvelle Assurance</button></div>' : ''}
            <div class="card">
                ${UI.renderTable([
                    { field: 'nom', label: 'Nom', render: (v) => `<strong>${v}</strong>` },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, v === 'Privee' ? 'purple' : 'info') },
                    { field: 'couverturePourcentage', label: 'Couverture', render: (v) => `${v}%` },
                    { field: 'telephone', label: 'Telephone', render: (v) => v || '-' },
                    { field: 'contact', label: 'Contact', render: (v) => v || '-' },
                    { field: 'actif', label: 'Statut', render: (v) => UI.renderBadge(v ? 'Actif' : 'Inactif', v ? 'success' : 'gray') }
                ], assurances, { actions: false })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showFactureForm() {
        const patients = await DB.getAll('patients');
        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'description', label: 'Description', placeholder: 'Ex: Consultation + Examens' },
            { name: 'montantTotal', label: 'Montant total', type: 'number', required: true },
            { name: 'modePaiement', label: 'Mode de paiement', type: 'select', options: [
                { value: 'Especes', label: 'Especes' }, { value: 'Carte', label: 'Carte' }, { value: 'Virement', label: 'Virement' }, { value: 'Assurance', label: 'Assurance' }, { value: 'Mutuelle', label: 'Mutuelle' }
            ]},
            { name: 'montantPaye', label: 'Montant paye', type: 'number', default: '0' }
        ]);
        UI.showModal('Nouvelle Facture', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="facturationModule.saveFacture()">Enregistrer</button>
        `);
    },

    async saveFacture() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.montantTotal) { UI.toast('Champs obligatoires manquants', 'error'); return; }
        data.id = DB.generateId();
        data.date = new Date().toISOString();
        data.montantTotal = Number(data.montantTotal);
        data.montantPaye = Math.min(Number(data.montantPaye || 0), data.montantTotal);
        data.resteApayer = data.montantTotal - data.montantPaye;
        data.statut = data.resteApayer <= 0 ? 'EntierementPayee' : (data.montantPaye > 0 ? 'PartiellementPayee' : 'Impayee');
        data.lignes = data.description ? [{ description: data.description, montant: data.montantTotal }] : [];
        await DB.put('factures', data);
        UI.toast('Facture enregistree', 'success');
        UI.hideModal();
        this.renderTab();
    },

    async showPaiementForm(factureId) {
        const facture = await DB.get('factures', factureId);
        UI.showModal('Encaissement', `
            <p><strong>Montant total:</strong> ${UI.formatMoney(facture.montantTotal)}</p>
            <p><strong>Deja paye:</strong> ${UI.formatMoney(facture.montantPaye)}</p>
            <p><strong>Reste a payer:</strong> <span style="color:var(--danger)">${UI.formatMoney(facture.resteApayer)}</span></p>
            <div class="form-group" style="margin-top:16px">
                <label>Montant a encaisser (max: ${UI.formatMoney(facture.resteApayer)})</label>
                <input type="number" id="paiement-montant" value="${facture.resteApayer}" max="${facture.resteApayer}" min="0">
            </div>
            <div class="form-group">
                <label>Mode de paiement</label>
                <select id="paiement-mode">
                    <option value="Especes">Especes</option>
                    <option value="Carte">Carte</option>
                    <option value="Virement">Virement</option>
                    <option value="Assurance">Assurance</option>
                </select>
            </div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-success" onclick="facturationModule.savePaiement('${factureId}')">Encaisser</button>
        `);
    },

    async savePaiement(factureId) {
        const facture = await DB.get('factures', factureId);
        const montant = Number(document.getElementById('paiement-montant').value);
        const mode = document.getElementById('paiement-mode').value;

        if (!montant || montant <= 0) { UI.toast('Montant invalide', 'error'); return; }
        if (montant > facture.resteApayer) { UI.toast(`Le montant ne peut pas depasser ${UI.formatMoney(facture.resteApayer)}`, 'error'); return; }

        facture.montantPaye = (facture.montantPaye || 0) + montant;
        facture.resteApayer = facture.montantTotal - facture.montantPaye;
        facture.statut = facture.resteApayer <= 0 ? 'EntierementPayee' : 'PartiellementPayee';
        facture.modePaiement = mode;
        await DB.put('factures', facture);

        await DB.put('paiements', {
            id: DB.generateId(),
            factureId,
            patientId: facture.patientId,
            date: new Date().toISOString(),
            montant,
            mode,
            caissierId: Auth.currentUser.id
        });

        UI.toast(`Encaissement de ${UI.formatMoney(montant)} effectue`, 'success');
        UI.hideModal();
        this.renderTab();
    },

    async printFacture(factureId) {
        const facture = await DB.get('factures', factureId);
        if (!facture) return;
        const [patients, users] = await Promise.all([DB.getAll('patients'), DB.getAll('users')]);
        const p = patients.find(x => x.id === facture.patientId);
        const statutColor = { Impayee: 'danger', PartiellementPayee: 'warning', EntierementPayee: 'success', Annulee: 'gray' }[facture.statut] || 'gray';
        const statutLabel = facture.statut === 'PartiellementPayee' ? 'Partielle' : facture.statut === 'Impayee' ? 'Impayee' : facture.statut;
        const statutBadgeFact = `<span class="badge badge-${statutColor}">${statutLabel}</span>`;

        const lignes = (facture.lignes && facture.lignes.length)
            ? facture.lignes.map((l, i) => `<tr><td>${i + 1}</td><td>${l.description || '-'}</td><td style="text-align:right">${UI.formatMoney(l.montant)}</td></tr>`).join('')
            : `<tr><td>1</td><td>${facture.description || 'Soins hospitaliers'}</td><td style="text-align:right">${UI.formatMoney(facture.montantTotal)}</td></tr>`;

        const body = `
            <div class="print-title">FACTURE N. ${facture.id.slice(-8).toUpperCase()}</div>
            <table>
                <tbody>
                <tr><th>Date</th><td>${UI.formatDateTime(facture.date)}</td><th>Statut</th><td>${statutBadgeFact}</td></tr>
                <tr><th>Patient</th><td colspan="3">${p ? p.nom + ' ' + p.prenom + (p.matricule ? ' (' + p.matricule + ')' : '') : facture.patientId}</td></tr>
                </tbody>
            </table>
            <table>
                <thead><tr><th>#</th><th>Designation</th><th style="text-align:right">Montant</th></tr></thead>
                <tbody>${lignes}</tbody>
                <tfoot>
                    <tr><th colspan="2" style="text-align:right">Total facture</th><th class="print-total" style="text-align:right">${UI.formatMoney(facture.montantTotal)}</th></tr>
                    <tr><th colspan="2" style="text-align:right">Montant paye</th><td style="text-align:right">${UI.formatMoney(facture.montantPaye)}</td></tr>
                    <tr><th colspan="2" style="text-align:right">Reste a payer</th><td style="text-align:right">${UI.formatMoney(facture.resteApayer)}</td></tr>
                </tfoot>
            </table>
            <p style="color:#5f6368;margin-top:8px">Mode de paiement : <strong>${facture.modePaiement || '-'}</strong></p>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">La caisse / Le caissier</span></div>
            </div>
        `;
        await Print.open('Facture ' + facture.id.slice(-8).toUpperCase() + (p ? ' - ' + p.nom : ''), body);
    },

    async showReleveForm() {
        const patients = await DB.getAll('patients');
        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) }
        ]);
        UI.showModal('Releve de compte patient', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="facturationModule.printReleve()">Imprimer</button>
        `);
    },

    async printReleve() {
        const formEl = document.querySelector('.modal-body');
        const patientId = formEl.querySelector('[name="patientId"]').value;
        if (!patientId) { UI.toast('Selectionnez un patient', 'error'); return; }

        const factures = await DB.getAll('factures');
        const facturesPat = factures.filter(f => f.patientId === patientId).sort((a, b) => new Date(a.date) - new Date(b.date));
        const patients = await DB.getAll('patients');

        const pat = patients.find(p => p.id === patientId);
        const rows = facturesPat.map(f => `<tr>
            <td>${f.id.slice(-8).toUpperCase()}</td><td>${UI.formatDate(f.date)}</td>
            <td style="text-align:right">${UI.formatMoney(f.montantTotal)}</td>
            <td style="text-align:right">${UI.formatMoney(f.montantPaye)}</td>
            <td style="text-align:right">${UI.formatMoney(f.resteApayer)}</td><td>${f.statut}</td>
        </tr>`).join('');
        const totalFact = facturesPat.reduce((s, f) => s + f.montantTotal, 0);
        const totalPaye = facturesPat.reduce((s, f) => s + (f.montantPaye || 0), 0);
        const reste = totalFact - totalPaye;

        const body = `
            <div class="print-title">RELEVE DE COMPTE PATIENT</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Date du releve</th><td colspan="3">${new Date().toLocaleDateString('fr-FR')}</td></tr>
                </tbody>
            </table>
            <table>
                <thead><tr><th>N. Facture</th><th>Date</th><th style="text-align:right">Total</th><th style="text-align:right">Paye</th><th style="text-align:right">Reste</th><th>Statut</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6">Aucune facture pour ce patient</td></tr>'}</tbody>
                <tfoot>
                    <tr><th colspan="2" style="text-align:right">Totaux</th><th style="text-align:right">${UI.formatMoney(totalFact)}</th><th style="text-align:right">${UI.formatMoney(totalPaye)}</th><th style="text-align:right">${UI.formatMoney(reste)}</th><td></td></tr>
                </tfoot>
            </table>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">La caisse</span></div>
            </div>
        `;
        await Print.open('Releve de compte - ' + (pat ? pat.prenom + ' ' + pat.nom : ''), body);
        UI.hideModal();
    },

    async showAssuranceForm() {
        const formHtml = UI.buildForm([
            { name: 'nom', label: 'Nom', required: true },
            { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Privee', label: 'Privee' }, { value: 'Mutuelle', label: 'Mutuelle' }, { value: 'Nationale', label: 'Nationale' }] },
            { name: 'couverturePourcentage', label: 'Couverture (%)', type: 'number', required: true, default: '80' },
            { name: 'telephone', label: 'Telephone' },
            { name: 'contact', label: 'Contact' },
            { name: 'adresse', label: 'Adresse' }
        ]);
        UI.showModal('Nouvelle Assurance', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="facturationModule.saveAssurance()">Enregistrer</button>
        `);
    },

    async saveAssurance() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.nom) { UI.toast('Nom requis', 'error'); return; }
        data.id = DB.generateId();
        data.actif = true;
        await DB.put('assurances', data);
        UI.toast('Assurance enregistree', 'success');
        UI.hideModal();
        this.renderTab();
    },

    cleanup() {}
};

window.facturationModule = facturationModule;
