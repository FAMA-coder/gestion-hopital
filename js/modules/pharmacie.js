const pharmacieModule = {
    tab: 'stock',

    async show() {
        UI.setPageTitle('Pharmacie');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'stock' ? 'active' : ''}" onclick="pharmacieModule.switchTab('stock')">Stock</button>
                <button class="tab ${this.tab === 'ordonnances' ? 'active' : ''}" onclick="pharmacieModule.switchTab('ordonnances')">Ordonnances</button>
                <button class="tab ${this.tab === 'alertes' ? 'active' : ''}" onclick="pharmacieModule.switchTab('alertes')">Alertes</button>
            </div>
            <div id="pharmacie-content"></div>
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
        const content = document.getElementById('pharmacie-content');
        if (this.tab === 'stock') await this.renderStock(content);
        else if (this.tab === 'ordonnances') await this.renderOrdonnances(content);
        else if (this.tab === 'alertes') await this.renderAlertes(content);
    },

    async renderStock(container) {
        const meds = await DB.getAll('medicaments');
        this._allMeds = meds;

        let html = `
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <input type="text" id="search-med" placeholder="Rechercher medicament..." oninput="pharmacieModule.filterStock()">
                    </div>
                </div>
                <div class="toolbar-right">
                    ${Auth.can('pharmacie', 3) ? '<button class="btn btn-primary" onclick="pharmacieModule.showMedForm()">+ Nouveau Medicament</button>' : ''}
                    ${Auth.can('pharmacie', 3) ? '<button class="btn btn-outline" onclick="pharmacieModule.showEntreeStock()">+ Entree stock</button>' : ''}
                </div>
            </div>
            <div class="card" id="med-table-card">
                ${this.renderMedsTable(meds)}
            </div>
        `;
        container.innerHTML = html;
    },

    filterStock() {
        const q = (document.getElementById('search-med').value || '').toLowerCase().trim();
        const meds = (this._allMeds || []).filter(m => {
            if (!q) return true;
            return [m.nom, m.dosage, m.categorie, m.forme, m.fournisseur]
                .filter(Boolean)
                .some(v => String(v).toLowerCase().includes(q));
        });
        const card = document.getElementById('med-table-card');
        if (card) card.innerHTML = this.renderMedsTable(meds);
    },

    renderMedsTable(meds) {
        return UI.renderTable([
            { field: 'nom', label: 'Nom', render: (v) => `<strong>${v}</strong>` },
            { field: 'forme', label: 'Forme', render: (v) => v },
            { field: 'dosage', label: 'Dosage', render: (v) => v },
            { field: 'categorie', label: 'Categorie', render: (v) => UI.renderBadge(v, 'info') },
            { field: 'stockActuel', label: 'Stock', render: (v, row) => {
                const color = v <= row.stockMin ? 'red' : v <= row.stockMin * 2 ? 'orange' : 'green';
                const colorHex = color === 'red' ? 'var(--danger)' : color === 'orange' ? 'var(--warning)' : 'var(--success)';
                return `<strong style="color:${colorHex}">${v}</strong> / min: ${row.stockMin}`;
            }},
            { field: 'prixVente', label: 'Prix Vente', render: (v) => UI.formatMoney(v) },
            { field: 'datePeremption', label: 'Peremption', render: (v) => UI.formatDate(v) },
            { label: 'Actions', render: (v, row) => `
                ${Auth.can('pharmacie', 3) ? `<button class="btn btn-sm btn-outline" onclick="pharmacieModule.showMedForm('${row.id}')">Editer</button>` : ''}
                ${Auth.can('pharmacie', 3) ? `<button class="btn btn-sm btn-primary" onclick="pharmacieModule.showEntreeStock('${row.id}')">Entree</button>` : ''}
            ` }
        ], meds, { actions: false, emptyTitle: 'Stock vide', emptyText: 'Aucun medicament en stock.' });
    },

    async renderOrdonnances(container) {
        const ordos = await DB.getAll('ordonnances');
        const patients = await DB.getAll('patients');
        const consultations = await DB.getAll('consultations');
        const medecins = await Meta.getMedecins();

        ordos.sort((a, b) => new Date(b.date) - new Date(a.date));
        const enriched = ordos.map(o => {
            const med = medecins.find(m => m.id === o.medecinId);
            return { ...o, medecinNom: med ? med.label : o.medecinId };
        });

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getOrdoLigneTotal = (o) => (o.lignes || []).reduce((s, l) => s + (Number(l.montantTotal) || 0), 0);

        let html = `
            <div class="toolbar">
                <div class="toolbar-left"><h3 style="font-size:14px;color:var(--text-secondary)">${ordos.length} ordonnance(s)</h3></div>
                <div class="toolbar-right">
                    ${Auth.can('pharmacie', 3) ? '<button class="btn btn-primary" onclick="pharmacieModule.showOrdonnanceForm()">+ Nouvelle Ordonnance</button>' : ''}
                </div>
            </div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'medecinNom', label: 'Medecin', render: (v) => v },
                    { field: 'date', label: 'Date', render: (v) => UI.formatDate(v) },
                    { label: 'Nb lignes', render: (v, row) => (row.lignes || []).length },
                    { label: 'Montant', render: (v, row) => UI.formatMoney(getOrdoLigneTotal(row)) },
                    { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v === 'Dispensee' ? 'Dispensee' : v === 'Partielle' ? 'Partielle' : v, v === 'Dispensee' ? 'success' : v === 'Partielle' ? 'warning' : 'gray') },
                    { label: 'Actions', render: (v, row) => {
                        let btns = `<button class="btn btn-sm btn-outline" onclick="pharmacieModule.viewOrdonnance('${row.id}')">Voir</button>`;
                        btns += `<button class="btn btn-sm btn-outline" onclick="pharmacieModule.printOrdonnance('${row.id}')">&#128424; Ordo.</button>`;
                        if (row.statut !== 'Prescrite') {
                            btns += `<button class="btn btn-sm btn-outline" onclick="pharmacieModule.printBonDispensation('${row.id}')">&#128424; Bon</button>`;
                        }
                        if (row.statut === 'Prescrite' && Auth.can('pharmacie', 3)) {
                            btns += `<button class="btn btn-sm btn-primary" onclick="pharmacieModule.showDispensation('${row.id}')">Dispenser</button>`;
                        }
                        return btns;
                    }}
                ], enriched, { actions: false, emptyTitle: 'Aucune ordonnance', emptyText: 'Aucune ordonnance enregistree.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async renderAlertes(container) {
        const meds = await DB.getAll('medicaments');
        const bas = meds.filter(m => m.stockActuel <= m.stockMin);
        const soon = meds.filter(m => {
            if (!m.datePeremption) return false;
            const exp = new Date(m.datePeremption);
            const in90 = new Date();
            in90.setDate(in90.getDate() + 90);
            return exp <= in90 && exp > new Date();
        });
        const perimes = meds.filter(m => new Date(m.datePeremption) < new Date());

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9878;', bas.length, 'Stock bas', 'red')}
                ${UI.renderStatCard('&#9889;', soon.length, 'Peremption < 90j', 'orange')}
                ${UI.renderStatCard('&#9888;', perimes.length, 'Perimes', 'purple')}
            </div>
            <div class="card">
                <div class="card-header"><h3>Medicaments en stock bas</h3></div>
                ${bas.length === 0 ? '<p style="padding:16px;color:var(--text-secondary)">Aucune alerte stock.</p>' :
                bas.map(m => `<div style="padding:8px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
                    <span><strong>${m.nom}</strong> ${m.dosage}</span>
                    <div>
                        <span class="badge badge-danger">Stock: ${m.stockActuel} (min: ${m.stockMin})</span>
                        ${Auth.can('pharmacie', 3) ? `<button class="btn btn-sm btn-primary" onclick="pharmacieModule.showEntreeStock('${m.id}')">Reapprovisionner</button>` : ''}
                    </div>
                </div>`).join('')}
            </div>
            <div class="grid-2" style="margin-top:16px">
                <div class="card">
                    <div class="card-header"><h3>Peremption proche (90 jours)</h3></div>
                    ${soon.length === 0 ? '<p style="padding:16px;color:var(--text-secondary)">Aucun medicament bientot perime.</p>' :
                    soon.map(m => `<div style="padding:8px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between">
                        <span><strong>${m.nom}</strong> ${m.dosage}</span>
                        <span class="badge badge-warning">Exp: ${UI.formatDate(m.datePeremption)}</span>
                    </div>`).join('')}
                </div>
                <div class="card">
                    <div class="card-header"><h3>Perimes</h3></div>
                    ${perimes.length === 0 ? '<p style="padding:16px;color:var(--text-secondary)">Aucun medicament perime.</p>' :
                    perimes.map(m => `<div style="padding:8px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
                        <span><strong>${m.nom}</strong> ${m.dosage}</span>
                        <span class="badge badge-purple">Exp: ${UI.formatDate(m.datePeremption)}</span>
                    </div>`).join('')}
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    async showMedForm(id = null) {
        let med = {};
        if (id) med = await DB.get('medicaments', id);

        const formHtml = UI.buildForm([
            { name: 'nom', label: 'Nom', required: true },
            { name: 'forme', label: 'Forme', type: 'select', required: true, options: [
                { value: 'Comprime', label: 'Comprime' }, { value: 'Gelule', label: 'Gelule' },
                { value: 'Sirop', label: 'Sirop' }, { value: 'Injection', label: 'Injection' },
                { value: 'Spray', label: 'Spray' }, { value: 'Gel', label: 'Gel' }, { value: 'Poudre', label: 'Poudre' }
            ]},
            { name: 'dosage', label: 'Dosage', required: true },
            { name: 'categorie', label: 'Categorie', required: true },
            { name: 'stockMin', label: 'Stock minimum', type: 'number', required: true, default: '20' },
            { name: 'stockActuel', label: 'Stock actuel', type: 'number', required: true, default: '0' },
            { name: 'prixAchat', label: 'Prix d\'achat', type: 'number', required: true },
            { name: 'prixVente', label: 'Prix de vente', type: 'number', required: true },
            { name: 'datePeremption', label: 'Date peremption', type: 'date', required: true },
            { name: 'fournisseur', label: 'Fournisseur' }
        ], med);

        UI.showModal(id ? 'Modifier Medicament' : 'Nouveau Medicament', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="pharmacieModule.saveMed('${id || ''}')">Enregistrer</button>
        `);
    },

    async printOrdonnance(id) {
        const ordo = await DB.get('ordonnances', id);
        if (!ordo) return;
        const [patients, medecins] = await Promise.all([DB.getAll('patients'), Meta.getMedecins()]);
        const pat = patients.find(p => p.id === ordo.patientId);
        const med = medecins.find(m => m.id === ordo.medecinId);

        const lignes = (ordo.lignes || []).map((l, i) => `<tr>
            <td>${i + 1}</td><td>${l.nomMedicament || l.medicamentId}</td><td>${l.posologie || '-'}</td><td>${l.quantite}</td>
        </tr>`).join('');

        const body = `
            <div class="print-title">ORDONNANCE MEDICALE</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : ordo.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Medecin</th><td>${med ? med.label : (ordo.medecinId || '-')}</td><th>Date</th><td>${UI.formatDateTime(ordo.date)}</td></tr>
                </tbody>
            </table>
            <table>
                <thead><tr><th>#</th><th>Medicament</th><th>Posologie</th><th>Quantite</th></tr></thead>
                <tbody>${lignes || '<tr><td colspan="4">Aucune ligne</td></tr>'}</tbody>
            </table>
            ${ordo.observations ? `<p style="margin-top:8px"><strong>Observations:</strong> ${ordo.observations}</p>` : ''}
            <div class="print-sign">
                <div><span class="line">Signature du medecin</span></div>
                <div><span class="line">Le pharmacien</span></div>
            </div>
        `;
        await Print.open('Ordonnance - ' + (pat ? pat.nom : ''), body);
    },

    async printBonDispensation(ordoId) {
        const ordo = await DB.get('ordonnances', ordoId);
        if (!ordo) return;
        const dispensations = await DB.getAll('dispensations');
        const disp = dispensations.filter(d => d.ordonnanceId === ordoId).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const [patients, medecins, users] = await Promise.all([DB.getAll('patients'), Meta.getMedecins(), DB.getAll('users')]);
        const pat = patients.find(p => p.id === ordo.patientId);
        const med = medecins.find(m => m.id === ordo.medecinId);
        const pharmacien = users.find(u => u.id === disp && disp.pharmacienId);

        const lignes = (disp ? disp.lignes : []).map((l, i) => `<tr>
            <td>${i + 1}</td><td>${l.nomMedicament || '-'}</td><td>${l.posologie || '-'}</td><td>${l.quantiteDispensee || l.quantite}</td>
            <td style="text-align:right">${UI.formatMoney(Number(l.montantDispense) || 0)}</td>
        </tr>`).join('');

        const body = `
            <div class="print-title">BON DE DISPENSATION</div>
            <table>
                <tbody>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : ordo.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Medecin</th><td>${med ? med.label : (ordo.medecinId || '-')}</td><th>Date</th><td>${disp ? UI.formatDateTime(disp.date) : UI.formatDateTime(ordo.date)}</td></tr>
                <tr><th>Pharmacien</th><td colspan="3">${(disp && pharmacien) ? (pharmacien.nomComplet || pharmacien.nomUtilisateur) : (disp && disp.pharmacienId) ? disp.pharmacienId : '-'}</td></tr>
                </tbody>
            </table>
            <table>
                <thead><tr><th>#</th><th>Medicament</th><th>Posologie</th><th>Qte</th><th style="text-align:right">Montant</th></tr></thead>
                <tbody>${lignes || '<tr><td colspan="5">Aucune ligne dispensee</td></tr>'}</tbody>
                <tfoot><tr><th colspan="4" style="text-align:right">Total dispense</th><th class="print-total" style="text-align:right">${UI.formatMoney(disp ? disp.montantTotal : 0)}</th></tr></tfoot>
            </table>
            <div class="print-sign">
                <div><span class="line">Le pharmacien</span></div>
                <div><span class="line">Le patient</span></div>
            </div>
        `;
        await Print.open('Bon de dispensation - ' + (pat ? pat.nom : ''), body);
    },

    async saveMed(id) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.nom || !data.dosage) { UI.toast('Champs obligatoires manquants', 'error'); return; }

        if (id) {
            const existing = await DB.get('medicaments', id);
            Object.assign(existing, data);
            await DB.put('medicaments', existing);
            UI.toast('Medicament modifie', 'success');
        } else {
            data.id = DB.generateId();
            await DB.put('medicaments', data);
            UI.toast('Medicament ajoute', 'success');
        }
        UI.hideModal();
        this.renderTab();
    },

    async showEntreeStock(medId = '') {
        const meds = await DB.getAll('medicaments');
        const formHtml = UI.buildForm([
            { name: 'medicamentId', label: 'Medicament', type: 'select', required: true, options: meds.map(m => ({ value: m.id, label: `${m.nom} ${m.dosage} (stock: ${m.stockActuel})` })) },
            { name: 'quantite', label: 'Quantite entree', type: 'number', required: true, default: '0' },
            { name: 'motif', label: 'Motif', type: 'select', options: [
                { value: 'Livraison', label: 'Livraison fournisseur' }, { value: 'Retour', label: 'Retour' }, { value: 'Ajustement', label: 'Ajustement' }
            ]}
        ], { medicamentId: medId });

        UI.showModal('Entree de Stock', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="pharmacieModule.saveEntreeStock()">Enregistrer</button>
        `);
    },

    async saveEntreeStock() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        const qty = Number(data.quantite);
        if (!data.medicamentId || !qty || qty <= 0) { UI.toast('Quantite invalide', 'error'); return; }

        const med = await DB.get('medicaments', data.medicamentId);
        med.stockActuel = (med.stockActuel || 0) + qty;
        await DB.put('medicaments', med);

        await DB.put('stockPharmacie', {
            id: DB.generateId(),
            medicamentId: data.medicamentId,
            quantiteEntree: qty,
            quantiteSortie: 0,
            date: new Date().toISOString(),
            type: 'Entree',
            motif: data.motif || 'Entree',
            par: Auth.currentUser.id
        });

        UI.toast(`Entree de ${qty} unites effectuee`, 'success');
        await Auth.log('Entree stock', 'pharmacie', med.nom);
        UI.hideModal();
        this.renderTab();
    },

    async showOrdonnanceForm() {
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();
        const meds = await DB.getAll('medicaments');

        const medOptions = meds.map(m => `<option value="${m.id}">${m.nom} ${m.dosage} (${m.prixVente.toLocaleString('fr-FR')} FCFA)</option>`).join('');

        const html = `
            ${UI.buildForm([
                { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
                { name: 'medecinId', label: 'Medecin', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
                { name: 'observations', label: 'Observations', type: 'textarea', half: false }
            ])}
            <div class="order-lignes">
                <h4 style="margin-bottom:8px">Lignes de prescription</h4>
                <div id="ordo-lignes"></div>
                <button type="button" class="btn btn-outline btn-sm" onclick="pharmacieModule.addLigne()">+ Ajouter une ligne</button>
            </div>
        `;

        UI.showModal('Nouvelle Ordonnance', html, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="pharmacieModule.saveOrdonnance()">Enregistrer</button>
        `);

        this._medOptions = medOptions;
        this.addLigne();
    },

    addLigne() {
        const container = document.getElementById('ordo-lignes');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'ordo-ligne';
        div.innerHTML = `
            <select class="ligne-med">
                <option value="">-- Medicament --</option>
                ${this._medOptions}
            </select>
            <input type="text" class="ligne-posologie" placeholder="Posologie">
            <input type="number" class="ligne-quantite" placeholder="Qte" min="1" value="1">
            <button type="button" class="btn-remove-line" onclick="this.parentElement.remove()">&times;</button>
        `;
        container.appendChild(div);
    },

    async saveOrdonnance() {
        const form = document.querySelector('.modal-body');

        const patientId = form.querySelector('[name="patientId"]').value;
        const medecinId = form.querySelector('[name="medecinId"]').value;
        const observations = form.querySelector('[name="observations"]').value;

        if (!patientId || !medecinId) { UI.toast('Patient et medecin requis', 'error'); return; }

        const lignes = [];
        form.querySelectorAll('.ordo-ligne').forEach(ligneEl => {
            const medId = ligneEl.querySelector('.ligne-med').value;
            const posologie = ligneEl.querySelector('.ligne-posologie').value;
            const quantite = Number(ligneEl.querySelector('.ligne-quantite').value) || 0;
            if (medId && quantite > 0) {
                lignes.push({ medicamentId: medId, posologie, quantite });
            }
        });

        if (lignes.length === 0) { UI.toast('Ajoutez au moins une ligne', 'error'); return; }

        const meds = await DB.getAll('medicaments');

        const ordo = {
            id: DB.generateId(),
            patientId,
            medecinId,
            date: new Date().toISOString(),
            observations,
            statut: 'Prescrite',
            lignes: lignes.map(l => {
                const med = meds.find(m => m.id === l.medicamentId);
                return {
                    ...l,
                    nomMedicament: med ? med.nom : l.medicamentId,
                    prixUnitaire: med ? med.prixVente : 0,
                    montantTotal: (med ? med.prixVente : 0) * l.quantite
                };
            })
        };

        await DB.put('ordonnances', ordo);
        UI.toast('Ordonnance enregistree', 'success');
        await Auth.log('Creation', 'pharmacie', `Ordonnance ${ordo.id}`);
        UI.hideModal();
        this.renderTab();
    },

    async viewOrdonnance(id) {
        const ordo = await DB.get('ordonnances', id);
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();

        const pat = patients.find(p => p.id === ordo.patientId);
        const med = medecins.find(m => m.id === ordo.medecinId);

        const total = ordo.lignes.reduce((s, l) => s + l.montantTotal, 0);

        let lignesHtml = ordo.lignes.map(l => `<tr>
            <td>${l.nomMedicament}</td>
            <td>${l.posologie || '-'}</td>
            <td>${l.quantite}</td>
            <td>${UI.formatMoney(l.prixUnitaire)}</td>
            <td>${UI.formatMoney(l.montantTotal)}</td>
        </tr>`).join('');

        UI.showModal(`Ordonnance`, `
            <div class="grid-2" style="margin-bottom:16px">
                <div>
                    <p><strong>Patient:</strong> ${pat ? `${pat.prenom} ${pat.nom}` : ordo.patientId}</p>
                    <p><strong>Date:</strong> ${UI.formatDateTime(ordo.date)}</p>
                </div>
                <div>
                    <p><strong>Medecin:</strong> ${med ? med.label : ordo.medecinId}</p>
                    <p><strong>Statut:</strong> ${UI.renderBadge(ordo.statut, ordo.statut === 'Dispensee' ? 'success' : ordo.statut === 'Partielle' ? 'warning' : 'gray')}</p>
                </div>
            </div>
            <div class="table-container"><table>
                <thead><tr><th>Medicament</th><th>Posologie</th><th>Qte</th><th>Prix unit.</th><th>Total</th></tr></thead>
                <tbody>${lignesHtml}</tbody>
            </table></div>
            <p style="text-align:right;margin-top:16px"><strong>Total: ${UI.formatMoney(total)}</strong></p>
            ${ordo.observations ? `<p style="margin-top:8px"><strong>Observations:</strong> ${ordo.observations}</p>` : ''}
        `, `<button class="btn btn-outline" onclick="UI.hideModal()">Fermer</button>`);
    },

    async showDispensation(id) {
        const ordo = await DB.get('ordonnances', id);
        const meds = await DB.getAll('medicaments');

        const html = ordo.lignes.map((l, idx) => {
            const med = meds.find(m => m.id === l.medicamentId);
            const stock = med ? med.stockActuel : 0;
            const maxStock = Math.min(l.quantite, stock);
            return `
                <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border-light)">
                    <div style="flex:1"><strong>${l.nomMedicament}</strong> (stock: ${stock})</div>
                    <span>Qte prescrite: ${l.quantite}</span>
                    <label style="display:flex;align-items:center;gap:4px">
                        <input type="checkbox" class="disp-check" data-med="${l.medicamentId}" data-max="${maxStock}" checked>
                        Dispenser
                    </label>
                    <input type="number" class="disp-qte" data-med="${l.medicamentId}" value="${maxStock}" min="0" max="${maxStock}" style="width:70px">
                </div>
            `;
        }).join('');

        UI.showModal(`Dispensation - Ordonnance`, `
            <p style="margin-bottom:12px;color:var(--text-secondary)">Cochez les produits a dispenser et ajustez les quantites (limite par le stock).</p>
            ${html}
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="pharmacieModule.saveDispensation('${id}')">Confirmer la dispensation</button>
        `);
    },

    async saveDispensation(ordoId) {
        const ordo = await DB.get('ordonnances', ordoId);
        const form = document.querySelector('.modal-body');
        const meds = await DB.getAll('medicaments');

        const dispenses = [];
        form.querySelectorAll('.disp-check').forEach((check, idx) => {
            if (check.checked) {
                const medId = check.dataset.med;
                const qteInput = form.querySelectorAll('.disp-qte')[idx];
                const qte = Number(qteInput.value) || 0;
                const ligne = ordo.lignes.find(l => l.medicamentId === medId);
                if (qte > 0 && ligne) {
                    dispenses.push({ ...ligne, quantiteDispensee: qte, montantDispense: ligne.prixUnitaire * qte });
                }
            }
        });

        if (dispenses.length === 0) { UI.toast('Aucun produit dispense', 'warning'); return; }

        // Deduit le stock
        for (const d of dispenses) {
            const med = await DB.get('medicaments', d.medicamentId);
            if (med) {
                med.stockActuel = Math.max(0, (med.stockActuel || 0) - d.quantiteDispensee);
                await DB.put('medicaments', med);
                await DB.put('stockPharmacie', {
                    id: DB.generateId(),
                    medicamentId: med.id,
                    quantiteEntree: 0,
                    quantiteSortie: d.quantiteDispensee,
                    date: new Date().toISOString(),
                    type: 'Sortie',
                    motif: 'Dispensation ordonnance ' + ordoId,
                    par: Auth.currentUser.id
                });
            }
        }

        // Determine statut de l'ordonnance
        const totalPrescrit = ordo.lignes.reduce((s, l) => s + l.quantite, 0);
        const totalDispense = dispenses.reduce((s, d) => s + d.quantiteDispensee, 0);
        ordo.statut = totalDispense >= totalPrescrit ? 'Dispensee' : 'Partielle';
        await DB.put('ordonnances', ordo);

        await DB.put('dispensations', {
            id: DB.generateId(),
            ordonnanceId: ordoId,
            patientId: ordo.patientId,
            pharmacienId: Auth.currentUser.id,
            date: new Date().toISOString(),
            lignes: dispenses,
            montantTotal: dispenses.reduce((s, d) => s + d.montantDispense, 0),
            payee: false
        });

        const montantDispense = dispenses.reduce((s, d) => s + d.montantDispense, 0);
        if (montantDispense > 0) {
            await Billing.addLigne(ordo.patientId, {
                description: 'Dispensation pharmacie (' + dispenses.length + ' produit(s))',
                montant: montantDispense,
                source: 'dispensations',
                sourceId: ordoId
            });
        }

        UI.toast('Dispensation effectuee', 'success');
        await Auth.log('Dispensation', 'pharmacie', `Ordonnance ${ordoId}`);
        UI.hideModal();
        this.renderTab();
    },

    cleanup() {}
};

window.pharmacieModule = pharmacieModule;
