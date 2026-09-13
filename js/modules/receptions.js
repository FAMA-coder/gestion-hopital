// ============================================================
// js/modules/receptions.js — Réceptions (fusion Patients + Consultations)
// ------------------------------------------------------------
// Un seul point d'entrée pour l'accueil des patients :
//   - enregistrer un patient (fiche complete),
//   - le consulter en direct (consultation),
//   - l'orienter vers les services dont il a besoin,
//   - le transferer vers un autre etablissement (mode cloud).
// Chaque etablissement reste isole : seul le transfert volontaire
// ecrit (une copie patient) dans l'etablissement de destination.
// ============================================================
const receptionsModule = {
    currentPage: 1,
    perPage: 15,
    search: '',

    ORIENTATION_TYPES: [
        { value: 'Consultation', label: 'Consultation' },
        { value: 'Hospitalisation', label: 'Hospitalisation' },
        { value: 'Urgence', label: 'Urgence' },
        { value: 'Laboratoire', label: 'Laboratoire' },
        { value: 'Imagerie', label: 'Imagerie' },
        { value: 'Maternite', label: 'Maternite' },
        { value: 'Autre', label: 'Autre' }
    ],

    isCloud() {
        return !!(window.DB && DB.mode() === 'cloud' && window.RemoteDB && RemoteDB.impl);
    },

    async show() {
        UI.setPageTitle('Receptions');
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('content-area');
        let patients = await DB.getAll('patients');
        const admissions = await DB.getAll('admissions');
        const transferts = await DB.getAll('transferts');

        if (this.search) {
            const s = this.search.toLowerCase();
            patients = patients.filter(p =>
                (p.nom + ' ' + p.prenom).toLowerCase().includes(s) ||
                (p.matricule || '').toLowerCase().includes(s) ||
                (p.telephone || '').includes(s)
            );
        }

        patients.sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''));
        const total = patients.length;
        const start = (this.currentPage - 1) * this.perPage;
        const paged = patients.slice(start, start + this.perPage);

        // Statistiques du jour
        const today = new Date().toISOString().slice(0, 10);
        const aujourdHui = patients.filter(p => (p.dateCreation || '').slice(0, 10) === today).length;
        const recus = (transferts || []).filter(t => t.statut === 'Recu');
        const enAttente = admissions.filter(a => a.statut === 'EnCours' && (a.dateAdmission || '').slice(0, 10) === today).length;

        // Derniers transferts reçus (patients arrives d'un autre etablissement)
        const recusEnrichis = recus
            .sort((a, b) => (b.dateTransfert || '').localeCompare(a.dateTransfert || ''))
            .slice(0, 8)
            .map(t => {
                const pat = patients.find(p => p.id === t.patientId);
                return { ...t, patientNom: pat ? pat.prenom + ' ' + pat.nom : (t.patientNom || t.patientId) };
            });

        const canEdit = Auth.can('receptions', 3);

        let html = `
            <div class="stats-row">
                ${UI.renderStatCard('&#9733;', patients.length, 'Patients enregistres', 'blue')}
                ${UI.renderStatCard('&#10004;', aujourdHui, 'Recus aujourd\'hui', 'green')}
                ${UI.renderStatCard('&#10148;', enAttente, 'Orientations du jour', 'orange')}
                ${UI.renderStatCard('&#8647;', recus.length, 'Transferts recus', 'purple')}
            </div>
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <input type="text" id="search-reception" placeholder="Rechercher (nom, matricule, tel)..." value="${this.search}">
                        <button class="btn-icon" onclick="receptionsModule.doSearch()">&#128269;</button>
                    </div>
                </div>
                <div class="toolbar-right">
                    ${canEdit ? '<button class="btn btn-primary" onclick="receptionsModule.showForm()">+ Nouveau Patient</button>' : ''}
                </div>
            </div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'matricule', label: 'Matricule', render: (v) => `<strong>${v || '-'}</strong>` },
                    { label: 'Nom Complet', render: (v, row) => `${row.prenom} ${row.nom}` },
                    { field: 'sexe', label: 'Sexe', render: (v) => v === 'M' ? 'Masculin' : 'Feminin' },
                    { field: 'dateNaissance', label: 'Date Naiss.', render: (v) => UI.formatDate(v) },
                    { field: 'telephone', label: 'Telephone', render: (v) => v || '-' },
                    { label: 'Provenance', render: (v, row) => {
                        if (row.transfert && row.transfert.provenanceTenant) {
                            return UI.renderBadge('Transfere: ' + (row.transfert.provenanceNom || ''), 'purple');
                        }
                        if (row.transfertSortant) {
                            return UI.renderBadge('→ ' + (row.transfertSortant.nom || ''), 'warning');
                        }
                        return UI.renderBadge('Interne', 'info');
                    }},
                    { field: 'groupeSanguin', label: 'Groupe', render: (v) => UI.renderBadge(v || '-', 'info') },
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-outline" onclick="receptionsModule.voir('${row.id}')">Voir</button>
                        <button class="btn btn-sm btn-outline" onclick="receptionsModule.consulter('${row.id}')">&#9998; Consulter</button>
                        <button class="btn btn-sm btn-outline" onclick="receptionsModule.orienter('${row.id}')">&#10148; Orienter</button>
                        ${this.isCloud() ? `<button class="btn btn-sm btn-outline" onclick="receptionsModule.transferer('${row.id}')" title="Transferer vers un autre etablissement">&#8646; Transferer</button>` : ''}
                        <button class="btn btn-sm btn-outline" onclick="receptionsModule.printFiche('${row.id}')">Imprimer</button>
                        ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="receptionsModule.showForm('${row.id}')">Editer</button>` : ''}
                        ${canEdit ? `<button class="btn btn-sm btn-danger" onclick="receptionsModule.remove('${row.id}')">Suppr.</button>` : ''}
                    ` }
                ], paged, { actions: false, emptyTitle: 'Aucun patient', emptyText: 'Commencez par enregistrer un patient a la reception.' })}
            </div>
            ${UI.renderPagination(total, this.currentPage, this.perPage)}
            ${recusEnrichis.length > 0 ? `
            <hr style="margin:16px 0;border-color:var(--border-light)">
            <h4>&#8647; Transferts reçus d&#39;autres etablissements (${recusEnrichis.length})</h4>
            <div class="card">
                ${UI.renderTable([
                    { label: 'Patient', render: (v, row) => `<strong>${row.patientNom}</strong>` },
                    { label: 'Provient de', render: (v, row) => row.provenanceNom || row.provenantTenant || '-' },
                    { field: 'dateTransfert', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'motif', label: 'Motif', render: (v) => v || '-' },
                    { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v || 'Recu', 'info') }
                ], recusEnrichis, { actions: false } )}
            </div>` : ''}
        `;

        container.innerHTML = html;

        const searchEl = document.getElementById('search-reception');
        searchEl.addEventListener('keyup', (e) => { if (e.key === 'Enter') this.doSearch(); });

        container.querySelectorAll('.pagination button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderList();
            });
        });
    },

    doSearch() {
        this.search = document.getElementById('search-reception').value;
        this.currentPage = 1;
        this.renderList();
    },

    // ------------------------------------------------------------
    // Fiche patient (creation / modification) + orientation facultative
    // ------------------------------------------------------------
    async showForm(id = null, orientation = null) {
        let patient = {};
        if (id) patient = await DB.get('patients', id);

        const services = (await Meta.getServices()).filter(s => s.actif);
        const serviceOptions = services.map(s => ({ value: s.id, label: s.nom }));

        const fields = [
            { name: 'nom', label: 'Nom', required: true, placeholder: 'Nom de famille' },
            { name: 'prenom', label: 'Prenom', required: true, placeholder: 'Prenom' },
            { name: 'sexe', label: 'Sexe', type: 'select', required: true, options: [
                { value: 'M', label: 'Masculin' }, { value: 'F', label: 'Feminin' }
            ]},
            { name: 'dateNaissance', label: 'Date de naissance', type: 'date', required: true },
            { name: 'telephone', label: 'Telephone', type: 'tel', placeholder: '+243...' },
            { name: 'adresse', label: 'Adresse', placeholder: 'Adresse complete' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'groupeSanguin', label: 'Groupe sanguin', type: 'select', options: [
                { value: '', label: 'Inconnu' },
                { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
                { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
                { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' }
            ]},
            { name: 'allergie', label: 'Allergies connues', type: 'textarea', placeholder: 'Separer par des virgules', half: false },
            { name: 'antecedents', label: 'Antecedents medicaux', type: 'textarea', placeholder: 'Separer par des virgules', half: false }
        ];

        // Orientation vers un service (uniquement pour un nouveau patient)
        if (!id) {
            fields.push(
                { type: 'section', label: 'Orientation aux services (facultatif)' },
                { name: '_orienter', label: 'Orienter ce patient vers un service', type: 'select', options: [
                    { value: '', label: 'Pas d\'orientation' }
                ].concat(serviceOptions) },
                { name: '_typeOrientation', label: 'Type d\'orientation', type: 'select', options: this.ORIENTATION_TYPES },
                { name: '_motifOrientation', label: 'Motif', type: 'textarea', placeholder: 'Motif de l\'orientation' }
            );
        }

        const values = Object.assign({}, patient, orientation || {});
        const formHtml = UI.buildForm(fields, values);

        UI.showModal(id ? 'Modifier Patient' : 'Nouveau Patient & Orientation', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="receptionsModule.save('${id || ''}')">Enregistrer</button>
        `);
    },

    async save(id) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);

        if (!data.nom || !data.prenom) {
            UI.toast('Nom et prenom sont requis', 'error');
            return;
        }
        if (data.allergie && typeof data.allergie === 'string') {
            data.allergie = data.allergie.split(',').map(a => a.trim()).filter(Boolean);
        }
        if (data.antecedents && typeof data.antecedents === 'string') {
            data.antecedents = data.antecedents.split(',').map(a => a.trim()).filter(Boolean);
        }

        const orienter = data._orienter;
        const orientation = { serviceId: data._orienter, type: data._typeOrientation || 'Consultation', motif: data._motifOrientation || '' };
        delete data._orienter; delete data._typeOrientation; delete data._motifOrientation;

        if (id) {
            const existing = await DB.get('patients', id);
            Object.assign(existing, data);
            await DB.put('patients', existing);
            UI.toast('Patient modifie avec succes', 'success');
            await Auth.log('Modification', 'receptions', `Patient ${id}`);
        } else {
            data.id = DB.generateId();
            data.matricule = 'PAT' + String(Date.now()).slice(-4);
            data.dateCreation = new Date().toISOString();
            data.origineReception = true;
            await DB.put('patients', data);
            UI.toast('Patient enregistre avec succes', 'success');
            await Auth.log('Creation', 'receptions', `Patient ${data.matricule}`);

            if (orienter) {
                await this.createOrientation(data, orientation);
            }
        }

        Cache.invalidate('patients');
        UI.hideModal();
        this.renderList();
    },

    // ------------------------------------------------------------
    // Orientation vers un service (cree une admission "en cours")
    // ------------------------------------------------------------
    async createOrientation(patient, orientation) {
        const o = orientation || {};
        const admission = {
            id: DB.generateId(),
            patientId: patient.id,
            type: o.type || 'Consultation',
            serviceId: o.serviceId,
            medecinId: o.medecinId || null,
            motif: o.motif || '',
            dateAdmission: new Date().toISOString(),
            statut: 'EnCours',
            origine: 'reception'
        };
        await DB.put('admissions', admission);

        if (admission.serviceId) {
            try {
                const litsDispo = await Meta.getLitsDisponibles(admission.serviceId);
                if (litsDispo.length > 0) {
                    admission.litId = litsDispo[0].id;
                    await DB.put('lits', { ...litsDispo[0], statut: 'Occupe' });
                    await DB.put('admissions', admission);
                }
            } catch (e) { /* lit optionnel */ }
        }
        await Auth.log('Orientation', 'receptions', patient.matricule + ' -> ' + admission.serviceId);
        return admission;
    },

    // Ecran d'orientation pour un patient deja enregistre
    async orienter(patientId) {
        const patient = await DB.get('patients', patientId);
        if (!patient) { UI.toast('Patient introuvable', 'error'); return; }
        const services = (await Meta.getServices()).filter(s => s.actif);

        const formHtml = UI.buildForm([
            { name: 'serviceId', label: 'Service de destination', type: 'select', required: true, options: services.map(s => ({ value: s.id, label: s.nom })) },
            { name: 'type', label: 'Type', type: 'select', options: this.ORIENTATION_TYPES },
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de l\'orientation' }
        ]);

        UI.showModal(`Orienter: ${patient.prenom} ${patient.nom}`, formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="receptionsModule.saveOrientation('${patientId}')">Orienter</button>
        `);
    },

    async saveOrientation(patientId) {
        const patient = await DB.get('patients', patientId);
        if (!patient) return;
        const data = UI.getFormData(document.querySelector('.modal-body'));
        if (!data.serviceId || !data.motif) {
            UI.toast('Service et motif sont requis', 'error');
            return;
        }
        await this.createOrientation(patient, data);
        UI.toast('Patient oriente vers le service', 'success');
        UI.hideModal();
        this.renderList();
    },

    // ------------------------------------------------------------
    // Consultation directe a la reception
    // ------------------------------------------------------------
    async consulter(patientId) {
        const patient = await DB.get('patients', patientId);
        if (!patient) { UI.toast('Patient introuvable', 'error'); return; }
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'medecinId', label: 'Medecin', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Normale', label: 'Normale' }, { value: 'Controle', label: 'Controle' }, { value: 'Urgence', label: 'Urgence' }] },
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de la consultation' },
            { name: 'symptomes', label: 'Symptomes', type: 'textarea', placeholder: 'Symptomes decrits par le patient' },
            { name: 'diagnostic', label: 'Diagnostic', type: 'textarea', placeholder: 'Diagnostic du medecin' },
            { name: 'prescription', label: 'Prescription', type: 'textarea', placeholder: 'Prescription medicale' },
            { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Notes complementaires' }
        ]);

        UI.showModal(`Consultation - ${patient.prenom} ${patient.nom} (${patient.matricule})`, formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="receptionsModule.saveConsultation('${patientId}')">Enregistrer</button>
        `);
    },

    async saveConsultation(patientId) {
        const data = UI.getFormData(document.querySelector('.modal-body'));
        if (!data.medecinId || !data.motif) {
            UI.toast('Medecin et motif sont requis', 'error');
            return;
        }

        data.id = DB.generateId();
        data.patientId = patientId;
        data.dateConsultation = new Date().toISOString();
        await DB.put('consultations', data);

        const medecins = await Meta.getMedecins();
        const med = medecins.find(m => m.id === data.medecinId);
        const montant = await Billing.montantConsultation(med);
        if (montant > 0) {
            await Billing.addLigne(data.patientId, {
                description: 'Consultation' + (med ? ' - ' + med.label : ''),
                montant,
                source: 'consultations',
                sourceId: data.id
            });
        }

        UI.toast('Consultation enregistree', 'success');
        await Auth.log('Creation', 'receptions', `Consultation ${data.id}`);
        UI.hideModal();
        this.renderList();
        if (window.consultationsModule && consultationsModule.showTicketAction) {
            consultationsModule.showTicketAction(data.id);
        }
    },

    // ------------------------------------------------------------
    // Transfert vers un autre etablissement (mode cloud uniquement)
    // ------------------------------------------------------------
    async transferer(patientId) {
        if (!this.isCloud()) {
            UI.toast('Le transfert inter-etablissements exige le mode cloud (connexion Internet).', 'error');
            return;
        }
        const patient = await DB.get('patients', patientId);
        if (!patient) { UI.toast('Patient introuvable', 'error'); return; }

        const etabs = (await Tenant.list()).filter(e => e.id !== Tenant.get());
        if (etabs.length === 0) {
            UI.toast('Aucun autre etablissement dans le registre central.', 'error');
            return;
        }

        const formHtml = UI.buildForm([
            { name: 'etablissementId', label: 'Etablissement de destination', type: 'select', required: true, options: etabs.map(e => ({ value: e.id, label: e.nom + (e.ville ? ' (' + e.ville + ')' : '') })) },
            { name: 'motif', label: 'Motif du transfert', required: true, placeholder: 'Motif medical ou administratif' },
            { name: 'commentaire', label: 'Commentaire / indication pour l\'etablissement d\'accueil', type: 'textarea', placeholder: 'Antecedents, traitements en cours, documents transmis...' }
        ]);

        const info = patient.transfert && patient.transfert.provenanceTenant
            ? `Ce patient a ete transfert depuis ${patient.transfert.provenanceNom || 'un autre etablissement'}.`
            : '';

        UI.showModal(`Transferer: ${patient.prenom} ${patient.nom}`, (info ? `<p class="form-hint">${info}</p>` : '') + formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="receptionsModule.saveTransfert('${patientId}')">Confirmer le transfert</button>
        `);
    },

    async saveTransfert(patientId) {
        const data = UI.getFormData(document.querySelector('.modal-body'));
        if (!data.etablissementId || !data.motif) {
            UI.toast('Etablissement et motif sont requis', 'error');
            return;
        }

        const sourceTenant = Tenant.get();
        const targetTenant = data.etablissementId;
        if (!sourceTenant) { UI.toast('Etablissement source introuvable', 'error'); return; }
        if (sourceTenant === targetTenant) { UI.toast('La destination doit etre differente de l\'etablissement courant', 'error'); return; }

        const patient = await DB.get('patients', patientId);
        if (!patient) { UI.toast('Patient introuvable', 'error'); return; }
        const targetInfo = await Tenant.getOne(targetTenant);
        const sourceInfo = await Tenant.getOne(sourceTenant);
        const now = new Date().toISOString();

        try {
            // Copie du patient dans l'etablissement de destination,
            // marquee comme transferee (seul lien entre les deux bases).
            const copy = { ...patient };
            copy.transfert = {
                provenanceTenant: sourceTenant,
                provenanceNom: sourceInfo ? sourceInfo.nom : 'Inconnu',
                provenanceMatricule: patient.matricule || '',
                date: now,
                motif: data.motif
            };
            delete copy.transfertSortant;
            await RemoteDB.rawPut('/records/' + encodeURIComponent(targetTenant) + '/patients/' + encodeURIComponent(patient.id) + '.json', copy);

            // Trace cote destination (visible dans les "Transferts recus").
            const targetRecordId = DB.generateId();
            await RemoteDB.rawPut('/records/' + encodeURIComponent(targetTenant) + '/transferts/' + encodeURIComponent(targetRecordId) + '.json', {
                id: targetRecordId,
                patientId: patient.id,
                statut: 'Recu',
                provenanceTenant: sourceTenant,
                provenanceNom: sourceInfo ? sourceInfo.nom : 'Inconnu',
                dateTransfert: now,
                motif: data.motif,
                commentaire: data.commentaire || ''
            });

            // Trace cote source.
            await DB.put('transferts', {
                id: DB.generateId(),
                patientId: patient.id,
                sourceTenant: sourceTenant,
                targetTenant: targetTenant,
                targetNom: targetInfo ? targetInfo.nom : 'Inconnu',
                dateTransfert: now,
                motif: data.motif,
                statut: 'Effectue',
                par: Auth.currentUser ? Auth.currentUser.nomUtilisateur : 'system'
            });

            // Marque le patient comme transfere (historique local conserve).
            patient.transfertSortant = { tenant: targetTenant, nom: targetInfo ? targetInfo.nom : 'Inconnu', date: now };
            await DB.put('patients', patient);

            UI.toast('Patient transfere vers ' + (targetInfo ? targetInfo.nom : 'la destination'), 'success');
            await Auth.log('Transfert', 'receptions', patient.matricule + ' -> ' + targetTenant);
            UI.hideModal();
            this.renderList();
        } catch (e) {
            console.error('Echec du transfert:', e);
            UI.toast('Echec du transfert: ' + e.message, 'error');
        }
    },

    // ------------------------------------------------------------
    // Reutilisations (fiche + impression + suppression)
    // ------------------------------------------------------------
    async voir(id) {
        if (window.patientsModule) return patientsModule.view(id);
    },

    async printFiche(id) {
        if (window.patientsModule) return patientsModule.printFiche(id);
    },

    async remove(id) {
        const confirmed = await UI.confirm('Supprimer ce patient ? Cette action est irreversible.');
        if (confirmed) {
            await DB.delete('patients', id);
            UI.toast('Patient supprime', 'success');
            await Auth.log('Suppression', 'receptions', `Patient ${id}`);
            this.renderList();
        }
    },

    cleanup() {}
};

window.receptionsModule = receptionsModule;