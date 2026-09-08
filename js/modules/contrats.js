const contratsModule = {
    _editId: null,

    TYPE_LABELS: { Employe: 'Employe', Prestataire: 'Prestataire', Partenaire: 'Partenaire', Stage: 'Stage', Autre: 'Autre' },
    TYPE_COLORS: { Employe: 'info', Prestataire: 'purple', Partenaire: 'blue', Stage: 'gray', Autre: 'gray' },
    STATUT_COLORS: { Actif: 'success', EnAttente: 'warning', Suspendu: 'orange', Termine: 'gray', Annule: 'danger' },
    PERIODICITES: ['Mensuelle', 'Trimestrielle', 'Annuelle', 'Ponctuelle'],
    CLAUSES_CONTRAT: [
        { key: 'obligationsPrestataire', titre: 'Obligations du prestataire / cocontractant' },
        { key: 'obligationsHopital', titre: "Obligations de l'hopital" },
        { key: 'modalitesPaiement', titre: 'Modalites de paiement' },
        { key: 'clauseConfidentialite', titre: 'Clause de confidentialite' },
        { key: 'clauseProprieteIntellectuelle', titre: 'Propriete intellectuelle' },
        { key: 'clauseResponsabilite', titre: 'Responsabilite et assurance' },
        { key: 'clauseResiliation', titre: 'Suspension et resiliation du contrat' },
        { key: 'clauseLitiges', titre: 'Litiges et droit applicable' },
        { key: 'clausesDiverses', titre: 'Autres clauses et dispositions finales' }
    ],

    async show() {
        UI.setPageTitle('Contrats');
        const container = document.getElementById('content-area');
        container.innerHTML = `<div id="contrats-content"></div>`;
        await this.render();
    },

    async render() {
        const c = document.getElementById('contrats-content');
        const [contrats, personnel] = await Promise.all([DB.getAll('contrats'), DB.getAll('personnel')]);
        const getPersonnel = (id) => personnel.find(p => p.id === id) || null;
        const nomContrat = (ct) => {
            const p = getPersonnel(ct.personnelId);
            if (ct.personnelId && p) return `${p.prenom} ${p.nom}`;
            if (ct.nomExterne) return ct.nomExterne;
            return ct.titre || '-';
        };

        const fType = (c && c._filtreType) || this._filtreType || '';
        const fStatut = (c && c._filtreStatut) || this._filtreStatut || '';
        const fRecherche = ((c && c._recherche) || this._recherche || '').toLowerCase();
        const list = contrats.filter(ct =>
            (!fType || ct.typeContrat === fType) &&
            (!fStatut || ct.statut === fStatut) &&
            (!fRecherche || (ct.titre || '').toLowerCase().includes(fRecherche) || nomContrat(ct).toLowerCase().includes(fRecherche))
        ).sort((a, b) => (a.statut === 'Actif' ? 0 : 1) - (b.statut === 'Actif' ? 0 : 1) || String(a.dateDebut).localeCompare(String(b.dateDebut)));

        const actifs = contrats.filter(ct => ct.statut === 'Actif');
        const montantActifs = actifs.reduce((s, ct) => s + Number(ct.montant || 0), 0);
        const aujourdHui = new Date();
        const echeances = contrats.filter(ct => ct.statut === 'Actif' && ct.dateFin && new Date(ct.dateFin + 'T00:00:00') <= new Date(aujourdHui.getTime() + 30 * 86400000));
        const joursRestants = (ct) => {
            if (!ct.dateFin) return -1;
            const fin = new Date(ct.dateFin + 'T00:00:00');
            return Math.max(0, Math.ceil((fin - aujourdHui) / 86400000));
        };
        const badge = (label, statut) => UI.renderBadge(label, this.STATUT_COLORS[statut] || 'gray');
        const fmtDate = (d) => d ? UI.formatDate(d) : 'Indeterminee';

        c.innerHTML = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9776;', contrats.length, 'Contrats enregistres', 'blue')}
                ${UI.renderStatCard('&#10003;', actifs.length, 'Contrats actifs', 'green')}
                ${UI.renderStatCard('&#9830;', UI.formatMoney(montantActifs), 'Montant contrats actifs', 'purple')}
                ${UI.renderStatCard('&#9888;', echeances.length, 'Echeance < 30 jours', 'orange')}
            </div>

            <div class="toolbar" style="margin-bottom:16px">
                <div class="toolbar-left" style="display:flex;gap:10px;flex-wrap:wrap;flex:1">
                    <select id="contrats-filtre-type" onchange="contratsModule.setFiltreType(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                        <option value="">Tous types</option>
                        ${Object.entries(this.TYPE_LABELS).map(([k, v]) => `<option value="${k}" ${fType === k ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                    <select id="contrats-filtre-statut" onchange="contratsModule.setFiltreStatut(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px">
                        <option value="">Tous statuts</option>
                        ${Object.keys(this.STATUT_COLORS).map(k => `<option value="${k}" ${fStatut === k ? 'selected' : ''}>${k}</option>`).join('')}
                    </select>
                    <input type="text" id="contrats-recherche" placeholder="Recherche (titre, personne)" value="${c._recherche || ''}" oninput="contratsModule.setRecherche(this.value)" style="padding:6px;border:1px solid var(--border);border-radius:6px;flex:1;min-width:180px">
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-outline" onclick="contratsModule.printListe()">Imprimer la liste</button>
                    ${Auth.can('contrats', 3) ? `<button class="btn btn-primary" onclick="contratsModule.showForm()">+ Nouveau Contrat</button>` : ''}
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>Contrats (${list.length})</h3></div>
                ${list.length === 0 ? '<div class="empty-state"><p>Aucun contrat</p></div>' : `
                <table class="permissions-tbl" style="width:100%">
                    <thead><tr><th>Contrat</th><th>Contractant</th><th>Type</th><th>Periode</th><th style="text-align:right">Montant</th><th>Statut</th>${Auth.can('contrats', 3) ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody>
                        ${list.map(ct => {
                            const p = getPersonnel(ct.personnelId);
                            const ech = ct.dateFin ? joursRestants(ct) : -1;
                            const statut = ct.statut === 'Actif' && ech === 0 ? 'Expire' : ct.statut;
                            return `<tr>
                                <td><strong>${ct.titre || '-'}</strong></td>
                                <td>${nomContrat(ct)}${ct.contactExterne ? `<br><small style="color:var(--text-secondary)">${ct.contactExterne}</small>` : ''}</td>
                                <td>${UI.renderBadge(this.TYPE_LABELS[ct.typeContrat] || ct.typeContrat, this.TYPE_COLORS[ct.typeContrat] || 'gray')}</td>
                                <td>${fmtDate(ct.dateDebut)}<br><small style="color:var(--text-secondary)">-> ${ct.dateFin ? fmtDate(ct.dateFin) : 'Indeterminee'}</small></td>
                                <td style="text-align:right">${ct.montant ? UI.formatMoney(ct.montant) : '-'}</td>
                                <td>${badge(statut, ct.statut)}${ech >= 0 && ct.statut === 'Actif' ? `<br><small style="color:${ech < 30 ? '#c5221f' : 'var(--text-secondary)'}">${ech} j restants</small>` : ''}</td>
                                ${Auth.can('contrats', 3) ? `<td>
                                    <button class="btn btn-sm btn-outline" onclick="contratsModule.printFiche('${ct.id}')">Fiche</button>
                                    <button class="btn btn-sm btn-outline" onclick="contratsModule.showForm('${ct.id}')">Modifier</button>
                                    ${ct.statut === 'Actif' ? `<button class="btn btn-sm btn-outline" onclick="contratsModule.showProlongerForm('${ct.id}')">Prolonger</button><button class="btn btn-sm btn-warning" onclick="contratsModule.suspendre('${ct.id}')">Suspendre</button>` : ''}
                                    ${ct.statut === 'Actif' || ct.statut === 'Suspendu' ? `<button class="btn btn-sm btn-danger" onclick="contratsModule.resilier('${ct.id}')">Resilier</button>` : ''}
                                </td>` : ''}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>`}
            </div>
        `;
    },

    setFiltreType(val) { this._filtreType = val; const c = document.getElementById('contrats-content'); if (c) c._filtreType = val; this.render(); },
    setFiltreStatut(val) { this._filtreStatut = val; const c = document.getElementById('contrats-content'); if (c) c._filtreStatut = val; this.render(); },
    setRecherche(val) { this._recherche = val; const c = document.getElementById('contrats-content'); if (c) c._recherche = val; this.render(); },

    async showForm(contratId) {
        this._editId = contratId || null;
        const personnel = await DB.getAll('personnel');
        const ct = this._editId ? await DB.get('contrats', this._editId) : null;

        const formHtml = UI.buildForm([
            { name: 'titre', label: 'Titre du contrat', required: true, default: ct ? ct.titre : '', placeholder: 'Ex: Contrat de travail / Convention de partenariat' },
            { name: 'typeContrat', label: 'Type de contrat', type: 'select', required: true, options: Object.entries(this.TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })), default: ct ? ct.typeContrat : 'Employe' },
            { name: 'personnelId', label: 'Personnel concerne (facultatif)', type: 'select', options: [{ value: '', label: 'Aucun personnel' }].concat(personnel.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom} (${p.type})` }))), default: ct && ct.personnelId ? ct.personnelId : '' },
            { name: 'nomExterne', label: 'Nom externe / partenaire (si sans personnel)', default: ct ? ct.nomExterne : '', placeholder: 'Ex: Fondation X, Entreprise Y' },
            { name: 'contactExterne', label: 'Contact externe', default: ct ? ct.contactExterne : '', placeholder: 'Telephone ou email' },
            { name: 'dateDebut', label: 'Date de debut', type: 'date', required: true, default: ct ? ct.dateDebut : new Date().toISOString().slice(0, 10) },
            { name: 'dateFin', label: 'Date de fin (vide = CDI / indeterminee)', type: 'date', default: ct ? (ct.dateFin || '') : '' },
            { name: 'montant', label: 'Montant (prestation / partenariat)', type: 'number', default: ct ? String(ct.montant || 0) : '0' },
            { name: 'periodicite', label: 'Periodicite', type: 'select', options: this.PERIODICITES.map(p => ({ value: p, label: p })), default: ct ? ct.periodicite : 'Mensuelle' },
            { name: 'statut', label: 'Statut', type: 'select', required: true, options: Object.keys(this.STATUT_COLORS).map(k => ({ value: k, label: k })), default: ct ? ct.statut : 'Actif' },
            { name: 'signataire1', label: 'Signataire (hopital)', default: ct ? ct.signataire1 : 'Direction' },
            { name: 'signataire2', label: 'Signataire (contractant)', default: ct ? ct.signataire2 : '' },
            { name: 'dateSignature', label: 'Date de signature', type: 'date', default: ct ? (ct.dateSignature || '') : '' },
            { name: 'piecesJointes', label: 'Pieces jointes (references)', default: ct ? ct.piecesJointes : '', placeholder: 'Ex: CCB, convention.pdf, decret' },
            { name: 'description', label: 'Objet / conditions', type: 'textarea', default: ct ? ct.description : '', placeholder: 'Description de la prestation, obligations, conditions...' },
            { name: 'notes', label: 'Notes libres', type: 'textarea', default: ct ? ct.notes : '' },
            { type: 'section', label: 'Clauses contractuelles' }
        ].concat(this.CLAUSES_CONTRAT.map(c => ({
            name: c.key, label: c.titre, type: 'textarea', full: true,
            default: ct ? (ct[c.key] || '') : '', placeholder: "Redigez le contenu de cette clause..."
        }))));
        UI.showModal(this._editId ? 'Modifier le contrat' : 'Nouveau Contrat', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="contratsModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const data = UI.getFormData(document.querySelector('.modal-body'));
        if (!data.titre || !data.typeContrat || !data.dateDebut) {
            UI.toast('Titre, type et date de debut requis', 'error'); return;
        }
        if (data.dateFin && data.dateFin < data.dateDebut) {
            UI.toast('La date de fin ne peut pas preceder la date de debut', 'error'); return;
        }
        const ct = this._editId ? await DB.get('contrats', this._editId) : { id: DB.generateId(), dateCreation: new Date().toISOString(), creePar: Auth.currentUser ? Auth.currentUser.id : 'u1' };
        Object.assign(ct, {
            titre: data.titre,
            typeContrat: data.typeContrat,
            personnelId: data.personnelId || null,
            nomExterne: data.nomExterne || '',
            contactExterne: data.contactExterne || '',
            dateDebut: data.dateDebut,
            dateFin: data.dateFin || null,
            montant: Number(data.montant || 0),
            periodicite: data.periodicite,
            statut: data.statut,
            signataire1: data.signataire1 || '',
            signataire2: data.signataire2 || '',
            dateSignature: data.dateSignature || null,
            piecesJointes: data.piecesJointes || '',
            description: data.description || '',
            notes: data.notes || ''
        });
        await DB.put('contrats', ct);
        UI.toast('Contrat enregistre', 'success');
        await Auth.log(this._editId ? 'Modification' : 'Creation', 'contrats', `${ct.titre} (${ct.typeContrat})`);
        this._editId = null;
        UI.hideModal();
        this.render();
    },

    async delete(contratId) {
        const ok = await UI.confirm('Supprimer ce contrat ?');
        if (!ok) return;
        const ct = await DB.get('contrats', contratId);
        await DB.delete('contrats', contratId);
        UI.toast('Contrat supprime', 'success');
        await Auth.log('Suppression', 'contrats', ct ? ct.titre : contratId);
        this.render();
    },

    async showProlongerForm(contratId) {
        const ct = await DB.get('contrats', contratId);
        UI.showModal('Prolonger le contrat', `
            <p><strong>${ct.titre}</strong></p>
            <p>Date de fin actuelle : <strong>${ct.dateFin ? UI.formatDate(ct.dateFin) : 'Indeterminee'}</strong></p>
            <div class="form-group"><label>Duree supplementaire (mois) *</label><input type="number" id="contrat-prolong-mois" min="1" value="12"></div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="contratsModule.prolonger('${contratId}')">Prolonger</button>
        `);
    },

    async prolonger(contratId) {
        const mois = Number(document.getElementById('contrat-prolong-mois').value);
        if (!mois || mois <= 0) { UI.toast('Duree invalide', 'error'); return; }
        const ct = await DB.get('contrats', contratId);
        const base = ct.dateFin ? new Date(ct.dateFin + 'T00:00:00') : new Date();
        base.setMonth(base.getMonth() + mois);
        ct.dateFin = base.toISOString().slice(0, 10);
        ct.statut = 'Actif';
        await DB.put('contrats', ct);
        UI.toast('Contrat prolonge', 'success');
        await Auth.log('Prolongation', 'contrats', `${ct.titre} -> ${ct.dateFin}`);
        UI.hideModal();
        this.render();
    },

    async suspendre(contratId) {
        const ct = await DB.get('contrats', contratId);
        UI.showModal('Suspendre le contrat', `
            <p>Suspendre le contrat <strong>${ct.titre}</strong> ?</p>
            <div class="form-group"><label>Motif de la suspension</label><textarea id="contrat-motif">Suspension temporaire</textarea></div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-warning" onclick="contratsModule.doStatut('${contratId}', 'Suspendu')">Suspendre</button>
        `);
    },

    async resilier(contratId) {
        const ct = await DB.get('contrats', contratId);
        UI.showModal('Resilier le contrat', `
            <p>Resilier le contrat <strong>${ct.titre}</strong> ?</p>
            <div class="form-group"><label>Motif de la resilitation</label><textarea id="contrat-motif">Resiliation</textarea></div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-danger" onclick="contratsModule.doStatut('${contratId}', 'Annule')">Resilier</button>
        `);
    },

    async doStatut(contratId, statut) {
        const ct = await DB.get('contrats', contratId);
        const motif = (document.getElementById('contrat-motif') || { value: '' }).value;
        ct.statut = statut;
        ct.notes = (ct.notes ? ct.notes + '\n' : '') + `${statut === 'Suspendu' ? 'Suspension' : 'Resiliation'} le ${new Date().toISOString().slice(0, 10)} : ${motif}`;
        await DB.put('contrats', ct);
        UI.toast('Contrat ' + statut.toLowerCase(), 'success');
        await Auth.log(statut, 'contrats', `${ct.titre} (${motif})`);
        UI.hideModal();
        this.render();
    },

    async printFiche(contratId) {
        const ct = await DB.get('contrats', contratId);
        if (!ct) return;
        const personnel = await DB.getAll('personnel');
        const p = ct.personnelId ? personnel.find(x => x.id === ct.personnelId) : null;

        const clausesHtml = this.CLAUSES_CONTRAT.map((c, i) => {
            const texte = ct[c.key];
            if (!texte) return '';
            return '<h5 style="margin:10px 0 2px">Article ' + (i + 1) + ' - ' + c.titre + '</h5><p>' + texte.replace(/\n/g, '<br>') + '</p>';
        }).join('') || '<p>Aucune clause redigee.</p>';

        const body = `
            <div class="print-title">FICHE DE CONTRAT</div>
            <table>
                <tbody>
                    <tr><th>Titre</th><td colspan="3">${ct.titre || '-'}</td></tr>
                    <tr><th>Type</th><td>${this.TYPE_LABELS[ct.typeContrat] || ct.typeContrat}</td><th>Statut</th><td>${ct.statut}</td></tr>
                    <tr><th>Contractant</th><td colspan="3">${p ? p.prenom + ' ' + p.nom + ' (' + p.matricule + ')' : (ct.nomExterne || '-')}${ct.contactExterne ? ' - ' + ct.contactExterne : ''}</td></tr>
                    <tr><th>Date debut</th><td>${UI.formatDate(ct.dateDebut)}</td><th>Date fin</th><td>${ct.dateFin ? UI.formatDate(ct.dateFin) : 'Indeterminee'}</td></tr>
                    <tr><th>Montant</th><td>${ct.montant ? UI.formatMoney(ct.montant) : '-'}</td><th>Periodicite</th><td>${ct.periodicite || '-'}</td></tr>
                    <tr><th>Signataires</th><td colspan="3">${ct.signataire1 || '-'} / ${ct.signataire2 || '-'}${ct.dateSignature ? ' - signe le ' + UI.formatDate(ct.dateSignature) : ''}</td></tr>
                    ${ct.piecesJointes ? `<tr><th>Pieces jointes</th><td colspan="3">${ct.piecesJointes}</td></tr>` : ''}
                </tbody>
            </table>
            ${ct.description ? `<h4 style="margin:14px 0 4px">Objet / conditions</h4><p>${ct.description}</p>` : ''}
            ${ct.notes ? `<h4 style="margin:14px 0 4px">Notes</h4><p>${ct.notes.replace(/\n/g, '<br>')}</p>` : ''}
            <h4 style="margin:18px 0 6px">CLAUSES DU CONTRAT</h4>
            ${clausesHtml}
            <p style="margin-top:10px">Fait en deux (2) exemplaires originaux, un (1) pour chaque partie.</p>
            <div class="print-sign">
                <div><span class="line">${ct.signataire1 || 'Direction'}</span></div>
                <div><span class="line">${ct.signataire2 || 'Contractant'}</span></div>
            </div>
        `;
        await Print.open('Fiche de contrat - ' + (ct.titre || ''), body);
    },

    async printListe() {
        const c = document.getElementById('contrats-content');
        const contrats = await DB.getAll('contrats');
        const fType = (c && c._filtreType) || this._filtreType || '';
        const fStatut = (c && c._filtreStatut) || this._filtreStatut || '';
        const personnel = await DB.getAll('personnel');
        const getPersonnel = (id) => personnel.find(p => p.id === id) || null;
        const nomContrat = (ct) => {
            const p = getPersonnel(ct.personnelId);
            if (ct.personnelId && p) return `${p.prenom} ${p.nom}`;
            if (ct.nomExterne) return ct.nomExterne;
            return ct.titre || '-';
        };
        const list = contrats.filter(ct =>
            (!fType || ct.typeContrat === fType) &&
            (!fStatut || ct.statut === fStatut)
        ).sort((a, b) => String(a.dateDebut).localeCompare(String(b.dateDebut)));

        const rows = list.map(ct => `<tr>
            <td>${ct.titre || '-'}</td>
            <td>${nomContrat(ct)}</td>
            <td>${this.TYPE_LABELS[ct.typeContrat] || ct.typeContrat}</td>
            <td>${ct.dateDebut ? UI.formatDate(ct.dateDebut) : '-'} -> ${ct.dateFin ? UI.formatDate(ct.dateFin) : 'Indeterminee'}</td>
            <td style="text-align:right">${ct.montant ? UI.formatMoney(ct.montant) : '-'}</td>
            <td>${ct.statut}</td>
        </tr>`).join('');

        const totalActifs = list.filter(ct => ct.statut === 'Actif').reduce((s, ct) => s + Number(ct.montant || 0), 0);

        const body = `
            <div class="print-title">LISTE DES CONTRATS</div>
            <table>
                <thead><tr><th>Contrat</th><th>Contractant</th><th>Type</th><th>Periode</th><th style="text-align:right">Montant</th><th>Statut</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6">Aucun contrat</td></tr>'}</tbody>
                <tfoot><tr><th colspan="4" style="text-align:right">Total contrats actifs</th><th class="print-total" style="text-align:right">${UI.formatMoney(totalActifs)}</th><td></td></tr></tfoot>
            </table>
            <div class="print-sign">
                <div><span class="line">Le Directeur</span></div>
                <div><span class="line">La comptabilite</span></div>
            </div>
        `;
        await Print.open('Liste des contrats', body);
    },

    cleanup() {}
};

window.contratsModule = contratsModule;