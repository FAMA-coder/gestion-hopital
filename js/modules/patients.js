const patientsModule = {
    currentPage: 1,
    perPage: 15,
    search: '',

    async show() {
        UI.setPageTitle('Gestion des Patients');
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('content-area');
        let patients = await DB.getAll('patients');

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

        let html = `
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <input type="text" id="search-patient" placeholder="Rechercher (nom, matricule, tel...)..." value="${this.search}">
                        <button class="btn-icon" onclick="patientsModule.doSearch()">&#128269;</button>
                    </div>
                </div>
                <div class="toolbar-right">
                    ${Auth.can('patients', 3) ? '<button class="btn btn-primary" onclick="patientsModule.showForm()">+ Nouveau Patient</button>' : ''}
                </div>
            </div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'matricule', label: 'Matricule', render: (v) => `<strong>${v}</strong>` },
                    { label: 'Nom Complet', render: (v, row) => `${row.prenom} ${row.nom}` },
                    { field: 'sexe', label: 'Sexe', render: (v) => v === 'M' ? 'Masculin' : 'Feminin' },
                    { field: 'dateNaissance', label: 'Date Naiss.', render: (v) => UI.formatDate(v) },
                    { field: 'telephone', label: 'Telephone', render: (v) => v || '-' },
                    { field: 'groupeSanguin', label: 'Groupe Sanguin', render: (v) => UI.renderBadge(v || '-', 'info') },
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-outline" onclick="patientsModule.view('${row.id}')">Voir</button>
                        <button class="btn btn-sm btn-outline" onclick="patientsModule.printFiche('${row.id}')">Imprimer</button>
                        ${Auth.can('patients', 3) ? `<button class="btn btn-sm btn-outline" onclick="patientsModule.showForm('${row.id}')">Editer</button>` : ''}
                        ${Auth.can('patients', 3) ? `<button class="btn btn-sm btn-danger" onclick="patientsModule.remove('${row.id}')">Suppr.</button>` : ''}
                    ` }
                ], paged, { actions: false, emptyTitle: 'Aucun patient', emptyText: 'Commencez par enregistrer un patient.' })}
            </div>
            ${UI.renderPagination(total, this.currentPage, this.perPage)}
        `;

        container.innerHTML = html;

        document.getElementById('search-patient').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.doSearch();
        });

        container.querySelectorAll('.pagination button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderList();
            });
        });
    },

    doSearch() {
        this.search = document.getElementById('search-patient').value;
        this.currentPage = 1;
        this.renderList();
    },

    async showForm(id = null) {
        let patient = {};
        if (id) patient = await DB.get('patients', id);

        const formHtml = UI.buildForm([
            { name: 'nom', label: 'Nom', required: true, placeholder: 'Nom de famille' },
            { name: 'prenom', label: 'Prenom', required: true, placeholder: 'Prenom' },
            { name: 'sexe', label: 'Sexe', type: 'select', required: true, options: [
                { value: 'M', label: 'Masculin' }, { value: 'F', label: 'Feminin' }
            ]},
            { name: 'dateNaissance', label: 'Date de naissance', type: 'date', required: true },
            { name: 'lieuNaissance', label: 'Lieu de naissance', placeholder: 'Ville' },
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
        ], patient);

        UI.showModal(id ? 'Modifier Patient' : 'Nouveau Patient', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="patientsModule.save('${id || ''}')">Enregistrer</button>
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

        if (id) {
            const existing = await DB.get('patients', id);
            Object.assign(existing, data);
            await DB.put('patients', existing);
            UI.toast('Patient modifie avec succes', 'success');
            await Auth.log('Modification', 'patients', `Patient ${id}`);
        } else {
            data.id = DB.generateId();
            data.matricule = 'PAT' + String(Date.now()).slice(-4);
            data.dateCreation = new Date().toISOString();
            await DB.put('patients', data);
            UI.toast('Patient enregistre avec succes', 'success');
            await Auth.log('Creation', 'patients', `Patient ${data.matricule}`);
        }

        Cache.invalidate('patients');
        UI.hideModal();
        this.renderList();
    },

    async view(id) {
        const patient = await DB.get('patients', id);
        if (!patient) { UI.toast('Patient introuvable', 'error'); return; }

        const consultations = await DB.getAll('consultations');
        const patientConsults = consultations.filter(c => c.patientId === id).sort((a, b) => new Date(b.dateConsultation) - new Date(a.dateConsultation));

        const hospitalisations = await DB.getAll('hospitalisations');
        const patientHosps = hospitalisations.filter(h => h.patientId === id).sort((a, b) => new Date(b.dateEntree) - new Date(a.dateEntree));

        const ordonnances = await DB.getAll('ordonnances');
        const patientOrdos = ordonnances.filter(o => o.patientId === id).sort((a, b) => new Date(b.date) - new Date(a.date));

        const html = `
            <div class="grid-2">
                <div>
                    <p><strong>Matricule:</strong> ${patient.matricule}</p>
                    <p><strong>Nom:</strong> ${patient.prenom} ${patient.nom}</p>
                    <p><strong>Sexe:</strong> ${patient.sexe === 'M' ? 'Masculin' : 'Feminin'}</p>
                    <p><strong>Date de naissance:</strong> ${UI.formatDate(patient.dateNaissance)}</p>
                    <p><strong>Lieu:</strong> ${patient.lieuNaissance || '-'}</p>
                </div>
                <div>
                    <p><strong>Telephone:</strong> ${patient.telephone || '-'}</p>
                    <p><strong>Email:</strong> ${patient.email || '-'}</p>
                    <p><strong>Adresse:</strong> ${patient.adresse || '-'}</p>
                    <p><strong>Groupe sanguin:</strong> ${UI.renderBadge(patient.groupeSanguin || 'Inconnu', 'info')}</p>
                    <p><strong>Allergies:</strong> ${(patient.allergie || []).join(', ') || 'Aucune'}</p>
                    <p><strong>Antecedents:</strong> ${(patient.antecedents || []).join(', ') || 'Aucun'}</p>
                </div>
            </div>
            <hr style="margin:16px 0;border-color:var(--border-light)">
            <h4>Consultations recentes (${patientConsults.length})</h4>
            ${patientConsults.length > 0 ? UI.renderTable([
                { field: 'dateConsultation', label: 'Date', render: (v) => UI.formatDateTime(v) },
                { field: 'motif', label: 'Motif', render: (v) => v },
                { field: 'diagnostic', label: 'Diagnostic', render: (v) => v || '-' }
            ], patientConsults.slice(0, 5), { actions: false }) : '<p style="color:var(--text-secondary)">Aucune consultation enregistree.</p>'}
            <hr style="margin:16px 0;border-color:var(--border-light)">
            <h4>Hospitalisations (${patientHosps.length})</h4>
            ${patientHosps.length > 0 ? UI.renderTable([
                { field: 'dateEntree', label: 'Entree', render: (v) => UI.formatDate(v) },
                { field: 'dateSortieReel', label: 'Sortie', render: (v) => UI.formatDate(v) },
                { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v === 'Terminee' ? 'Terminee' : 'En cours', v === 'Terminee' ? 'gray' : 'success') }
            ], patientHosps.slice(0, 5), { actions: false }) : '<p style="color:var(--text-secondary)">Aucune hospitalisation enregistree.</p>'}
            <hr style="margin:16px 0;border-color:var(--border-light)">
            <h4>Ordonnances (${patientOrdos.length})</h4>
            ${patientOrdos.length > 0 ? UI.renderTable([
                { field: 'date', label: 'Date', render: (v) => UI.formatDate(v) },
                { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v, v === 'Dispensee' ? 'success' : v === 'Partielle' ? 'warning' : 'info') }
            ], patientOrdos.slice(0, 5), { actions: false }) : '<p style="color:var(--text-secondary)">Aucune ordonnance enregistree.</p>'}
        `;

        UI.showModal(`Fiche Patient: ${patient.prenom} ${patient.nom}`, html);
    },

    async printFiche(id) {
        const patient = await DB.get('patients', id);
        if (!patient) { UI.toast('Patient introuvable', 'error'); return; }
        const age = patient.dateNaissance ? Math.floor((Date.now() - new Date(patient.dateNaissance).getTime()) / 31557600000) : null;

        const body = `
            <div class="print-title">FICHE PATIENT</div>
            <table>
                <tbody>
                <tr><th>Matricule</th><td>${patient.matricule || '-'}</td><th>Date creation</th><td>${UI.formatDate(patient.dateCreation)}</td></tr>
                <tr><th>Nom complet</th><td colspan="3"><strong>${patient.prenom} ${patient.nom}</strong></td></tr>
                <tr><th>Sexe</th><td>${patient.sexe === 'M' ? 'Masculin' : 'Feminin'}</td><th>Age</th><td>${age !== null ? age + ' an(s)' : '-'}</td></tr>
                <tr><th>Naissance</th><td>${UI.formatDate(patient.dateNaissance)}</td><th>Lieu</th><td>${patient.lieuNaissance || '-'}</td></tr>
                <tr><th>Telephone</th><td>${patient.telephone || '-'}</td><th>Email</th><td>${patient.email || '-'}</td></tr>
                <tr><th>Adresse</th><td colspan="3">${patient.adresse || '-'}</td></tr>
                <tr><th>Groupe sanguin</th><td>${patient.groupeSanguin || 'Inconnu'}</td><th>Allergies</th><td>${(patient.allergie || []).join(', ') || 'Aucune'}</td></tr>
                <tr><th>Antecedents</th><td colspan="3">${(patient.antecedents || []).join(', ') || 'Aucun'}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">Le service</span></div>
            </div>
        `;
        await Print.open('Fiche patient - ' + patient.prenom + ' ' + patient.nom, body);
    },

    async remove(id) {
        const confirmed = await UI.confirm('Supprimer ce patient ? Cette action est irreversible.');
        if (confirmed) {
            await DB.delete('patients', id);
            UI.toast('Patient supprime', 'success');
            await Auth.log('Suppression', 'patients', `Patient ${id}`);
            this.renderList();
        }
    },

    cleanup() {}
};

window.patientsModule = patientsModule;
