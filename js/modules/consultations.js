const consultationsModule = {
    currentPage: 1,
    perPage: 15,

    async show() {
        UI.setPageTitle('Consultations');
        await this.renderList();
    },

    async renderList() {
        const container = document.getElementById('content-area');
        let consultations = await DB.getAll('consultations');
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();

        consultations.sort((a, b) => new Date(b.dateConsultation) - new Date(a.dateConsultation));
        const total = consultations.length;
        const start = (this.currentPage - 1) * this.perPage;
        const paged = consultations.slice(start, start + this.perPage);

        const enriched = paged.map(c => {
            const pat = patients.find(p => p.id === c.patientId);
            const med = medecins.find(m => m.id === c.medecinId);
            return { ...c, patientNom: pat ? `${pat.prenom} ${pat.nom}` : c.patientId, medecinNom: med ? med.label : c.medecinId };
        });

        let html = `
            <div class="toolbar">
                <div class="toolbar-left">
                    <h3 style="font-size:14px;color:var(--text-secondary)">${total} consultation(s)</h3>
                </div>
                <div class="toolbar-right">
                    ${Auth.can('consultations', 3) ? '<button class="btn btn-primary" onclick="consultationsModule.showForm()">+ Nouvelle Consultation</button>' : ''}
                </div>
            </div>
            <div class="card">
                ${UI.renderTable([
                    { field: 'patientNom', label: 'Patient', render: (v) => `<strong>${v}</strong>` },
                    { field: 'medecinNom', label: 'Medecin', render: (v) => v },
                    { field: 'dateConsultation', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, v === 'Urgence' ? 'danger' : 'info') },
                    { field: 'motif', label: 'Motif', render: (v) => v },
                    { field: 'diagnostic', label: 'Diagnostic', render: (v) => v || '-' },
                    { label: 'Actions', render: (v, row) => (
                        (Auth.can('consultations', 1) ? `<button class="btn btn-sm btn-outline" title="Imprimer le ticket de consultation" onclick="consultationsModule.printTicket('${row.id}')">&#127919; Ticket</button>&nbsp;` : '') +
                        (Auth.can('consultations', 3) ? `<button class="btn btn-sm btn-outline" title="Modifier la consultation" onclick="consultationsModule.showEditForm('${row.id}')">&#9998; Modifier</button>` : '')
                    ) }
                ], enriched, { actions: false })}
            </div>
            ${UI.renderPagination(total, this.currentPage, this.perPage)}
        `;

        container.innerHTML = html;
        container.querySelectorAll('.pagination button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderList();
            });
        });
    },

    async showForm() {
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'medecinId', label: 'Medecin', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Normale', label: 'Normale' }, { value: 'Controle', label: 'Controle' }, { value: 'Urgence', label: 'Urgence' }] },
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de la consultation' },
            { name: 'symptomes', label: 'Symptomes', type: 'textarea', placeholder: 'Symptomes decrits par le patient' },
            { name: 'diagnostic', label: 'Diagnostic', type: 'textarea', placeholder: 'Diagnostic du medecin' },
            { name: 'prescription', label: 'Prescription', type: 'textarea', placeholder: 'Prescription medicale' },
            { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Notes complementaires' }
        ]);

        UI.showModal('Nouvelle Consultation', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="consultationsModule.save()">Enregistrer</button>
        `);
    },

    async save() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);

        if (!data.patientId || !data.medecinId || !data.motif) {
            UI.toast('Veuillez remplir les champs obligatoires', 'error');
            return;
        }

        data.id = DB.generateId();
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
        await Auth.log('Creation', 'consultations', `Consultation ${data.id}`);
        UI.hideModal();
        this.renderList();
        this.showTicketAction(data.id);
    },

    async showEditForm(id) {
        const c = await DB.get('consultations', id);
        if (!c) return;
        const patients = await DB.getAll('patients');
        const medecins = await Meta.getMedecins();

        const formHtml = UI.buildForm([
            { name: 'patientId', label: 'Patient', type: 'select', required: true, options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
            { name: 'medecinId', label: 'Medecin', type: 'select', required: true, options: medecins.map(m => ({ value: m.id, label: m.label })) },
            { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Normale', label: 'Normale' }, { value: 'Controle', label: 'Controle' }, { value: 'Urgence', label: 'Urgence' }] },
            { name: 'motif', label: 'Motif', required: true, placeholder: 'Motif de la consultation' },
            { name: 'symptomes', label: 'Symptomes', type: 'textarea', placeholder: 'Symptomes decrits par le patient' },
            { name: 'diagnostic', label: 'Diagnostic', type: 'textarea', placeholder: 'Diagnostic du medecin' },
            { name: 'prescription', label: 'Prescription', type: 'textarea', placeholder: 'Prescription medicale' },
            { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Notes complementaires' }
        ], c);

        UI.showModal('Modifier la Consultation', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="consultationsModule.saveEdit('${id}')">Enregistrer</button>
        `);
    },

    async saveEdit(id) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.patientId || !data.medecinId || !data.motif) {
            UI.toast('Veuillez remplir les champs obligatoires', 'error');
            return;
        }
        const c = await DB.get('consultations', id);
        if (!c) return;
        c.patientId = data.patientId;
        c.medecinId = data.medecinId;
        c.type = data.type || 'Normale';
        c.motif = data.motif;
        c.symptomes = data.symptomes || '';
        c.diagnostic = data.diagnostic || '';
        c.prescription = data.prescription || '';
        c.notes = data.notes || '';
        await DB.put('consultations', c);
        UI.toast('Consultation mise a jour', 'success');
        await Auth.log('Modification', 'consultations', `Consultation ${c.id}`);
        UI.hideModal();
        this.renderList();
    },

    async showTicketAction(id) {
        const c = await DB.get('consultations', id);
        if (!c) return;
        const patients = await DB.getAll('patients');
        const pat = patients.find(p => p.id === c.patientId);

        UI.showModal('Consultation enregistree', `
            <div class="form-group">
                <p style="margin:4px 0"><strong>Patient:</strong> ${pat ? `${pat.prenom} ${pat.nom}` : c.patientId}</p>
                <p style="margin:4px 0"><strong>Type:</strong> ${c.type || 'Normale'}</p>
                <p style="margin:4px 0"><strong>Motif:</strong> ${c.motif || '-'}</p>
                <p style="margin:4px 0"><strong>Date:</strong> ${UI.formatDateTime(c.dateConsultation)}</p>
            </div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Fermer</button>
            <button class="btn btn-primary" onclick="UI.hideModal(); consultationsModule.printTicket('${id}')">&#128424; Imprimer le ticket</button>
        `);
    },

    async printTicket(id) {
        const c = await DB.get('consultations', id);
        if (!c) return;
        const [patients, medecins] = await Promise.all([DB.getAll('patients'), Meta.getMedecins()]);
        const pat = patients.find(p => p.id === c.patientId);
        const med = medecins.find(m => m.id === c.medecinId);
        const hopital = await Meta.getHopital();

        const body = `
            <div class="print-title">TICKET DE CONSULTATION</div>
            <table>
                <tr><th>N. Ticket</th><td>${c.id.slice(-6).toUpperCase()}</td><th>Date</th><td>${UI.formatDateTime(c.dateConsultation)}</td></tr>
                <tr><th>Patient</th><td colspan="3">${pat ? `${pat.prenom} ${pat.nom}` : c.patientId}${pat && pat.matricule ? ' (' + pat.matricule + ')' : ''}</td></tr>
                <tr><th>Medecin</th><td colspan="3">${med ? med.label : c.medecinId}</td></tr>
                <tr><th>Type</th><td>${c.type || 'Normale'}</td><th>Lieu</th><td>${hopital && hopital.nom ? hopital.nom : 'Hopital'}</td></tr>
                <tr><th>Motif</th><td colspan="3">${c.motif || '-'}</td></tr>
            </table>
        `;

        await Print.open('Ticket de Consultation - ' + (pat ? pat.nom : ''), body);
    },

    cleanup() {}
};

window.consultationsModule = consultationsModule;
