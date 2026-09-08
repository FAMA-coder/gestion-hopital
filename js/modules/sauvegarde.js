const sauvegardeModule = {
    async show() {
        UI.setPageTitle('Sauvegarde & Restauration');
        const container = document.getElementById('content-area');

        let html = `
            <div class="toolbar">
                <div class="toolbar-left"><h3 style="font-size:14px;color:var(--text-secondary)">Gestion des donnees</h3></div>
            </div>

            <div class="card" style="margin-bottom:16px">
                <div class="card-header"><h3>Stockage du navigateur</h3></div>
                <div id="storage-info" style="padding:10px 16px 14px;color:var(--text-secondary);font-size:14px;line-height:1.7">
                    Chargement...
                </div>
                <div style="padding:0 16px 14px">
                    <button class="btn btn-outline" onclick="sauvegardeModule.refreshStorage()">&#8635; Actualiser</button>
                    <button class="btn btn-outline" onclick="sauvegardeModule.requestPersistence()">&#128274; Activer le stockage persistant</button>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>Sauvegarde</h3></div>
                    <p style="color:var(--text-secondary);margin-bottom:16px">Exportez toutes les donnees de l'application dans un fichier JSON. Ce fichier permet de restaurer ou de transferer les donnees.</p>
                    <button class="btn btn-primary" onclick="sauvegardeModule.doBackup()">&#11015; Effectuer une sauvegarde</button>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Restauration</h3></div>
                    <p style="color:var(--text-secondary);margin-bottom:12px">Importez un fichier de sauvegarde JSON pour restaurer toutes les donnees de l'application.</p>
                    <div id="restore-section">
                        <label for="restore-file" class="btn btn-outline" style="cursor:pointer;margin-bottom:12px">&#128194; Choisir un fichier de sauvegarde (.json)</label>
                        <input type="file" id="restore-file" accept=".json" style="display:none" onchange="sauvegardeModule.previewBackup(this.files[0])">
                        <div id="restore-preview" style="display:none;border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px;background:var(--bg)"></div>
                        <div id="restore-actions" style="display:none;margin-bottom:12px">
                            <button class="btn btn-danger" onclick="sauvegardeModule.doRestoreConfirmed()">&#128260; Restaurer cette sauvegarde</button>
                        </div>
                        <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Attention : la restauration remplacera definitivement toutes les donnees actuelles. Il est recommande d'effectuer une sauvegarde avant de restaurer.</p>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Export Excel</h3></div>
                <p style="color:var(--text-secondary);margin-bottom:16px">Exportez une vue d'ensemble des donnees au format CSV.</p>
                <button class="btn btn-outline" onclick="sauvegardeModule.exportPatients()">Exporter les patients</button>
                <button class="btn btn-outline" onclick="sauvegardeModule.exportConsultations()">Exporter les consultations</button>
                <button class="btn btn-outline" onclick="sauvegardeModule.exportFactures()">Exporter les factures</button>
                <button class="btn btn-outline" onclick="sauvegardeModule.exportMedicaments()">Exporter les medicaments</button>
            </div>
        `;

        container.innerHTML = html;
        this.refreshStorage();
    },

    _pendingFile: null,

    async previewBackup(file) {
        if (!file) return;
        this._pendingFile = file;
        const previewEl = document.getElementById('restore-preview');
        const actionsEl = document.getElementById('restore-actions');
        if (!previewEl || !actionsEl) return;
        previewEl.style.display = 'block';
        previewEl.innerHTML = 'Lecture du fichier...';

        try {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Lecture impossible'));
                reader.readAsText(file);
            });
            const data = JSON.parse(text);
            const storeNames = Object.keys(data).filter(k => Array.isArray(data[k]));
            const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            let summary = '<strong>Fichier :</strong> ' + esc(file.name) + '<br>';
            summary += '<strong>Taille :</strong> ' + (file.size / 1024).toFixed(1) + ' Ko<br>';
            summary += '<strong>Contenu :</strong> ' + storeNames.length + ' magasins de donnees<br>';
            summary += '<ul style="margin:6px 0 0;padding-left:18px;font-size:13px;line-height:1.6">';
            storeNames.slice(0, 25).forEach(name => {
                summary += `<li>${name} (${data[name].length} enregistrements)</li>`;
            });
            if (storeNames.length > 25) summary += `<li>... et ${storeNames.length - 25} autres magasins</li>`;
            summary += '</ul>';
            previewEl.innerHTML = summary;
            actionsEl.style.display = 'block';
        } catch (err) {
            previewEl.innerHTML = '<span style="color:var(--danger)">Fichier invalide ou corrompu : ' + err.message + '</span>';
            actionsEl.style.display = 'none';
            this._pendingFile = null;
        }
    },

    async doRestoreConfirmed() {
        if (!this._pendingFile) { UI.toast('Aucun fichier selectionne', 'error'); return; }
        const ok = await UI.confirm('Cette action remplacera toutes les donnees actuelles par celles du fichier de sauvegarde. Continuer ?');
        if (!ok) return;
        try {
            await Storage.restore(this._pendingFile);
            UI.toast('Restauration terminee. Rechargement de l\'application...', 'success');
            setTimeout(() => { window.location.reload(); }, 800);
        } catch (err) {
            UI.toast('Erreur lors de la restauration : ' + err.message, 'error');
        }
    },

    async refreshStorage() {
        const el = document.getElementById('storage-info');
        if (!el) return;
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                const used = (est.usage || 0) / (1024 * 1024);
                const quota = (est.quota || 0) / (1024 * 1024);
                const pct = quota > 0 ? ((used / quota) * 100).toFixed(1) : '0';
                let persisted = 'Indetermine';
                if (navigator.storage.persisted) {
                    persisted = (await navigator.storage.persisted()) ? 'Oui' : 'Non';
                }
                el.innerHTML = `
                    <div><strong>Espace utilise:</strong> ${used.toFixed(2)} Mo</div>
                    <div><strong>Quota disponible:</strong> ${quota.toFixed(1)} Mo</div>
                    <div><strong>Pourcentage utilise:</strong> ${pct} %</div>
                    <div><strong>Stockage persistant:</strong> ${persisted}</div>
                `;
            } else {
                el.innerHTML = 'API de mesure du stockage non disponible dans ce navigateur.';
            }
        } catch (err) {
            el.innerHTML = 'Impossible de lire les informations de stockage: ' + err.message;
        }
    },

    async requestPersistence() {
        try {
            if (navigator.storage && navigator.storage.persist) {
                const granted = await navigator.storage.persist();
                UI.toast(granted ? 'Stockage persistant active' : 'Stockage persistant refuse par le navigateur', granted ? 'success' : 'warning');
            } else {
                UI.toast('Stockage persistant non supporte par ce navigateur', 'warning');
            }
            this.refreshStorage();
        } catch (err) {
            UI.toast('Erreur: ' + err.message, 'error');
        }
    },

    async doBackup() {
        await Storage.backup();
    },

    async exportPatients() {
        const patients = await DB.getAll('patients');
        const headers = ['Matricule', 'Nom', 'Prenom', 'Sexe', 'Date Naissance', 'Telephone', 'Adresse', 'Groupe Sanguin', 'Allergies'];
        const rows = patients.map(p => [p.matricule, p.nom, p.prenom, p.sexe, p.dateNaissance, p.telephone, p.adresse, p.groupeSanguin, (p.allergie || []).join(', ')]);
        Excel.exportToCSV(headers, rows, 'patients');
    },

    async exportConsultations() {
        const consults = await DB.getAll('consultations');
        const patients = await DB.getAll('patients');
        const headers = ['Patient', 'Date', 'Type', 'Motif', 'Diagnostic'];
        const rows = consults.map(c => {
            const p = patients.find(x => x.id === c.patientId);
            return [p ? `${p.prenom} ${p.nom}` : c.patientId, UI.formatDate(c.dateConsultation), c.type, c.motif, c.diagnostic];
        });
        Excel.exportToCSV(headers, rows, 'consultations');
    },

    async exportFactures() {
        const factures = await DB.getAll('factures');
        const patients = await DB.getAll('patients');
        const headers = ['Patient', 'Date', 'Total', 'Paye', 'Reste', 'Mode', 'Statut'];
        const rows = factures.map(f => {
            const p = patients.find(x => x.id === f.patientId);
            return [p ? `${p.prenom} ${p.nom}` : f.patientId, UI.formatDate(f.date), f.montantTotal, f.montantPaye, f.resteApayer, f.modePaiement, f.statut];
        });
        Excel.exportToCSV(headers, rows, 'factures');
    },

    async exportMedicaments() {
        const meds = await DB.getAll('medicaments');
        const headers = ['Nom', 'Forme', 'Dosage', 'Categorie', 'Stock', 'Stock Min', 'Prix Achat', 'Prix Vente', 'Peremption', 'Fournisseur'];
        const rows = meds.map(m => [m.nom, m.forme, m.dosage, m.categorie, m.stockActuel, m.stockMin, m.prixAchat, m.prixVente, m.datePeremption, m.fournisseur]);
        Excel.exportToCSV(headers, rows, 'medicaments');
    },

    cleanup() {}
};

window.sauvegardeModule = sauvegardeModule;
