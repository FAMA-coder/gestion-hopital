const documentsModule = {
    tab: 'documents',

    types: [
        { value: 'certificatMedical', label: 'Certificat medical' },
        { value: 'ordonnance', label: 'Ordonnance' },
        { value: 'resultat', label: "Resultat d'examen" },
        { value: 'courrier', label: 'Courrier' },
        { value: 'rapport', label: 'Rapport' },
        { value: 'autre', label: 'Autre' }
    ],

    async show() {
        UI.setPageTitle('Gestion des Documents');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'documents' ? 'active' : ''}" onclick="documentsModule.switchTab('documents')">Documents</button>
                <button class="tab ${this.tab === 'fichiers' ? 'active' : ''}" onclick="documentsModule.switchTab('fichiers')">Fichiers numeriques</button>
            </div>
            <div id="documents-content"></div>
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
        const content = document.getElementById('documents-content');
        if (this.tab === 'documents') await this.renderDocuments(content);
        else await this.renderFichiers(content);
    },

    typeLabel(t) { const x = this.types.find(x => x.value === t); return x ? x.label : t; },

    async renderDocuments(container) {
        const [docs, patients] = await Promise.all([DB.getAll('documents'), DB.getAll('patients')]);
        docs.sort((a, b) => new Date(b.date) - new Date(a.date));
        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const typeColor = (t) => ({ certificatMedical: 'success', ordonnance: 'info', resultat: 'purple', courrier: 'warning', rapport: 'blue', autre: 'gray' }[t] || 'gray');

        container.innerHTML = `
            ${Auth.can('documents', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="documentsModule.showForm()">+ Nouveau Document</button></div>' : ''}
            <div class="card">
                ${UI.renderTable([
                    { field: 'date', label: 'Date', render: (v) => UI.formatDate(v) },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(this.typeLabel(v), typeColor(v)) },
                    { field: 'titre', label: 'Titre', render: (v) => `<strong>${v}</strong>` },
                    { field: 'patientId', label: 'Patient', render: (v) => getPat(v) },
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-primary" title="Apercu" onclick="documentsModule.preview('${row.id}')">&#128065;</button>
                        <button class="btn btn-sm btn-outline" title="Imprimer" onclick="documentsModule.printDoc('${row.id}')">&#128424;</button>
                        ${Auth.can('documents', 3) ? `<button class="btn btn-sm btn-danger" onclick="documentsModule.remove('${row.id}')">&#10005;</button>` : ''}
                    ` }
                ], docs, { actions: false, emptyTitle: 'Aucun document', emptyText: 'Aucun document enregistre.' })}
            </div>
        `;
    },

    async renderFichiers(container) {
        const [files, patients] = await Promise.all([DB.getAll('documentsFichiers'), DB.getAll('patients')]);
        files.sort((a, b) => new Date(b.date) - new Date(a.date));
        const getPat = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };

        container.innerHTML = `
            ${Auth.can('documents', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="documentsModule.showFileForm()">+ Uploader un Fichier</button></div>' : ''}
            <div class="card">
                ${UI.renderTable([
                    { field: 'date', label: 'Date', render: (v) => UI.formatDate(v) },
                    { field: 'titre', label: 'Titre', render: (v) => `<strong>${v}</strong>` },
                    { field: 'patientId', label: 'Patient', render: (v) => getPat(v) },
                    { field: 'nomFichier', label: 'Fichier', render: (v) => v },
                    { field: 'taille', label: 'Taille', render: (v) => v ? (v / 1024).toFixed(1) + ' Ko' : '-' },
                    { label: 'Actions', render: (v, row) => `
                        <button class="btn btn-sm btn-primary" title="Telecharger" onclick="documentsModule.downloadFile('${row.id}')">&#8681;</button>
                        <button class="btn btn-sm btn-outline" title="Ouvrir / Imprimer" onclick="documentsModule.openFile('${row.id}')">&#128065;</button>
                        ${Auth.can('documents', 3) ? `<button class="btn btn-sm btn-danger" onclick="documentsModule.removeFile('${row.id}')">&#10005;</button>` : ''}
                    ` }
                ], files, { actions: false, emptyTitle: 'Aucun fichier', emptyText: 'Aucun fichier numerique enregistre.' })}
            </div>
        `;
    },

    async showForm(docId) {
        const patients = await DB.getAll('patients');
        const doc = docId ? await DB.get('documents', docId) : {};

        const tplHelp = `<p style="font-size:12px;color:var(--text-secondary);margin:2px 0 8px">Variables disponibles : {nom}, {prenom}, {date}, {medecin}</p>`;

        const formHtml = `
            ${UI.buildForm([
                { name: 'type', label: 'Type de document', type: 'select', required: true, options: this.types },
                { name: 'titre', label: 'Titre', required: true },
                { name: 'patientId', label: 'Patient', type: 'select', options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) }
            ], doc)}
            <div class="form-group">
                <label>Contenu</label>
                ${tplHelp}
                <textarea name="contenu" id="doc-contenu" rows="10" style="width:100%" placeholder="Contenu du document...">${doc.contenu || ''}</textarea>
            </div>
        `;
        UI.showModal(docId ? 'Modifier le Document' : 'Nouveau Document', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="documentsModule.save(${docId ? `'${docId}'` : 'null'})">Enregistrer</button>
        `);
    },

    async save(docId) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        data.contenu = document.getElementById('doc-contenu').value;
        if (!data.type || !data.titre) { UI.toast('Type et titre requis', 'error'); return; }
        if (docId) {
            const existing = await DB.get('documents', docId);
            data.id = docId;
            data.date = existing.date;
        } else {
            data.id = DB.generateId();
            data.date = new Date().toISOString();
            data.auteurId = Auth.currentUser.id;
        }
        await DB.put('documents', data);
        UI.toast('Document enregistre', 'success');
        await Auth.log('Enregistrement', 'documents', `Document ${data.titre}`);
        UI.hideModal();
        this.renderTab();
    },

    async remove(id) {
        const ok = await UI.confirm('Supprimer ce document ?');
        if (!ok) return;
        await DB.delete('documents', id);
        UI.toast('Document supprime', 'success');
        this.renderTab();
    },

    async resolveContext(doc) {
        const [patients, medecins, personnel] = await Promise.all([DB.getAll('patients'), DB.getAll('medecins'), DB.getAll('personnel')]);
        const p = patients.find(x => x.id === doc.patientId);
        const auteurs = await DB.getAll('users');
        const medItem = doc.medecinId
            ? personnel.find(x => x.id === doc.medecinId)
            : (doc.auteurId ? auteurs.find(x => x.id === doc.auteurId) : null);
        const medecinNom = medItem ? (medItem.nomComplet || (medItem.prenom + ' ' + medItem.nom)) : (doc.auteurNom || 'Le Medecin traitant');
        const dateStr = UI.formatDate(doc.date);
        return { p, medecinNom, dateStr, medecins };
    },

    async buildBody(doc) {
        const { p, medecinNom, dateStr } = await this.resolveContext(doc);
        let contenu = doc.contenu || '';
        contenu = contenu
            .replace(/\{nom\}/g, p ? p.nom : '')
            .replace(/\{prenom\}/g, p ? p.prenom : '')
            .replace(/\{date\}/g, dateStr)
            .replace(/\{medecin\}/g, medecinNom)
            .replace(/\n/g, '<br>');

        const patientLine = p ? `Patient : <strong>${p.nom} ${p.prenom}</strong>${p.matricule ? ' (' + p.matricule + ')' : ''} | Date : ${dateStr}` : `Date : ${dateStr}`;

        return `
            <div class="print-title">${doc.titre}</div>
            <p style="color:#5f6368">${patientLine}</p>
            <div style="margin-top:14px; line-height:1.7">${contenu}</div>
            <div class="print-sign">
                <div><span class="line">Le Medecin</span></div>
                <div><span class="line">Signature / Cachet</span></div>
            </div>
        `;
    },

    async preview(id) {
        const doc = await DB.get('documents', id);
        if (!doc) return;
        const { p } = await this.resolveContext(doc);
        const body = await this.buildBody(doc);
        UI.showModal(this.typeLabel(doc.type) + ' - ' + doc.titre, `
            <div style="max-height:480px;overflow:auto">${body}</div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Fermer</button>
            <button class="btn btn-primary" onclick="documentsModule.printDoc('${id}')">&#128424; Imprimer</button>
            ${Auth.can('documents', 3) ? `<button class="btn btn-outline" onclick="UI.hideModal();documentsModule.showForm('${id}')">Modifier</button>` : ''}
        `);
    },

    async printDoc(id) {
        const doc = await DB.get('documents', id);
        if (!doc) return;
        const body = await this.buildBody(doc);
        await Print.open(doc.titre, body);
    },

    async showFileForm() {
        const patients = await DB.getAll('patients');
        const formHtml = `
            ${UI.buildForm([
                { name: 'titre', label: 'Titre du document', required: true },
                { name: 'patientId', label: 'Patient', type: 'select', options: patients.map(p => ({ value: p.id, label: `${p.matricule} - ${p.prenom} ${p.nom}` })) },
                { name: 'categorie', label: 'Categorie', type: 'select', options: [{ value: 'examen', label: 'Examen' }, { value: 'rapport', label: 'Rapport' }, { value: 'piece', label: 'Piece administrative' }, { value: 'autre', label: 'Autre' }] }
            ])}
            <div class="form-group">
                <label>Fichier (PDF / image)</label>
                <input type="file" id="doc-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" style="width:100%">
            </div>
        `;
        UI.showModal('Uploader un Fichier', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="documentsModule.saveFile()">Enregistrer</button>
        `);
    },

    saveFile() {
        const fileInput = document.getElementById('doc-file');
        if (!fileInput.files || fileInput.files.length === 0) {
            UI.toast('Selectionnez un fichier', 'error'); return;
        }
        const file = fileInput.files[0];
        if (file.size > 3 * 1024 * 1024) {
            UI.toast('Fichier trop volumineux (max 3 Mo)', 'error'); return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const form = document.querySelector('.modal-body');
            const data = UI.getFormData(form);
            if (!data.titre) { UI.toast('Titre requis', 'error'); return; }
            data.id = DB.generateId();
            data.date = new Date().toISOString();
            data.nomFichier = file.name;
            data.typeFichier = file.type || 'application/octet-stream';
            data.taille = file.size;
            data.dataUrl = reader.result;
            data.auteurId = Auth.currentUser.id;
            await DB.put('documentsFichiers', data);
            UI.toast('Fichier enregistre', 'success');
            await Auth.log('Upload', 'documents', `Fichier ${data.nomFichier}`);
            UI.hideModal();
            this.renderTab();
        };
        reader.onerror = () => UI.toast('Erreur de lecture du fichier', 'error');
        reader.readAsDataURL(file);
    },

    async downloadFile(id) {
        const f = await DB.get('documentsFichiers', id);
        if (!f) return;
        const a = document.createElement('a');
        a.href = f.dataUrl;
        a.download = f.nomFichier || f.titre;
        a.click();
    },

    async openFile(id) {
        const f = await DB.get('documentsFichiers', id);
        if (!f) return;
        window.open(f.dataUrl, '_blank');
    },

    async removeFile(id) {
        const ok = await UI.confirm('Supprimer ce fichier ?');
        if (!ok) return;
        await DB.delete('documentsFichiers', id);
        UI.toast('Fichier supprime', 'success');
        this.renderTab();
    },

    cleanup() {}
};

window.documentsModule = documentsModule;
