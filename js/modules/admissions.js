const admissionsModule = {
    currentPage: 1,
    perPage: 15,
    search: '',

    async show() {
        UI.setPageTitle('Admissions');
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('content-area');
        let admissions = await DB.getAll('admissions');
        const patients = await DB.getAll('patients');
        const services = await DB.getAll('services');

        admissions.sort((a, b) => new Date(b.dateAdmission) - new Date(a.dateAdmission));

        if (this.search) {
            const s = this.search.toLowerCase().trim();
            admissions = admissions.filter(a => {
                const pat = patients.find(p => p.id === a.patientId);
                if (!pat) return false;
                const nomComplet = `${pat.prenom} ${pat.nom} ${pat.nom} ${pat.prenom}`.toLowerCase();
                const matricule = (pat.matricule || '').toLowerCase();
                return nomComplet.includes(s) || matricule.includes(s);
            });
        }

        const total = admissions.length;
        const start = (this.currentPage - 1) * this.perPage;
        const paged = admissions.slice(start, start + this.perPage);

        const medecins = await Meta.getMedecins();

        const enriched = paged.map(a => {
            const pat = patients.find(p => p.id === a.patientId);
            const svc = services.find(s => s.id === a.serviceId);
            const med = medecins.find(m => m.id === a.medecinId);
            return { ...a, patientNom: pat ? `${pat.prenom} ${pat.nom}` : a.patientId, serviceNom: svc ? svc.nom : '-', medecinNom: med ? med.label : (a.medecinId || '-') };
        });

        let html = `
            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <input type="text" id="search-admission" placeholder="Rechercher patient..." value="${this.search}" oninput="admissionsModule.doSearch()">
                        <button class="btn-icon" onclick="admissionsModule.doSearch()">&#128269;</button>
                    </div>
                </div>
                <div class="toolbar-right">
                    ${Auth.can('admissions', 3) ? '<button class="btn btn-primary" onclick="admissionsModule.showForm()">+ Nouvelle Admission</button>' : ''}
                </div>
            </div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'patientNom', label: 'Patient', render: (v) => `<strong>${v}</strong>` },
                    { field: 'dateAdmission', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, 'info') },
                    { field: 'serviceNom', label: 'Service', render: (v) => v },
                    { field: 'medecinNom', label: 'Medecin', render: (v) => v },
                    { field: 'statut', label: 'Statut', render: (v) => {
                        const colors = { EnCours: 'warning', Terminee: 'success', Transferee: 'purple' };
                        return UI.renderBadge(v === 'EnCours' ? 'En cours' : v, colors[v] || 'gray');
                    }},
                    { field: 'dateSortie', label: 'Date Sortie', render: (v) => v ? UI.formatDate(v) : '-' }
                ], enriched, {
                    actions: Auth.can('admissions', 3),
                    renderActions: (row) => `
                        <button class="btn-icon" title="Imprimer le bordereau d'admission" onclick="admissionsModule.printBordereau('${row.id}')">&#128424;</button>
                        <button class="btn-icon" title="Modifier l'admission" onclick="admissionsModule.showEditForm('${row.id}')">&#9998;</button>
                        <button class="btn-icon" title="Supprimer l'admission" onclick="admissionsModule.deleteAdmission('${row.id}')">&#128465;</button>
                    `
                })}
            </div>
            ${UI.renderPagination(total, this.currentPage, this.perPage)}
        `;

        container.innerHTML = html;

        document.getElementById('search-admission').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.doSearch();
        });

        container.querySelectorAll('.pagination button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderList();
            });
        });

        // Restaure le focus et le curseur dans le champ de recherche apres un
        // re-rendu declenche par la saisie (evite que le curseur disparaisse).
        if (this._preserveSearchFocus) {
            const el = document.getElementById('search-admission');
            if (el) {
                el.focus();
                const pos = el.value.length;
                try { el.setSelectionRange(pos, pos); } catch (e) {}
            }
            this._preserveSearchFocus = false;
        }
    },

    doSearch() {
        this.search = document.getElementById('search-admission').value;
        this.currentPage = 1;
        this._preserveSearchFocus = true;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.renderList(), 250);
    },

    async showForm() {
        const patients = await DB.getAll('patients');
        const services = (await Meta.getServices()).filter(s => s.actif);
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'type', label: 'Type admission', type: 'select', required: true, options: [
                { value: 'Urgence', label: 'Urgence' }, { value: 'Consultation', label: 'Consultation' },
                { value: 'Hospitalisation', label: 'Hospitalisation' }, { value: 'Programmee', label: 'Programmee' }
            ]},
            { name: 'serviceId', label: 'Service', type: 'select', required: true, options: services.map(s => ({ value: s.id, label: s.nom })) },
            { name: 'medecinId', label: 'Medecin', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de l\'admission' },
            { name: 'dateAdmission', label: 'Date admission', type: 'datetime-local', required: true, default: new Date().toISOString().slice(0, 16) }
        ]);

        UI.showModal('Nouvelle Admission', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="admissionsModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);

        if (!data.patientId || !data.type || !data.serviceId || !data.motif) {
            UI.toast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        data.id = DB.generateId();
        data.statut = 'EnCours';
        data.dateAdmission = new Date(data.dateAdmission || Date.now()).toISOString();

        const litsDispo = await Meta.getLitsDisponibles(data.serviceId);
        if (litsDispo.length > 0) {
            data.litId = litsDispo[0].id;
            await DB.put('lits', { ...litsDispo[0], statut: 'Occupe' });
        }

        await DB.put('admissions', data);
        UI.toast('Admission enregistree avec succes', 'success');
        await Auth.log('Creation', 'admissions', `Admission ${data.id}`);
        UI.hideModal();
        this.renderList();
    },

    async showEditForm(id) {
        const admission = await DB.get('admissions', id);
        if (!admission) return;

        const patients = await DB.getAll('patients');
        const services = (await Meta.getServices()).filter(s => s.actif);
        const medecins = await Meta.getMedecins();

        const values = Object.assign({}, admission);
        values.dateAdmission = admission.dateAdmission ? admission.dateAdmission.slice(0, 16) : '';
        values.dateSortie = admission.dateSortie ? admission.dateSortie.slice(0, 16) : '';

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'type', label: 'Type admission', type: 'select', required: true, options: [
                { value: 'Urgence', label: 'Urgence' }, { value: 'Consultation', label: 'Consultation' },
                { value: 'Hospitalisation', label: 'Hospitalisation' }, { value: 'Programmee', label: 'Programmee' }
            ]},
            { name: 'serviceId', label: 'Service', type: 'select', required: true, options: services.map(s => ({ value: s.id, label: s.nom })) },
            { name: 'medecinId', label: 'Medecin', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de l\'admission' },
            { name: 'dateAdmission', label: 'Date admission', type: 'datetime-local', required: true },
            { name: 'statut', label: 'Statut', type: 'select', options: [
                { value: 'EnCours', label: 'En cours' }, { value: 'Terminee', label: 'Terminee' }, { value: 'Transferee', label: 'Transferee' }
            ]},
            { name: 'dateSortie', label: 'Date sortie', type: 'datetime-local' },
            { name: 'motifSortie', label: 'Motif de sortie', placeholder: 'Ex: guerison, transfert...' }
        ], values);

        UI.showModal('Modifier l\'Admission', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="admissionsModule.saveEdit('${id}')">Enregistrer</button>
        `);
    },

    async saveEdit(id) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);

        if (!data.patientId || !data.type || !data.serviceId || !data.motif) {
            UI.toast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        const admission = await DB.get('admissions', id);
        if (!admission) return;

        const oldServiceId = admission.serviceId;
        const oldLitId = admission.litId;

        admission.patientId = data.patientId;
        admission.type = data.type;
        admission.serviceId = data.serviceId;
        admission.medecinId = data.medecinId;
        admission.motif = data.motif;
        admission.dateAdmission = new Date(data.dateAdmission || Date.now()).toISOString();
        admission.statut = data.statut || 'EnCours';
        admission.dateSortie = data.dateSortie ? new Date(data.dateSortie).toISOString() : null;
        admission.motifSortie = data.motifSortie || null;

        // Gestion du lit en fonction du service et du statut
        if (admission.statut === 'EnCours') {
            if (oldLitId && oldServiceId !== data.serviceId) {
                const oldLit = await DB.get('lits', oldLitId);
                if (oldLit) { oldLit.statut = 'Libre'; await DB.put('lits', oldLit); }
                admission.litId = null;
            }
            if (!admission.litId) {
                const litsDispo = await Meta.getLitsDisponibles(data.serviceId);
                if (litsDispo.length > 0) {
                    admission.litId = litsDispo[0].id;
                    await DB.put('lits', { ...litsDispo[0], statut: 'Occupe' });
                }
            }
        } else {
            // Sortie ou transfert : libere le lit occupe
            if (oldLitId || admission.litId) {
                const litId = admission.litId || oldLitId;
                const lit = await DB.get('lits', litId);
                if (lit && lit.statut === 'Occupe') { lit.statut = 'Libre'; await DB.put('lits', lit); }
                admission.litId = null;
            }
        }

        await DB.put('admissions', admission);
        UI.toast('Admission modifiee avec succes', 'success');
        await Auth.log('Modification', 'admissions', `Admission ${admission.id}`);
        UI.hideModal();
        this.renderList();
    },

    async deleteAdmission(id) {
        const admission = await DB.get('admissions', id);
        if (!admission) return;

        const ok = await UI.confirm('Supprimer cette admission ?');
        if (!ok) return;

        // Libere le lit occupe par cette admission
        if (admission.litId) {
            const lit = await DB.get('lits', admission.litId);
            if (lit && lit.statut === 'Occupe') { lit.statut = 'Libre'; await DB.put('lits', lit); }
        }

        await DB.delete('admissions', id);
        UI.toast('Admission supprimee', 'success');
        await Auth.log('Suppression', 'admissions', `Admission ${id}`);
        this.renderList();
    },

    async printBordereau(id) {
        const a = await DB.get('admissions', id);
        if (!a) return;
        const [patients, services, medecins, lits] = await Promise.all([DB.getAll('patients'), DB.getAll('services'), Meta.getMedecins(), DB.getAll('lits')]);
        const pat = patients.find(p => p.id === a.patientId);
        const svc = services.find(s => s.id === a.serviceId);
        const med = medecins.find(m => m.id === a.medecinId);
        const lit = a.litId ? lits.find(l => l.id === a.litId) : null;
        const age = pat && pat.dateNaissance ? Math.floor((Date.now() - new Date(pat.dateNaissance).getTime()) / 31557600000) : null;

        const body = `
            <div class="print-title">BORDEREAU D'ADMISSION</div>
            <table>
                <tbody>
                <tr><th>N. Admission</th><td>${a.id.slice(-8).toUpperCase()}</td><th>Date</th><td>${UI.formatDateTime(a.dateAdmission)}</td></tr>
                <tr><th>Patient</th><td colspan="3"><strong>${pat ? pat.prenom + ' ' + pat.nom : a.patientId}</strong>${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Sexe</th><td>${pat ? (pat.sexe === 'M' ? 'Masculin' : 'Feminin') : '-'}</td><th>Age</th><td>${age !== null ? age + ' an(s)' : '-'}</td></tr>
                <tr><th>Telephone</th><td colspan="3">${pat ? (pat.telephone || '-') : '-'}</td></tr>
                <tr><th>Type</th><td>${a.type || '-'}</td><th>Service</th><td>${svc ? svc.nom : '-'}</td></tr>
                <tr><th>Medecin</th><td>${med ? med.label : (a.medecinId || '-')}</td><th>Lit</th><td>${lit ? lit.numero : (a.litId || 'Non affecte')}</td></tr>
                <tr><th>Motif</th><td colspan="3">${a.motif || '-'}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le patient</span></div>
                <div><span class="line">L'administration</span></div>
            </div>
        `;
        await Print.open('Bordereau d\'admission - ' + (pat ? pat.prenom + ' ' + pat.nom : ''), body);
    },

    cleanup() {}
};

window.admissionsModule = admissionsModule;
