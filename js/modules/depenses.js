const depensesModule = {
    _editId: null,

    CATEGORIES: ['Construction', 'Entretien', 'Electricite', 'Eau', 'Telecom', 'Achats Materiels', 'Achats Fournitures', 'Transports', 'Entretien Batiments', 'Sante', 'Divers'],
    MODES: ['Especes', 'Virement', 'Cheque', 'Mobile Money', 'Ordre de virement'],

    async show() {
        UI.setPageTitle('Depenses');
        const container = document.getElementById('content-area');
        container.innerHTML = `<div id="depenses-content"></div>`;
        await this.render();
    },

    async render() {
        const c = document.getElementById('depenses-content');
        const [depenses, services] = await Promise.all([DB.getAll('depenses'), DB.getAll('services')]);
        const getSvc = (id) => { const s = services.find(x => x.id === id); return id && s ? s.nom : null; };

        const fCat = c._filtreCat || '';
        const fMode = c._filtreMode || '';
        const du = c._filtreDu || '';
        const au = c._filtreAu || '';
        const fRecherche = (c._recherche || '').toLowerCase();

        const list = depenses.filter(d => {
            if (fCat && d.categorie !== fCat) return false;
            if (fMode && d.modePaiement !== fMode) return false;
            if (du && d.date < du) return false;
            if (au && d.date > au) return false;
            if (fRecherche && !((d.libelle || '').toLowerCase().includes(fRecherche) || (d.beneficiaire || '').toLowerCase().includes(fRecherche))) return false;
            return true;
        }).sort((a, b) => String(b.date).localeCompare(String(a.date)));

        const total = list.reduce((s, d) => s + Number(d.montant || 0), 0);
        const moisCourant = new Date().toISOString().slice(0, 7);
        const totalMois = depenses.filter(d => String(d.date).startsWith(moisCourant)).reduce((s, d) => s + Number(d.montant || 0), 0);
        const parCat = {};
        depenses.forEach(d => { parCat[d.categorie] = (parCat[d.categorie] || 0) + Number(d.montant || 0); });
        const topCat = Object.entries(parCat).sort((a, b) => b[1] - a[1])[0];

        c.innerHTML = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9830;', UI.formatMoney(total), 'Total depenses (' + list.length + ')', 'purple')}
                ${UI.renderStatCard('&#9783;', UI.formatMoney(totalMois), 'Depenses du mois courant', 'blue')}
                ${UI.renderStatCard('&#8658;', topCat ? topCat[0] + ' : ' + UI.formatMoney(topCat[1]) : '-', 'Top categorie', 'orange')}
            </div>

            <div class="toolbar" style="margin-bottom:16px">
                <div class="toolbar-left" style="display:flex;gap:10px;flex-wrap:wrap;flex:1">
                    <select id="depenses-filtre-cat" onchange="depensesModule.setFiltreCat(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                        <option value="">Toutes categories</option>
                        ${this.CATEGORIES.map(k => `<option value="${k}" ${fCat === k ? 'selected' : ''}>${k}</option>`).join('')}
                    </select>
                    <select id="depenses-filtre-mode" onchange="depensesModule.setFiltreMode(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                        <option value="">Tous modes de paiement</option>
                        ${this.MODES.map(k => `<option value="${k}" ${fMode === k ? 'selected' : ''}>${k}</option>`).join('')}
                    </select>
                    <label style="align-self:center">Du <input type="date" id="depenses-filtre-du" value="${du}" onchange="depensesModule.setFiltreDu(this.value)" style="padding:5px;border:1px solid var(--border);border-radius:6px"></label>
                    <label style="align-self:center">Au <input type="date" id="depenses-filtre-au" value="${au}" onchange="depensesModule.setFiltreAu(this.value)" style="padding:5px;border:1px solid var(--border);border-radius:6px"></label>
                    <input type="text" id="depenses-recherche" placeholder="Recherche (libelle, beneficiaire)" value="${c._recherche || ''}" oninput="depensesModule.setRecherche(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px;flex:1;min-width:160px">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="depensesModule.printJournal()">Journal des depenses</button>
                    <button class="btn btn-outline" onclick="depensesModule.printResume()">Resume par categorie</button>
                    ${Auth.can('depenses', 3) ? `<button class="btn btn-primary" onclick="depensesModule.showForm()">+ Nouvelle Depense</button>` : ''}
                </div>
            </div>

            <div class="card" style="margin-bottom:16px">
                <div class="card-header"><h3>Repartition par categorie</h3></div>
                ${Object.keys(parCat).length === 0 ? '<div class="empty-state"><p>Aucune depense enregistree</p></div>' : `
                <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
                    <div style="flex:1;min-width:220px"><canvas id="chart-depenses" height="200"></canvas></div>
                    <div style="flex:1;min-width:240px">
                        ${Object.entries(parCat).sort((a, b) => b[1] - a[1]).map(([cat, tot]) => `
                            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #e0e0e0">
                                <span>${cat}</span><strong>${UI.formatMoney(tot)}</strong>
                            </div>`).join('')}
                        <div style="display:flex;justify-content:space-between;padding:8px 0"><strong>TOTAL</strong><strong>${UI.formatMoney(depenses.reduce((s, d) => s + Number(d.montant || 0), 0))}</strong></div>
                    </div>
                </div>`}
            </div>

            <div class="card">
                <div class="card-header"><h3>Depenses (${list.length})</h3></div>
                ${list.length === 0 ? '<div class="empty-state"><p>Aucune depense sur la periode</p></div>' : `
                <table class="permissions-tbl" style="width:100%">
                    <thead><tr><th>Date</th><th>Categorie</th><th>Libelle</th><th>Beneficiaire</th><th style="text-align:right">Montant</th><th>Paiement</th>${Auth.can('depenses', 3) ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody>
                        ${list.map(d => `
                            <tr>
                                <td>${UI.formatDate(d.date)}</td>
                                <td>${UI.renderBadge(d.categorie, d.categorie === 'Construction' ? 'warning' : d.categorie === 'Achats Materiels' ? 'purple' : d.categorie === 'Electricite' ? 'blue' : 'gray')}</td>
                                <td><strong>${d.libelle || '-'}</strong>${d.facture ? `<br><small style="color:var(--text-secondary)">Ref: ${d.facture}</small>` : ''}${getSvc(d.serviceId) ? `<br><small style="color:var(--text-secondary)">${getSvc(d.serviceId)}</small>` : ''}</td>
                                <td>${d.beneficiaire || '-'}</td>
                                <td style="text-align:right"><strong>${UI.formatMoney(d.montant)}</strong></td>
                                <td>${d.modePaiement || '-'}</td>
                                ${Auth.can('depenses', 3) ? `
                                <td>
                                    <button class="btn btn-sm btn-outline" onclick="depensesModule.showForm('${d.id}')">Modifier</button>
                                    <button class="btn btn-sm btn-danger" onclick="depensesModule.delete('${d.id}')">Suppr.</button>
                                </td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot><tr><th colspan="4" style="text-align:right">Total filtre</th><th class="print-total" style="text-align:right">${UI.formatMoney(total)}</th><td colspan="2"></td></tr></tfoot>
                </table>`}
            </div>
        `;

        requestAnimationFrame(() => {
            if (Object.keys(parCat).length > 0) {
                const labels = Object.keys(parCat);
                const values = labels.map(l => parCat[l]);
                Charts.createDoughnutChart('chart-depenses', labels, values);
            }
        });
    },

    setFiltreCat(val) { this._filtreCat = val; const c = document.getElementById('depenses-content'); if (c) c._filtreCat = val; this.render(); },
    setFiltreMode(val) { this._filtreMode = val; const c = document.getElementById('depenses-content'); if (c) c._filtreMode = val; this.render(); },
    setFiltreDu(val) { this._filtreDu = val; const c = document.getElementById('depenses-content'); if (c) c._filtreDu = val; this.render(); },
    setFiltreAu(val) { this._filtreAu = val; const c = document.getElementById('depenses-content'); if (c) c._filtreAu = val; this.render(); },
    setRecherche(val) { this._recherche = val; const c = document.getElementById('depenses-content'); if (c) c._recherche = val; this.render(); },

    _filtres() {
        const c = document.getElementById('depenses-content');
        return { fCat: (c && c._filtreCat) || this._filtreCat || '', fMode: (c && c._filtreMode) || this._filtreMode || '', du: (c && c._filtreDu) || this._filtreDu || '', au: (c && c._filtreAu) || this._filtreAu || '', fRecherche: ((c && c._recherche) || this._recherche || '').toLowerCase() };
    },
    _filtrer(depenses, services) {
        const { fCat, fMode, du, au, fRecherche } = this._filtres();
        const getSvc = (id) => { const s = services.find(x => x.id === id); return id && s ? s.nom : null; };
        const list = depenses.filter(d => {
            if (fCat && d.categorie !== fCat) return false;
            if (fMode && d.modePaiement !== fMode) return false;
            if (du && d.date < du) return false;
            if (au && d.date > au) return false;
            if (fRecherche && !((d.libelle || '').toLowerCase().includes(fRecherche) || (d.beneficiaire || '').toLowerCase().includes(fRecherche))) return false;
            return true;
        }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return { list, getSvc };
    },

    async showForm(depenseId) {
        this._editId = depenseId || null;
        const services = (await Meta.getServices()).filter(s => s.actif);
        const d = this._editId ? await DB.get('depenses', this._editId) : null;

        const formHtml = UI.buildForm([
            { name: 'categorie', label: 'Categorie', type: 'select', required: true, options: this.CATEGORIES.map(k => ({ value: k, label: k })), default: d ? d.categorie : 'Achats Fournitures' },
            { name: 'sousCategorie', label: 'Sous-categorie (facultatif)', default: d ? d.sousCategorie : '', placeholder: 'Ex: Carburant, Equipement medical' },
            { name: 'libelle', label: 'Libelle de la depense', required: true, default: d ? d.libelle : '', placeholder: 'Ex: Facture electrique - Batiment A' },
            { name: 'montant', label: 'Montant', type: 'number', required: true, default: d ? String(d.montant) : '' },
            { name: 'date', label: 'Date', type: 'date', required: true, default: d ? d.date : new Date().toISOString().slice(0, 10) },
            { name: 'modePaiement', label: 'Mode de paiement', type: 'select', required: true, options: this.MODES.map(k => ({ value: k, label: k })), default: d ? d.modePaiement : 'Especes' },
            { name: 'beneficiaire', label: 'Beneficiaire / fournisseur', default: d ? d.beneficiaire : '', placeholder: 'Ex: SNEL, Entreprise BTP' },
            { name: 'serviceId', label: 'Service concerne (facultatif)', type: 'select', options: [{ value: '', label: 'Aucun service' }].concat(services.map(s => ({ value: s.id, label: s.nom }))), default: d && d.serviceId ? d.serviceId : '' },
            { name: 'facture', label: 'Reference facture / bon (facultatif)', default: d ? d.facture : '', placeholder: 'Ex: SNEL-2026-0412' },
            { name: 'notes', label: 'Notes', type: 'textarea', default: d ? d.notes : '' }
        ]);
        UI.showModal(this._editId ? 'Modifier la depense' : 'Nouvelle Depense', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="depensesModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const data = UI.getFormData(document.querySelector('.modal-body'));
        if (!data.categorie || !data.libelle || !data.date || !Number(data.montant) || Number(data.montant) <= 0) {
            UI.toast('Categorie, libelle, date et montant (positif) requis', 'error'); return;
        }
        const d = this._editId ? await DB.get('depenses', this._editId) : { id: DB.generateId(), dateEnregistrement: new Date().toISOString(), enregistrePar: Auth.currentUser ? Auth.currentUser.id : 'u1' };
        Object.assign(d, {
            categorie: data.categorie,
            sousCategorie: data.sousCategorie || '',
            libelle: data.libelle,
            montant: Number(data.montant),
            date: data.date,
            modePaiement: data.modePaiement,
            beneficiaire: data.beneficiaire || '',
            serviceId: data.serviceId || null,
            facture: data.facture || '',
            notes: data.notes || ''
        });
        await DB.put('depenses', d);
        UI.toast('Depense enregistree', 'success');
        await Auth.log(this._editId ? 'Modification' : 'Creation', 'depenses', `${d.categorie} - ${d.libelle} (${d.montant})`);
        this._editId = null;
        UI.hideModal();
        this.render();
    },

    async delete(depenseId) {
        const ok = await UI.confirm('Supprimer cette depense ?');
        if (!ok) return;
        const d = await DB.get('depenses', depenseId);
        await DB.delete('depenses', depenseId);
        UI.toast('Depense supprimee', 'success');
        await Auth.log('Suppression', 'depenses', d ? (d.categorie + ' - ' + d.libelle) : depenseId);
        this.render();
    },

    async printJournal() {
        const [depenses, services] = await Promise.all([DB.getAll('depenses'), DB.getAll('services')]);
        const { list, getSvc } = this._filtrer(depenses, services);
        const total = list.reduce((s, d) => s + Number(d.montant || 0), 0);

        const rows = list.map(d => `<tr>
            <td>${UI.formatDate(d.date)}</td>
            <td>${d.categorie}</td>
            <td>${d.libelle || '-'}${d.facture ? '<br><small>Ref: ' + d.facture + '</small>' : ''}</td>
            <td>${d.beneficiaire || '-'}</td>
            <td>${getSvc(d.serviceId) || '-'}</td>
            <td>${d.modePaiement || '-'}</td>
            <td style="text-align:right">${UI.formatMoney(d.montant)}</td>
        </tr>`).join('');

        const body = `
            <div class="print-title">JOURNAL DES DEPENSES</div>
            <table>
                <thead><tr><th>Date</th><th>Categorie</th><th>Libelle</th><th>Beneficiaire</th><th>Service</th><th>Paiement</th><th style="text-align:right">Montant</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="7">Aucune depense</td></tr>'}</tbody>
                <tfoot><tr><th colspan="6" style="text-align:right">Total</th><th class="print-total" style="text-align:right">${UI.formatMoney(total)}</th></tr></tfoot>
            </table>
            <div class="print-sign">
                <div><span class="line">Le Directeur</span></div>
                <div><span class="line">La comptabilite</span></div>
            </div>
        `;
        await Print.open('Journal des depenses', body);
    },

    async printResume() {
        const depenses = await DB.getAll('depenses');
        const parCat = {};
        depenses.forEach(d => { parCat[d.categorie] = (parCat[d.categorie] || 0) + Number(d.montant || 0); });
        const total = Object.values(parCat).reduce((s, v) => s + v, 0);

        const rows = Object.entries(parCat).sort((a, b) => b[1] - a[1]).map(([cat, tot]) => `<tr>
            <td>${cat}</td>
            <td style="text-align:right">${UI.formatMoney(tot)}</td>
            <td style="text-align:right">${total > 0 ? ((tot / total) * 100).toFixed(1) + ' %' : '0 %'}</td>
        </tr>`).join('');

        const body = `
            <div class="print-title">RESUME DES DEPENSES PAR CATEGORIE</div>
            <table>
                <thead><tr><th>Categorie</th><th style="text-align:right">Montant</th><th style="text-align:right">Part</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="3">Aucune depense</td></tr>'}</tbody>
                <tfoot><tr><th style="text-align:right">TOTAL</th><th class="print-total" style="text-align:right">${UI.formatMoney(total)}</th><td></td></tr></tfoot>
            </table>
            <div class="print-sign">
                <div><span class="line">Le Directeur</span></div>
                <div><span class="line">La comptabilite</span></div>
            </div>
        `;
        await Print.open('Resume des depenses', body);
    },

    cleanup() {}
};

window.depensesModule = depensesModule;