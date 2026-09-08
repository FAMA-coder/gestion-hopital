const paiementsModule = {
    async show() {
        UI.setPageTitle('Paiements & Encaissements');
        const container = document.getElementById('content-area');

        const [paiements, factures, patients, users] = await Promise.all([
            DB.getAll('paiements'),
            DB.getAll('factures'),
            DB.getAll('patients'),
            DB.getAll('users')
        ]);

        paiements.sort((a, b) => new Date(b.date) - new Date(a.date));

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getUser = (id) => { const u = users.find(x => x.id === id); return u ? u.nomComplet || u.nomUtilisateur : id; };
        const modeColor = (m) => ({ Especes: 'success', Carte: 'purple', Virement: 'info', Assurance: 'warning', Mutuelle: 'info' }[m] || 'gray');

        const total = paiements.reduce((s, p) => s + p.montant, 0);
        const today = new Date().toDateString();
        const totalToday = paiements.filter(p => new Date(p.date).toDateString() === today).reduce((s, p) => s + p.montant, 0);

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9830;', UI.formatMoney(total), 'Total encaisse', 'purple')}
                ${UI.renderStatCard('&#128337;', UI.formatMoney(totalToday), "Encaissements du jour", 'green')}
                ${UI.renderStatCard('&#128203;', paiements.length, 'Operations', 'blue')}
            </div>

            <div class="toolbar" style="margin-top:12px">
                <div class="toolbar-left" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                    <label style="font-size:12px;color:var(--text-secondary)">Du <input type="date" id="pj-from" style="padding:6px;border:1px solid var(--border);border-radius:6px"></label>
                    <label style="font-size:12px;color:var(--text-secondary)">Au <input type="date" id="pj-to" style="padding:6px;border:1px solid var(--border);border-radius:6px"></label>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="paiementsModule.printJournalCaisse()">&#128424; Journal de caisse</button>
                </div>
            </div>

            ${Auth.can('paiements', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="paiementsModule.showForm()">+ Nouvel Encaissement</button></div>' : ''}

            <div class="card">
                ${UI.renderTable([
                    { field: 'date', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'patientId', label: 'Patient', render: (v) => `<strong>${getPat(v)}</strong>` },
                    { field: 'montant', label: 'Montant', render: (v) => `<strong>${UI.formatMoney(v)}</strong>` },
                    { field: 'mode', label: 'Mode', render: (v) => UI.renderBadge(v, modeColor(v)) },
                    { field: 'caissierId', label: 'Caissier', render: (v) => getUser(v) },
                    { field: 'factureId', label: 'N. Facture', render: (v) => v ? v.slice(-6).toUpperCase() : '-' },
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-outline" title="Imprimer la quittance" onclick="paiementsModule.printQuittance('${row.id}')">&#128424; Quittance</button>
                    ` }
                ], paiements, { actions: false, emptyTitle: 'Aucun encaissement', emptyText: 'Aucun paiement enregistre.' })}
            </div>
        `;
        container.innerHTML = html;
    },

    async showForm() {
        const factures = await DB.getAll('factures');
        const patients = await DB.getAll('patients');
        const encaissables = factures.filter(f => f.statut !== 'EntierementPayee' && f.statut !== 'Annulee' && (f.resteApayer || 0) > 0);

        if (encaissables.length === 0) {
            UI.toast('Aucune facture avec un reste a payer', 'warning');
            return;
        }

        const modeOptions = [
            { value: 'Especes', label: 'Especes' },
            { value: 'Carte', label: 'Carte' },
            { value: 'Virement', label: 'Virement' },
            { value: 'Assurance', label: 'Assurance' },
            { value: 'Mutuelle', label: 'Mutuelle' }
        ];

        const formHtml = `
            <div class="form-group">
                <label>Facture / Patient</label>
                <select id="paiements-facture" onchange="paiementsModule.factureChange()">
                    ${encaissables.map(f => {
                        const p = patients.find(x => x.id === f.patientId);
                        return `<option value="${f.id}" data-reste="${f.resteApayer}" data-total="${f.montantTotal}" data-paye="${f.montantPaye || 0}">${p ? p.nom + ' ' + p.prenom : f.patientId} - Reste ${f.resteApayer} FCFA</option>`;
                    }).join('')}
                </select>
            </div>
            <div id="paiements-facture-info"></div>
            <div class="form-group">
                <label>Montant a encaisser</label>
                <input type="number" id="paiements-montant" min="0" placeholder="Montant">
            </div>
            <div class="form-group">
                <label>Mode de paiement</label>
                <select id="paiements-mode">${modeOptions.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}</select>
            </div>
        `;

        UI.showModal('Nouvel Encaissement', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-success" onclick="paiementsModule.save()">Encaisser</button>
        `);
        this.factureChange();
    },

    factureChange() {
        const sel = document.getElementById('paiements-facture');
        const opt = sel.options[sel.selectedIndex];
        if (!opt) return;
        const reste = opt.dataset.reste;
        document.getElementById('paiements-facture-info').innerHTML = `
            <div class="form-group">
                <p style="margin:4px 0"><strong>Total facture:</strong> ${UI.formatMoney(opt.dataset.total)}</p>
                <p style="margin:4px 0"><strong>Deja paye:</strong> ${UI.formatMoney(opt.dataset.paye)}</p>
                <p style="margin:4px 0"><strong>Reste a payer:</strong> <span style="color:var(--danger)">${UI.formatMoney(reste)}</span></p>
            </div>
        `;
        const m = document.getElementById('paiements-montant');
        m.max = reste;
        m.value = reste;
    },

    async save() {
        const factureId = document.getElementById('paiements-facture').value;
        const montant = Number(document.getElementById('paiements-montant').value);
        const mode = document.getElementById('paiements-mode').value;
        const facture = await DB.get('factures', factureId);
        if (!facture) { UI.toast('Facture introuvable', 'error'); return; }
        if (!montant || montant <= 0) { UI.toast('Montant invalide', 'error'); return; }
        if (montant > facture.resteApayer) { UI.toast(`Le montant ne peut pas depasser ${UI.formatMoney(facture.resteApayer)}`, 'error'); return; }

        facture.montantPaye = (facture.montantPaye || 0) + montant;
        facture.resteApayer = facture.montantTotal - facture.montantPaye;
        facture.statut = facture.resteApayer <= 0 ? 'EntierementPayee' : 'PartiellementPayee';
        facture.modePaiement = mode;
        await DB.put('factures', facture);

        const paiement = {
            id: DB.generateId(),
            factureId,
            patientId: facture.patientId,
            date: new Date().toISOString(),
            montant,
            mode,
            caissierId: Auth.currentUser.id
        };
        await DB.put('paiements', paiement);

        UI.toast(`Encaissement de ${UI.formatMoney(montant)} effectue`, 'success');
        await Auth.log('Encaissement', 'paiements', `Montant ${montant} FCFA - mode ${mode}`);
        UI.hideModal();
        this.show();
    },

    async printQuittance(paiementId) {
        const paie = await DB.get('paiements', paiementId);
        if (!paie) return;
        const [facture, patients, users] = await Promise.all([DB.get('factures', paie.factureId), DB.getAll('patients'), DB.getAll('users')]);
        const p = patients.find(x => x.id === paie.patientId);
        const caissier = users.find(x => x.id === paie.caissierId);
        const hopital = await Meta.getHopital();

        const body = `
            <div class="print-title">QUITTANCE DE PAIEMENT</div>
            <table>
                <tr><th>N. Facture</th><td>${facture ? facture.id.slice(-8).toUpperCase() : paie.factureId}</td><th>Date</th><td>${UI.formatDateTime(paie.date)}</td></tr>
                <tr><th>Patient</th><td colspan="3">${p ? p.nom + ' ' + p.prenom : paie.patientId}</td></tr>
                <tr><th>Motif</th><td colspan="3">${facture && facture.description ? facture.description : facture ? 'Soins hospitaliers' : '-'}</td></tr>
                <tr><th>Mode de paiement</th><td>${paie.mode}</td><th>Reçu en caisse</th><td>${caissier ? caissier.nomComplet || caissier.nomUtilisateur : 'Caisse'}</td></tr>
                <tr><th colspan="3" style="text-align:right">Montant paye</th><td class="print-total">${UI.formatMoney(paie.montant)}</td></tr>
            </table>
            <div class="print-meta" style="margin-top:14px">
                <p>Total facture : <strong>${UI.formatMoney(facture ? facture.montantTotal : paie.montant)}</strong> | Reste a payer : <strong>${UI.formatMoney(facture ? facture.resteApayer : 0)}</strong></p>
            </div>
            <div class="print-sign">
                <div><span class="line">Signature du caissier</span></div>
                <div><span class="line">Signature du patient</span></div>
            </div>
        `;
        await Print.open('Quittance - ' + (p ? p.nom : ''), body);
    },

    async printJournalCaisse() {
        const [paiements, patients, users] = await Promise.all([DB.getAll('paiements'), DB.getAll('patients'), DB.getAll('users')]);
        const fromEl = document.getElementById('pj-from');
        const toEl = document.getElementById('pj-to');

        let list = paiements.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (fromEl && fromEl.value) {
            const from = new Date(fromEl.value + 'T00:00:00');
            list = list.filter(p => new Date(p.date) >= from);
        }
        if (toEl && toEl.value) {
            const to = new Date(toEl.value + 'T23:59:59');
            list = list.filter(p => new Date(p.date) <= to);
        }

        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const getUser = (id) => { const u = users.find(x => x.id === id); return u ? (u.nomComplet || u.nomUtilisateur) : id; };
        const total = list.reduce((s, p) => s + p.montant, 0);
        const byMode = {};
        list.forEach(p => { byMode[p.mode] = (byMode[p.mode] || 0) + p.montant; });
        const modeRows = Object.entries(byMode).map(([mode, m]) => `<tr><td>${mode}</td><td style="text-align:right">${UI.formatMoney(m)}</td></tr>`).join('');

        const body = `
            <div class="print-title">JOURNAL DE CAISSE</div>
            <p style="margin:4px 0">Periode : <strong>${fromEl && fromEl.value ? UI.formatDate(fromEl.value) : 'Debut'} → ${toEl && toEl.value ? UI.formatDate(toEl.value) : 'Aujourd\'hui'}</strong> - ${list.length} operation(s)</p>
            <table>
                <thead><tr><th>#</th><th>Date</th><th>Patient</th><th>Mode</th><th>Caissier</th><th style="text-align:right">Montant</th></tr></thead>
                <tbody>
                    ${list.map((p, i) => `<tr>
                        <td>${i + 1}</td><td>${UI.formatDateTime(p.date)}</td><td>${getPat(p.patientId)}</td>
                        <td>${p.mode || '-'}</td><td>${getUser(p.caissierId)}</td><td style="text-align:right">${UI.formatMoney(p.montant)}</td>
                    </tr>`).join('')}
                </tbody>
                <tfoot>
                    <tr><th colspan="5" style="text-align:right">Total encaisse</th><th class="print-total" style="text-align:right">${UI.formatMoney(total)}</th></tr>
                </tfoot>
            </table>
            <h4 style="margin:12px 0 6px">Repartition par mode de paiement</h4>
            <table><tbody>${modeRows || '<tr><td colspan="2">Aucun encaissement</td></tr>'}</tbody></table>
            <div class="print-sign">
                <div><span class="line">Le caissier</span></div>
                <div><span class="line">Le Directeur</span></div>
            </div>
        `;
        await Print.open('Journal de caisse', body);
    },

    cleanup() {}
};

window.paiementsModule = paiementsModule;
