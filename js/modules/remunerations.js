const remunerationsModule = {
    tab: 'salaires',
    _editId: null,

    // Taux legaux (configurables ici, modifiables dans le form)
    TAUX_INPS_SALARIAL: 0.09,
    TAUX_INPS_PATRONAL: 0.09,
    TAUX_AMO_SALARIAL: 0.02,
    TAUX_AMO_PATRONAL: 0.03,
    TAUX_PRECOMPTE_HONORAIRE: 0.15,

    calculerBulletin(base, primes, opts = {}) {
        const isHonoraire = opts.type === 'Honoraire';
        const totalPrimes = (primes || []).reduce((s, p) => s + (Number(p.montant) || 0), 0);
        const brut = (Number(base) || 0) + totalPrimes;
        const inpsSalarial = isHonoraire ? 0 : Math.round(brut * this.TAUX_INPS_SALARIAL);
        const amoSalarial = isHonoraire ? 0 : Math.round(brut * this.TAUX_AMO_SALARIAL);
        const autres = Number(opts.autresRetenues || 0);
        const precompte = isHonoraire ? (Number(opts.precompte) || 0) : 0;
        const totalRetenuesSalariales = inpsSalarial + amoSalarial + autres + precompte;
        const montantNet = brut - totalRetenuesSalariales;
        const inpsPatronal = isHonoraire ? 0 : Math.round(brut * this.TAUX_INPS_PATRONAL);
        const amoPatronal = isHonoraire ? 0 : Math.round(brut * this.TAUX_AMO_PATRONAL);
        const totalChargesPatronales = inpsPatronal + amoPatronal;
        return {
            salaireBase: Number(base) || 0,
            primes, totalPrimes,
            montantBrut: brut,
            inpsSalarial, amoSalarial, autresRetenues: autres, precompte,
            totalRetenuesSalariales,
            montantRetenus: totalRetenuesSalariales,
            montantNet,
            inpsPatronal, amoPatronal, totalChargesPatronales,
            coutTotalEmployeur: brut + totalChargesPatronales
        };
    },

    async show() {
        UI.setPageTitle('Salaires & Honoraires');
        const container = document.getElementById('content-area');
        container.innerHTML = `
            <div class="tabs">
                <button class="tab ${this.tab === 'salaires' ? 'active' : ''}" onclick="remunerationsModule.switchTab('salaires')">Salaires</button>
                <button class="tab ${this.tab === 'honoraires' ? 'active' : ''}" onclick="remunerationsModule.switchTab('honoraires')">Honoraires</button>
            </div>
            <div id="remun-content"></div>
        `;
        await this.renderTab();
    },

    switchTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
        this.renderTab();
    },

    async renderTab() {
        const content = document.getElementById('remun-content');
        if (this.tab === 'salaires') await this.renderSalaires(content);
        else await this.renderHonoraires(content);
    },

    async _donnees(type) {
        const [remuns, personnel, services] = await Promise.all([DB.getAll('remunerations'), DB.getAll('personnel'), DB.getAll('services')]);
        const getPersonnel = (id) => { const p = personnel.find(x => x.id === id); return p || null; };
        const list = remuns.filter(r => r.type === type).sort((a, b) => String(b.periode).localeCompare(String(a.periode)));
        const statutBadge = (s) => {
            const colors = { Etabli: 'warning', Paye: 'success', Annule: 'gray' };
            return UI.renderBadge(s === 'Paye' ? 'Paye' : s === 'Etabli' ? 'Etabli' : 'Annule', colors[s] || 'gray');
        };
        const norm = (r) => ({
            salaireBase: r.salaireBase !== undefined ? r.salaireBase : Number(r.montantBrut || 0),
            totalPrimes: r.totalPrimes !== undefined ? r.totalPrimes : 0,
            montantBrut: Number(r.montantBrut || 0),
            montantRetenus: Number(r.montantRetenus || 0),
            montantNet: Number(r.montantNet || 0),
            totalChargesPatronales: Number(r.totalChargesPatronales || 0)
        });
        return { remuns: list, getPersonnel, statutBadge, services, norm };
    },

    async renderSalaires(container) {
        const { remuns, getPersonnel, statutBadge, norm } = await this._donnees('Salaire');
        const totalEmis = remuns.filter(r => r.statut !== 'Annule').reduce((s, r) => s + Number(r.montantNet || 0), 0);
        const totalPaye = remuns.filter(r => r.statut === 'Paye').reduce((s, r) => s + Number(r.montantNet || 0), 0);
        const totalCharges = remuns.filter(r => r.statut !== 'Annule').reduce((s, r) => s + Number(r.totalChargesPatronales || 0), 0);

        container.innerHTML = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9786;', remuns.length, 'Bulletins etablis', 'blue')}
                ${UI.renderStatCard('&#9830;', UI.formatMoney(totalEmis), 'Total salaires emis (net)', 'purple')}
                ${UI.renderStatCard('&#10003;', UI.formatMoney(totalPaye), 'Total paye', 'green')}
                ${UI.renderStatCard('&#8646;', UI.formatMoney(totalCharges), 'Total charges patronales', 'orange')}
            </div>

            ${Auth.can('remunerations', 3) ? `
            <div class="toolbar" style="margin-bottom:16px">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="remunerationsModule.printJournal('Salaire')">Journal des salaires</button>
                    <button class="btn btn-primary" onclick="remunerationsModule.showForm('Salaire')">+ Etablir un bulletin</button>
                </div>
            </div>` : ''}

            <div class="card">
                <div class="card-header"><h3>Salaires des employes</h3></div>
                ${remuns.length === 0 ? '<div class="empty-state"><p>Aucun bulletin de salaire</p></div>' : `
                <table class="permissions-tbl" style="width:100%">
                    <thead><tr><th>Employe</th><th>Periode</th><th>Matricule</th><th style="text-align:right">Base</th><th style="text-align:right">Primes</th><th style="text-align:right">Brut</th><th style="text-align:right">Retenues</th><th style="text-align:right">Net</th><th style="text-align:right">Charges patr.</th><th>Statut</th>${Auth.can('remunerations', 3) ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody>
                        ${remuns.map(r => {
                            const p = getPersonnel(r.personnelId);
                            const n = norm(r);
                            return `<tr>
                                <td><strong>${p ? p.prenom + ' ' + p.nom : r.personnelId}</strong></td>
                                <td>${r.periode || '-'}</td>
                                <td>${p ? p.matricule : '-'}</td>
                                <td style="text-align:right">${UI.formatMoney(n.salaireBase)}</td>
                                <td style="text-align:right">${n.totalPrimes ? UI.formatMoney(n.totalPrimes) : '-'}</td>
                                <td style="text-align:right">${UI.formatMoney(n.montantBrut)}</td>
                                <td style="text-align:right">${UI.formatMoney(n.montantRetenus)}</td>
                                <td style="text-align:right"><strong>${UI.formatMoney(n.montantNet)}</strong></td>
                                <td style="text-align:right">${UI.formatMoney(n.totalChargesPatronales)}</td>
                                <td>${statutBadge(r.statut)}</td>
                                ${Auth.can('remunerations', 3) ? `<td>
                                    <button class="btn btn-sm btn-outline" onclick="remunerationsModule.showForm('Salaire','${r.id}')">Modifier</button>
                                    ${r.statut !== 'Paye' ? `<button class="btn btn-sm btn-success" onclick="remunerationsModule.showPaiementForm('${r.id}')">Payer</button>` : ''}
                                    <button class="btn btn-sm btn-outline" onclick="remunerationsModule.printBulletin('${r.id}')">Bulletin</button>
                                    ${r.statut !== 'Paye' ? `<button class="btn btn-sm btn-danger" onclick="remunerationsModule.annuler('${r.id}')">Annuler</button>` : ''}
                                </td>` : ''}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>`}
            </div>
        `;
    },

    async renderHonoraires(container) {
        const { remuns, getPersonnel, statutBadge, norm } = await this._donnees('Honoraire');
        const totalEmis = remuns.filter(r => r.statut !== 'Annule').reduce((s, r) => s + Number(r.montantNet || 0), 0);
        const totalPaye = remuns.filter(r => r.statut === 'Paye').reduce((s, r) => s + Number(r.montantNet || 0), 0);

        container.innerHTML = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9786;', remuns.length, 'Honoraires etablis', 'purple')}
                ${UI.renderStatCard('&#9830;', UI.formatMoney(totalEmis), 'Total honoraires emis', 'purple')}
                ${UI.renderStatCard('&#10003;', UI.formatMoney(totalPaye), 'Total paye', 'green')}
            </div>

            ${Auth.can('remunerations', 3) ? `
            <div class="toolbar" style="margin-bottom:16px">
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="remunerationsModule.printJournal('Honoraire')">Journal des honoraires</button>
                    <button class="btn btn-primary" onclick="remunerationsModule.showForm('Honoraire')">+ Nouvel honoraire</button>
                </div>
            </div>` : ''}

            <div class="card">
                <div class="card-header"><h3>Honoraires des prestataires</h3></div>
                ${remuns.length === 0 ? '<div class="empty-state"><p>Aucun honoraire enregistre</p></div>' : `
                <table class="permissions-tbl" style="width:100%">
                    <thead><tr><th>Prestataire</th><th>Periode</th><th>Matricule</th><th style="text-align:right">Base</th><th style="text-align:right">Primes</th><th style="text-align:right">Brut</th><th style="text-align:right">Retenues</th><th style="text-align:right">Net</th><th>Statut</th>${Auth.can('remunerations', 3) ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody>
                        ${remuns.map(r => {
                            const p = getPersonnel(r.personnelId);
                            const n = norm(r);
                            return `<tr>
                                <td><strong>${p ? p.prenom + ' ' + p.nom : r.personnelId}</strong></td>
                                <td>${r.periode || '-'}</td>
                                <td>${p ? p.matricule : '-'}</td>
                                <td style="text-align:right">${UI.formatMoney(n.salaireBase)}</td>
                                <td style="text-align:right">${n.totalPrimes ? UI.formatMoney(n.totalPrimes) : '-'}</td>
                                <td style="text-align:right">${UI.formatMoney(n.montantBrut)}</td>
                                <td style="text-align:right">${UI.formatMoney(n.montantRetenus)}</td>
                                <td style="text-align:right"><strong>${UI.formatMoney(n.montantNet)}</strong></td>
                                <td>${statutBadge(r.statut)}</td>
                                ${Auth.can('remunerations', 3) ? `<td>
                                    <button class="btn btn-sm btn-outline" onclick="remunerationsModule.showForm('Honoraire','${r.id}')">Modifier</button>
                                    ${r.statut !== 'Paye' ? `<button class="btn btn-sm btn-success" onclick="remunerationsModule.showPaiementForm('${r.id}')">Payer</button>` : ''}
                                    <button class="btn btn-sm btn-outline" onclick="remunerationsModule.printBulletin('${r.id}')">Recu</button>
                                    ${r.statut !== 'Paye' ? `<button class="btn btn-sm btn-danger" onclick="remunerationsModule.annuler('${r.id}')">Annuler</button>` : ''}
                                </td>` : ''}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>`}
            </div>
        `;
    },

    async showForm(type, remunerationId) {
        this._editId = remunerationId || null;
        const personnel = await DB.getAll('personnel');
        const isHonoraire = type === 'Honoraire';
        const eligible = personnel.filter(p => isHonoraire ? p.type === 'Prestataire' : p.type !== 'Prestataire');
        const r = this._editId ? await DB.get('remunerations', this._editId) : null;
        const moisCourant = new Date().toISOString().slice(0, 7);

        if (eligible.length === 0) {
            UI.toast(isHonoraire ? 'Aucun prestataire. Ajoutez du personnel de type Prestataire.' : 'Aucun employe', 'warning');
            return;
        }

        const base = r ? (r.salaireBase !== undefined ? r.salaireBase : Number(r.montantBrut || 0)) : '';
        const primes = (r && r.primes) || [];
        const precompte = r ? String(r.precompte !== undefined ? r.precompte : (r.montantRetenus || 0)) : '';

        const staticHtml = UI.buildForm([
            { name: 'personnelId', label: isHonoraire ? 'Prestataire' : 'Employe', type: 'select', required: true, options: eligible.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom} (${p.type})` })), default: r ? r.personnelId : '' },
            { name: 'periode', label: 'Periode (Ex: 2026-09 ou periode libre)', required: true, default: r ? r.periode : moisCourant, placeholder: '2026-09' },
            { name: 'salaireBase', label: 'Salaire de base', type: 'number', required: true, default: base !== '' ? String(base) : '' },
            isHonoraire
                ? { name: 'precompte', label: 'Precompte / retenues', type: 'number', default: precompte }
                : { name: 'autresRetenues', label: 'Autres retenues (avances, saisies...)', type: 'number', default: r ? String(r.autresRetenues || 0) : '0' },
            { name: 'motif', label: isHonoraire ? 'Motif / Prestations couvertes' : 'Motif', default: r ? (r.motif || '') : '', placeholder: isHonoraire ? 'Ex: consultations externes' : '' }
        ]);

        const primesHtml = `
            <div class="form-group" style="margin-top:14px">
                <label>Primes</label>
                <div id="remun-primes">
                    ${primes.map((p, i) => `
                        <div class="prime-row" style="display:flex;gap:8px;margin-bottom:6px">
                            <input type="text" class="prime-nom" value="${p.nom || ''}" placeholder="Nom de la prime" style="flex:2;padding:6px;border:1px solid var(--border);border-radius:6px">
                            <input type="number" class="prime-montant" value="${p.montant || ''}" placeholder="Montant" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:6px">
                            <button type="button" class="btn btn-sm btn-danger" onclick="remunerationsModule.removePrime(this)">X</button>
                        </div>`).join('')}
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="remunerationsModule.addPrime()">+ Ajouter une prime</button>
            </div>
        `;

        const calculHtml = `
            <div class="card" style="margin-top:16px;padding:12px">
                <h4 style="margin-bottom:8px">Calcul automatique</h4>
                ${this.lignesCalcul(isHonoraire)}
            </div>
        `;

        UI.showModal((this._editId ? 'Modifier ' : 'Etablir ') + (isHonoraire ? 'un honoraire' : 'un bulletin de salaire'), staticHtml + primesHtml + calculHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="remunerationsModule.save('${type}')">Enregistrer</button>
        `);

        this.initPrimesForm(type);
    },

    lignesCalcul(isHonoraire) {
        return `
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Brut (base + primes)</span><strong id="r-brut">0 FCFA</strong></div>
            ${isHonoraire ? '' : `
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span>INPS (part salarie, 9%)</span><span id="r-inps">0 FCFA</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span>AMO (part salarie, 2%)</span><span id="r-amo">0 FCFA</span></div>`}
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Total retenues</span><span id="r-retenues">0 FCFA</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #e0e0e0"><strong>NET A PAYER</strong><strong id="r-net" style="color:#1e8e3e">0 FCFA</strong></div>
            ${isHonoraire ? '' : `
            <div style="display:flex;justify-content:space-between;padding:3px 0;margin-top:6px;border-top:1px dashed #e0e0e0"><span>INPS (part patronale, 9%)</span><span id="r-inps-pat">0 FCFA</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span>AMO (part patronale, 3%)</span><span id="r-amo-pat">0 FCFA</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Total charges patronales</span><span id="r-pat">0 FCFA</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #e0e0e0"><strong>COUT TOTAL EMPLOYEUR</strong><strong id="r-cout" style="color:#c5221f">0 FCFA</strong></div>`}
        `;
    },

    initPrimesForm(type) {
        this._formType = type;
        const modal = document.querySelector('.modal-body');
        modal.addEventListener('input', () => this.recalculer());
        this.recalculer();
    },

    addPrime() {
        const container = document.getElementById('remun-primes');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'prime-row';
        row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
        row.innerHTML = `
            <input type="text" class="prime-nom" placeholder="Nom de la prime" style="flex:2;padding:6px;border:1px solid var(--border);border-radius:6px">
            <input type="number" class="prime-montant" placeholder="Montant" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:6px">
            <button type="button" class="btn btn-sm btn-danger" onclick="remunerationsModule.removePrime(this)">X</button>
        `;
        container.appendChild(row);
        this.recalculer();
    },

    removePrime(btn) {
        const container = document.getElementById('remun-primes');
        if (container && container.children.length > 1) btn.closest('.prime-row').remove();
        else if (container) btn.closest('.prime-row').remove();
        this.recalculer();
    },

    _lirePrimes() {
        const container = document.getElementById('remun-primes');
        const primes = [];
        if (container) container.querySelectorAll('.prime-row').forEach(row => {
            const nom = row.querySelector('.prime-nom').value.trim();
            const montant = Number(row.querySelector('.prime-montant').value) || 0;
            if (nom || montant > 0) primes.push({ nom: nom || 'Prime', montant });
        });
        return primes;
    },

    recalculer() {
        const modal = document.querySelector('.modal-body');
        if (!modal) return;
        const isHonoraire = this._formType === 'Honoraire';
        const base = Number(modal.querySelector('[name="salaireBase"]').value) || 0;
        const primes = this._lirePrimes();
        const autres = Number((modal.querySelector('[name="autresRetenues"]') || { value: 0 }).value) || 0;
        const precompte = Number((modal.querySelector('[name="precompte"]') || { value: 0 }).value) || 0;

        const c = this.calculerBulletin(base, primes, { type: this._formType, autresRetenues: autres, precompte });
        const fmt = (v) => UI.formatMoney(v);

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('r-brut', fmt(c.montantBrut));
        if (!isHonoraire) {
            set('r-inps', fmt(c.inpsSalarial));
            set('r-amo', fmt(c.amoSalarial));
        }
        set('r-retenues', fmt(c.totalRetenuesSalariales));
        set('r-net', fmt(Math.max(0, c.montantNet)));
        if (!isHonoraire) {
            set('r-inps-pat', fmt(c.inpsPatronal));
            set('r-amo-pat', fmt(c.amoPatronal));
            set('r-pat', fmt(c.totalChargesPatronales));
            set('r-cout', fmt(c.coutTotalEmployeur));
        }
    },

    async save(type) {
        const isHonoraire = type === 'Honoraire';
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.personnelId || !data.periode || !Number(data.salaireBase) || Number(data.salaireBase) <= 0) {
            UI.toast(isHonoraire ? 'Prestataire, periode et salaire de base (positif) requis' : 'Personnel, periode et salaire de base (positif) requis', 'error'); return;
        }
        const primes = this._lirePrimes();
        const c = this.calculerBulletin(data.salaireBase, primes, {
            type,
            autresRetenues: data.autresRetenues,
            precompte: data.precompte
        });
        if (c.montantNet < 0) { UI.toast('Les retenues ne peuvent pas depasser le brut', 'error'); return; }

        const remum = this._editId ? await DB.get('remunerations', this._editId) : { id: DB.generateId(), type, dateEmission: new Date().toISOString(), statut: 'Etabli' };
        Object.assign(remum, {
            type,
            personnelId: data.personnelId,
            periode: data.periode,
            salaireBase: c.salaireBase,
            primes,
            totalPrimes: c.totalPrimes,
            montantBrut: c.montantBrut,
            inpsSalarial: c.inpsSalarial,
            amoSalarial: c.amoSalarial,
            autresRetenues: c.autresRetenues,
            precompte: c.precompte,
            totalRetenuesSalariales: c.totalRetenuesSalariales,
            montantRetenus: c.montantRetenus,
            montantNet: c.montantNet,
            inpsPatronal: c.inpsPatronal,
            amoPatronal: c.amoPatronal,
            totalChargesPatronales: c.totalChargesPatronales,
            coutTotalEmployeur: c.coutTotalEmployeur,
            motif: data.motif || '',
            datePaiement: remum.datePaiement || null,
            modePaiement: remum.modePaiement || null
        });
        await DB.put('remunerations', remum);
        UI.toast('Remuneration enregistree', 'success');
        await Auth.log(this._editId ? 'Modification' : 'Creation', 'remunerations', `${type} ${data.periode} -> ${c.montantNet}`);
        this._editId = null;
        UI.hideModal();
        this.renderTab();
    },

    async showPaiementForm(remunId) {
        const r = await DB.get('remunerations', remunId);
        UI.showModal('Paiement ' + (r.type === 'Salaire' ? 'du salaire' : 'des honoraires'), `
            <p><strong>Montant net a payer:</strong> ${UI.formatMoney(r.montantNet)}</p>
            <div class="form-group" style="margin-top:16px">
                <label>Mode de paiement</label>
                <select id="remun-mode">
                    <option value="Especes">Especes</option>
                    <option value="Virement">Virement bancaire</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Mobile Money">Mobile Money</option>
                </select>
            </div>
            <div class="form-group">
                <label>Date de paiement</label>
                <input type="date" id="remun-date" value="${new Date().toISOString().slice(0, 10)}">
            </div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-success" onclick="remunerationsModule.payer('${remunId}')">Confirmer le paiement</button>
        `);
    },

    async payer(remunId) {
        const r = await DB.get('remunerations', remunId);
        r.statut = 'Paye';
        r.datePaiement = new Date(document.getElementById('remun-date').value + 'T00:00:00').toISOString();
        r.modePaiement = document.getElementById('remun-mode').value;
        await DB.put('remunerations', r);
        UI.toast('Paiement enregistre', 'success');
        await Auth.log('Paiement', 'remunerations', `${r.type} ${r.periode} (${r.montantNet}) - ${r.modePaiement}`);
        UI.hideModal();
        this.renderTab();
    },

    async annuler(remunId) {
        const ok = await UI.confirm('Annuler cette remuneration ?');
        if (!ok) return;
        const r = await DB.get('remunerations', remunId);
        r.statut = 'Annule';
        await DB.put('remunerations', r);
        UI.toast('Remuneration annulee', 'success');
        this.renderTab();
    },

    async printBulletin(remunId) {
        const r = await DB.get('remunerations', remunId);
        if (!r) return;
        const personnel = await DB.getAll('personnel');
        const p = personnel.find(x => x.id === r.personnelId);
        const estSalaire = r.type === 'Salaire';
        const primes = r.primes || [];
        const base = r.salaireBase !== undefined ? r.salaireBase : Number(r.montantBrut || 0);
        const inps = Number(r.inpsSalarial || 0);
        const amo = Number(r.amoSalarial || 0);
        const autres = Number(r.autresRetenues || 0);
        const precompte = Number(r.precompte || 0);
        const retenues = Number(r.montantRetenus || 0);
        const inpsPatronal = Number(r.inpsPatronal || 0);
        const amoPatronal = Number(r.amoPatronal || 0);
        const patronal = Number(r.totalChargesPatronales || 0);
        const cout = r.coutTotalEmployeur !== undefined ? r.coutTotalEmployeur : (Number(r.montantBrut || 0));

        const primesRows = primes.length > 0
            ? primes.map(pr => `<tr><td>Prime : ${pr.nom || 'Prime'}</td><td style="text-align:right">${UI.formatMoney(pr.montant)}</td></tr>`).join('')
            : '<tr><td colspan="2" style="color:#5f6368">Aucune prime</td></tr>';

        const body = `
            <div class="print-title">${estSalaire ? 'BULLETIN DE SALAIRE' : 'RECU D\'HONORAIRES'}</div>
            <table>
                <tbody>
                <tr><th>${estSalaire ? 'Employe' : 'Prestataire'}</th><td colspan="3">${p ? p.prenom + ' ' + p.nom : r.personnelId} ${p ? '(' + p.matricule + ')' : ''}</td></tr>
                <tr><th>Periode</th><td>${r.periode || '-'}</td><th>Date emission</th><td>${UI.formatDate(r.dateEmission)}</td></tr>
                <tr><th>Statut</th><td>${r.statut}</td><th>Motif</th><td>${r.motif || '-'}</td></tr>
                </tbody>
            </table>
            <table>
                <tbody>
                    <tr><th>${estSalaire ? 'Salaire de base' : 'Base'} </th><td style="text-align:right">${UI.formatMoney(base)}</td></tr>
                    ${primesRows}
                    <tr><th>Total primes</th><td style="text-align:right">${UI.formatMoney(r.totalPrimes || primes.reduce((s, pr) => s + Number(pr.montant || 0), 0))}</td></tr>
                    <tr><th style="border-top:2px solid #202124">Brut</th><th class="print-total" style="text-align:right;border-top:2px solid #202124">${UI.formatMoney(r.montantBrut)}</th></tr>
                    ${estSalaire ? `
                    <tr><th>INPS (part salarie, 9%)</th><td style="text-align:right">${UI.formatMoney(inps)}</td></tr>
                    <tr><th>AMO (part salarie, 2%)</th><td style="text-align:right">${UI.formatMoney(amo)}</td></tr>
                    ${autres ? `<tr><th>Autres retenues</th><td style="text-align:right">${UI.formatMoney(autres)}</td></tr>` : ''}
                    ` : `<tr><th>${precompte ? 'Precompte professionnel' : 'Retenues'}</th><td style="text-align:right">${UI.formatMoney(retenues)}</td></tr>`}
                    <tr><th>Total retenues</th><td style="text-align:right">${UI.formatMoney(retenues)}</td></tr>
                    <tr><th style="text-align:right">NET A PAYER</th><th class="print-total" style="text-align:right;color:#1e8e3e">${UI.formatMoney(r.montantNet)}</th></tr>
                    ${r.statut === 'Paye' ? `<tr><th>Paiement</th><td style="text-align:right">${UI.formatDate(r.datePaiement)} - ${r.modePaiement || '-'}</td></tr>` : ''}
                </tbody>
            </table>
            ${estSalaire ? `
            <table style="margin-top:16px">
                <tbody>
                    <tr><th style="color:#c5221f">INPS (part patronale, 9%)</th><td style="text-align:right">${UI.formatMoney(inpsPatronal)}</td></tr>
                    <tr><th style="color:#c5221f">AMO (part patronale, 3%)</th><td style="text-align:right">${UI.formatMoney(amoPatronal)}</td></tr>
                    <tr><th style="color:#c5221f">COUT TOTAL EMPLOYEUR</th><th class="print-total" style="text-align:right;color:#c5221f">${UI.formatMoney(cout)}</th></tr>
                </tbody>
            </table>` : ''}
            <p style="margin-top:8px;color:#5f6368">Montant net en toutes lettres : <strong>${UI.formatMoney(r.montantNet)}</strong></p>
            <div class="print-sign">
                <div><span class="line">${estSalaire ? 'L\'employe' : 'Le prestataire'}</span></div>
                <div><span class="line">La direction</span></div>
            </div>
        `;
        await Print.open((estSalaire ? 'Bulletin de salaire' : 'Recu d\'honoraires') + ' - ' + (p ? p.nom : r.personnelId) + ' ' + (r.periode || ''), body);
    },

    async printJournal(type) {
        const { remuns, getPersonnel } = await this._donnees(type);
        const estSalaire = type === 'Salaire';
        const list = remuns.filter(r => r.statut !== 'Annule');
        const rows = list.map(r => {
            const p = getPersonnel(r.personnelId);
            const base = r.salaireBase !== undefined ? r.salaireBase : Number(r.montantBrut || 0);
            return `<tr>
                <td>${p ? p.prenom + ' ' + p.nom : r.personnelId}</td>
                <td>${p ? p.matricule : '-'}</td>
                <td>${r.periode || '-'}</td>
                <td style="text-align:right">${UI.formatMoney(base)}</td>
                <td style="text-align:right">${r.totalPrimes ? UI.formatMoney(r.totalPrimes) : '-'}</td>
                <td style="text-align:right">${UI.formatMoney(r.montantBrut)}</td>
                <td style="text-align:right">${UI.formatMoney(r.montantRetenus)}</td>
                <td style="text-align:right">${UI.formatMoney(r.montantNet)}</td>
                ${estSalaire ? `<td style="text-align:right">${UI.formatMoney(r.totalChargesPatronales || 0)}</td>` : ''}
                <td>${r.statut === 'Paye' ? UI.formatDate(r.datePaiement) + ' (' + (r.modePaiement || '-') + ')' : 'Non paye'}</td>
            </tr>`;
        }).join('');
        const totalNet = list.reduce((s, r) => s + Number(r.montantNet || 0), 0);
        const totalPaye = list.filter(r => r.statut === 'Paye').reduce((s, r) => s + Number(r.montantNet || 0), 0);
        const totalPatronal = list.reduce((s, r) => s + Number(r.totalChargesPatronales || 0), 0);

        const body = `
            <div class="print-title">${estSalaire ? 'JOURNAL DES SALAIRES' : 'JOURNAL DES HONORAIRES'}</div>
            <table>
                <thead><tr><th>${estSalaire ? 'Employe' : 'Prestataire'}</th><th>Matricule</th><th>Periode</th><th style="text-align:right">Base</th><th style="text-align:right">Primes</th><th style="text-align:right">Brut</th><th style="text-align:right">Retenues</th><th style="text-align:right">Net</th>${estSalaire ? '<th style="text-align:right">Charges patr.</th>' : ''}<th>Paiement</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="10">Aucune remuneration</td></tr>'}</tbody>
                <tfoot>
                    <tr><th colspan="7" style="text-align:right">Total net</th><th class="print-total" style="text-align:right">${UI.formatMoney(totalNet)}</th>${estSalaire ? '<td></td>' : ''}<td></td></tr>
                    <tr><th colspan="7" style="text-align:right">Total paye</th><th style="text-align:right">${UI.formatMoney(totalPaye)}</th>${estSalaire ? '<td></td>' : ''}<td></td></tr>
                    <tr><th colspan="7" style="text-align:right">Reste a payer</th><th style="text-align:right">${UI.formatMoney(totalNet - totalPaye)}</th>${estSalaire ? '<td></td>' : ''}<td></td></tr>
                    ${estSalaire ? `<tr><th colspan="7" style="text-align:right">Total charges patronales</th><th style="text-align:right">${UI.formatMoney(totalPatronal)}</th><td></td><td></td></tr>` : ''}
                </tfoot>
            </table>
            <div class="print-sign">
                <div><span class="line">Le Directeur</span></div>
                <div><span class="line">La comptabilite</span></div>
            </div>
        `;
        await Print.open((estSalaire ? 'Journal des salaires' : 'Journal des honoraires'), body);
    },

    cleanup() {}
};

window.remunerationsModule = remunerationsModule;