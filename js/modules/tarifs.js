const tarifsModule = {
    _editId: null,

    async show() {
        UI.setPageTitle('Tarifs');
        const container = document.getElementById('content-area');
        container.innerHTML = `
            <div id="tarifs-content"></div>
        `;
        await this.render();
    },

    async render(container) {
        const c = container || document.getElementById('tarifs-content');
        const tarifs = await DB.getAll('tarifs');
        const services = await DB.getAll('services');
        const getSvc = (id) => { const s = services.find(x => x.id === id); return id && s ? s.nom : 'Tous services'; };
        const catLabel = { Consultation: 'Consultation', Examen: 'Examen', Imagerie: 'Imagerie', Hospitalisation: 'Hospitalisation', Chirurgie: 'Chirurgie', Acte: 'Acte', Prestation: 'Prestation' };
        const catColor = { Consultation: 'info', Examen: 'purple', Imagerie: 'blue', Hospitalisation: 'warning', Chirurgie: 'danger', Acte: 'info', Prestation: 'gray' };

        const filtreCat = (c._filtreCat || '');
        const filtreSvc = (c._filtreSvc || '');
        const list = tarifs.filter(t =>
            (!filtreCat || t.categorie === filtreCat) &&
            (!filtreSvc || t.serviceId === filtreSvc)
        ).sort((a, b) => (catLabel[a.categorie] || '').localeCompare(catLabel[b.categorie] || ''));

        const totalActifs = tarifs.filter(t => t.actif !== false).length;

        c.innerHTML = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9746;', tarifs.length, 'Tarifs enregistres', 'purple')}
                ${UI.renderStatCard('&#10003;', totalActifs, 'Tarifs actifs', 'green')}
                ${UI.renderStatCard('&#9830;', UI.formatMoney(tarifs.reduce((s, t) => s + Number(t.montant || 0), 0)), 'Total catalogue', 'blue')}
            </div>

            ${Auth.can('tarifs', 3) ? `
            <div class="toolbar" style="margin-bottom:16px">
                <div class="toolbar-left" style="display:flex;gap:10px;flex-wrap:wrap">
                    <select id="tarifs-filtre-cat" onchange="tarifsModule.setFiltreCat(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                        <option value="">Toutes categories</option>
                        ${Object.entries(catLabel).map(([k, v]) => `<option value="${k}" ${filtreCat === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                    <select id="tarifs-filtre-svc" onchange="tarifsModule.setFiltreSvc(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                        <option value="">Tous services</option>
                        ${services.map(s => `<option value="${s.id}" ${filtreSvc === s.id ? 'selected' : ''}>${s.nom}</option>`).join('')}
                    </select>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="tarifsModule.printListe()">Imprimer la liste</button>
                    <button class="btn btn-outline" onclick="tarifsModule.genererDepuisDonnees()">Generer depuis donnees</button>
                    <button class="btn btn-primary" onclick="tarifsModule.showForm()">+ Nouveau Tarif</button>
                </div>
            </div>` : ''}

            <div class="card">
                <div class="card-header"><h3>Tarifs (${list.length})</h3></div>
                ${list.length === 0 ? '<div class="empty-state"><p>Aucun tarif</p><p>Cliquez sur "Generer depuis donnees" pour creer les tarifs a partir des couts existants.</p></div>' : `
                <table class="permissions-tbl" style="width:100%">
                    <thead>
                        <tr>
                            <th>Categorie</th><th>Libelle</th><th>Service</th><th style="text-align:right">Montant</th><th>Statut</th>${Auth.can('tarifs', 3) ? '<th>Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(t => `
                            <tr>
                                <td>${UI.renderBadge(catLabel[t.categorie] || t.categorie, catColor[t.categorie] || 'gray')}</td>
                                <td><strong>${t.libelle}</strong>${t.typeId ? `<br><small style="color:var(--text-secondary)">Ref: ${t.typeId}</small>` : ''}</td>
                                <td>${getSvc(t.serviceId)}</td>
                                <td style="text-align:right"><strong>${UI.formatMoney(t.montant)}</strong></td>
                                <td>${UI.renderBadge(t.actif === false ? 'Inactif' : 'Actif', t.actif === false ? 'gray' : 'success')}</td>
                                ${Auth.can('tarifs', 3) ? `
                                <td>
                                    <button class="btn btn-sm btn-outline" onclick="tarifsModule.showForm('${t.id}')">Modifier</button>
                                    <button class="btn btn-sm btn-danger" onclick="tarifsModule.delete('${t.id}')">Suppr.</button>
                                </td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`}
            </div>
        `;
    },

    setFiltreCat(val) { const c = document.getElementById('tarifs-content'); c._filtreCat = val; this.render(c); },
    setFiltreSvc(val) { const c = document.getElementById('tarifs-content'); c._filtreSvc = val; this.render(c); },

    async showForm(tarifId) {
        this._editId = tarifId || null;
        const services = (await Meta.getServices()).filter(s => s.actif);
        const t = this._editId ? await DB.get('tarifs', this._editId) : null;

        const formHtml = UI.buildForm([
            { name: 'categorie', label: 'Categorie', type: 'select', required: true, options: Billing.CATEGORIES.map(cat => ({ value: cat, label: cat })), default: t ? t.categorie : 'Prestation' },
            { name: 'libelle', label: 'Libelle', required: true, placeholder: 'Ex: Consultation specialiste', default: t ? t.libelle : '' },
            { name: 'montant', label: 'Montant', type: 'number', required: true, default: t ? String(t.montant) : '' },
            { name: 'serviceId', label: 'Service (facultatif)', type: 'select', options: [{ value: '', label: 'Tous services' }].concat(services.map(s => ({ value: s.id, label: s.nom }))), default: t && t.serviceId ? t.serviceId : '' },
            { name: 'typeId', label: 'Reference interne (facultatif)', default: t && t.typeId ? t.typeId : '', placeholder: 'ID medecin / type examen / lit...' },
            { name: 'actif', label: 'Statut', type: 'select', options: [{ value: 'true', label: 'Actif' }, { value: 'false', label: 'Inactif' }], default: t ? String(t.actif !== false) : 'true' }
        ]);

        UI.showModal(this._editId ? 'Modifier le tarif' : 'Nouveau Tarif', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="tarifsModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.categorie || !data.libelle || !Number(data.montant) || Number(data.montant) <= 0) {
            UI.toast('Categorie, libelle et montant (positif) requis', 'error'); return;
        }
        const tarif = this._editId ? await DB.get('tarifs', this._editId) : { id: DB.generateId() };
        Object.assign(tarif, {
            categorie: data.categorie,
            libelle: data.libelle,
            montant: Number(data.montant),
            serviceId: data.serviceId || null,
            typeId: data.typeId || null,
            actif: data.actif === 'true' || data.actif === '1'
        });
        await DB.put('tarifs', tarif);
        UI.toast('Tarif enregistre', 'success');
        await Auth.log(this._editId ? 'Modification' : 'Creation', 'tarifs', `${tarif.categorie} - ${tarif.libelle} (${tarif.montant})`);
        this._editId = null;
        UI.hideModal();
        this.render();
    },

    async delete(tarifId) {
        const ok = await UI.confirm('Supprimer ce tarif ?');
        if (!ok) return;
        const t = await DB.get('tarifs', tarifId);
        await DB.delete('tarifs', tarifId);
        UI.toast('Tarif supprime', 'success');
        await Auth.log('Suppression', 'tarifs', t ? t.libelle : tarifId);
        this.render();
    },

    async genererDepuisDonnees() {
        const existing = await DB.getAll('tarifs');
        const created = [];

        const medecins = await DB.getAll('medecins');
        medecins.forEach(m => {
            if (!existing.some(t => t.typeId === m.id && t.categorie === 'Consultation')) {
                created.push({ id: DB.generateId(), categorie: 'Consultation', libelle: 'Consultation', montant: Number(m.consultationCout) || 15000, serviceId: m.serviceId || null, typeId: m.id, actif: true });
            }
        });

        const types = await DB.getAll('typesExamen');
        types.forEach(te => {
            if (!existing.some(t => t.typeId === te.id && t.categorie === 'Examen')) {
                created.push({ id: DB.generateId(), categorie: 'Examen', libelle: te.nom || 'Examen', montant: Number(te.cout) || 0, serviceId: te.serviceId || null, typeId: te.id, actif: true });
            }
        });

        const lits = await DB.getAll('lits');
        const jourParSvc = {};
        lits.forEach(l => { if (Number(l.jourCout)) jourParSvc[l.serviceId] = jourParSvc[l.serviceId] || Number(l.jourCout); });
        Object.entries(jourParSvc).forEach(([svc, montant]) => {
            if (!existing.some(t => t.categorie === 'Hospitalisation' && t.serviceId === svc)) {
                created.push({ id: DB.generateId(), categorie: 'Hospitalisation', libelle: 'Journee d\'hospitalisation', montant, serviceId: svc, typeId: null, actif: true });
            }
        });

        const imagerieTarifs = [['Radiographie', 15000], ['Echographie', 25000], ['Scanner', 75000], ['IRM', 100000], ['Mammographie', 20000]];
        imagerieTarifs.forEach(([lib, montant]) => {
            if (!existing.some(t => t.categorie === 'Imagerie' && t.libelle === lib)) {
                created.push({ id: DB.generateId(), categorie: 'Imagerie', libelle: lib, montant, serviceId: null, typeId: null, actif: true });
            }
        });

        const chirurgieTarifs = [['Appendicectomie', 100000], ['Cesarie', 150000], ['Hernie inguinale', 90000], ['Petite chirurgie', 30000]];
        chirurgieTarifs.forEach(([lib, montant]) => {
            if (!existing.some(t => t.categorie === 'Chirurgie' && t.libelle === lib)) {
                created.push({ id: DB.generateId(), categorie: 'Chirurgie', libelle: lib, montant, serviceId: null, typeId: null, actif: true });
            }
        });

        if (created.length > 0) {
            await DB.putAll('tarifs', created);
            UI.toast(created.length + ' tarifs generes', 'success');
        } else {
            UI.toast('Les tarifs sont deja a jour', 'info');
        }
        this.render();
    },

    async printListe() {
        const tarifs = await DB.getAll('tarifs');
        const services = await DB.getAll('services');
        const getSvc = (id) => { const s = services.find(x => x.id === id); return id && s ? s.nom : 'Tous services'; };
        const grouped = {};
        tarifs.forEach(t => { (grouped[t.categorie] = grouped[t.categorie] || []).push(t); });

        const rows = Object.keys(grouped).sort().map(cat => `
            <tr style="background:#f1f3f4"><th colspan="4" style="text-align:left">${cat} (${grouped[cat].length})</th></tr>
            ${grouped[cat].slice().sort((a, b) => (a.libelle || '').localeCompare(b.libelle || '')).map(t => `
                <tr>
                    <td>${t.libelle || '-'}</td>
                    <td>${getSvc(t.serviceId)}</td>
                    <td style="text-align:right">${UI.formatMoney(t.montant)}</td>
                    <td>${t.actif === false ? 'Inactif' : 'Actif'}</td>
                </tr>
            `).join('')}
        `).join('');

        const body = `
            <div class="print-title">LISTE DES TARIFS DES SERVICES</div>
            <table>
                <thead><tr><th>Libelle</th><th>Service</th><th style="text-align:right">Montant</th><th>Statut</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4">Aucun tarif</td></tr>'}</tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le Directeur</span></div>
                <div><span class="line">La caisse</span></div>
            </div>
        `;
        await Print.open('Liste des tarifs', body);
    },

    cleanup() {}
};

window.tarifsModule = tarifsModule;