const parametresModule = {
    tab: 'hopital',

    async show() {
        UI.setPageTitle('Parametres & Administration');
        const container = document.getElementById('content-area');

        let html = `
            <div class="tabs">
                <button class="tab ${this.tab === 'hopital' ? 'active' : ''}" data-tab="hopital">Hopital</button>
                <button class="tab ${this.tab === 'utilisateurs' ? 'active' : ''}" data-tab="utilisateurs">Utilisateurs</button>
                <button class="tab ${this.tab === 'permissions' ? 'active' : ''}" data-tab="permissions">Permissions</button>
                <button class="tab ${this.tab === 'sauvegarde' ? 'active' : ''}" data-tab="sauvegarde">Sauvegarde</button>
                <button class="tab ${this.tab === 'journal' ? 'active' : ''}" data-tab="journal">Journal</button>
            </div>
            <div id="params-content"></div>
        `;
        container.innerHTML = html;

        container.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.tab = tab.dataset.tab;
                this.show();
            });
        });

        await this.renderTab();
    },

    async renderTab() {
        const content = document.getElementById('params-content');
        if (this.tab === 'hopital') await this.renderHopital(content);
        else if (this.tab === 'utilisateurs') await this.renderUtilisateurs(content);
        else if (this.tab === 'permissions') await this.renderPermissions(content);
        else if (this.tab === 'sauvegarde') await this.renderSauvegarde(content);
        else await this.renderJournal(content);
    },

    async renderHopital(container) {
        const canEdit = Auth.estMaitre();
        const hopital = await Meta.getHopital();
        this.logoData = hopital?.logo || null;
        const thumb = this.logoData ? `<img src="${this.logoData}" style="max-height:70px;border:1px solid var(--border);border-radius:6px;padding:4px;background:#fff">` : '<span style="color:var(--text-secondary)">Aucun logo</span>';
        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3>Informations de l'hopital</h3></div>
                ${canEdit ? '' : '<div style="padding:10px 12px;margin-bottom:16px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text-secondary);font-size:13px">Consultation seule : ces informations ne peuvent etre saisies ou modifiees que par le compte maître (super administrateur).</div>'}
                ${UI.buildForm([
                    { name: 'nom', label: 'Nom', required: true, disabled: !canEdit },
                    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'Public', label: 'Public' }, { value: 'Prive', label: 'Prive' }, { value: 'Associatif', label: 'Associatif' }], disabled: !canEdit },
                    { name: 'adresse', label: 'Adresse', disabled: !canEdit },
                    { name: 'telephone', label: 'Telephone', disabled: !canEdit },
                    { name: 'email', label: 'Email', type: 'email', disabled: !canEdit },
                    { name: 'devise', label: 'Devise', disabled: !canEdit },
                    { name: 'slogan', label: 'Slogan', disabled: !canEdit }
                ], hopital || {})}
                ${canEdit ? `
                <div class="form-group">
                    <label>Logo de l'hopital</label>
                    <div style="display:flex;align-items:center;gap:12px">
                        <input type="file" id="hopital-logo" accept="image/*" onchange="parametresModule.readLogo(this)">
                        <span id="hopital-logo-preview">${thumb}</span>
                    </div>
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="parametresModule.saveHopital()">Enregistrer</button>
                </div>` : ''}
            </div>
        `;
    },

    readLogo(input) {
        if (!Auth.estMaitre()) { UI.toast('Seul le compte maître peut modifier le logo', 'error'); input.value = ''; return; }
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) { UI.toast('Image trop volumineuse (max 2 Mo)', 'error'); input.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.logoData = e.target.result;
            document.getElementById('hopital-logo-preview').innerHTML = `<img src="${this.logoData}" style="max-height:70px;border:1px solid var(--border);border-radius:6px;padding:4px;background:#fff">`;
        };
        reader.readAsDataURL(file);
    },

    async renderUtilisateurs(container) {
        const users = await DB.getAll('users');
        const roles = await Auth.getAllRoles();
        const roleLabels = {};
        roles.forEach(r => { roleLabels[r.key] = r.nom; });

        const isAdminUser = !!(Auth.currentUser && Auth.currentUser.role === 'admin');
        const isAdmin = Auth.can('parametres', 3);
        // Le compte maître n'est visible que par lui-meme ; le compte
        // administrateur n'est visible que par les administrateurs.
        const visibleUsers = Auth.estMaitre()
            ? users
            : users.filter(u => u.maitre !== true && (u.role !== 'admin' || isAdminUser));

        container.innerHTML = `
            ${isAdmin ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="parametresModule.showUserForm()">+ Nouvel Utilisateur</button></div>' : ''}
            <div class="card">
                ${UI.renderTable([
                    { field: 'nomUtilisateur', label: 'Utilisateur', render: (v, row) => `<strong>${v}</strong>${row.maitre ? ' ' + UI.renderBadge('Maitre', 'dark') : ''}` },
                    { field: 'nomComplet', label: 'Nom Complet', render: (v) => v },
                    { field: 'role', label: 'Role', render: (v) => UI.renderBadge(roleLabels[v] || v, v === 'admin' ? 'danger' : 'info') },
                    { field: 'actif', label: 'Statut', render: (v) => UI.renderBadge(v ? 'Actif' : 'Inactif', v ? 'success' : 'gray') }
                ], visibleUsers, {
                    actions: isAdmin,
                    renderActions: (row) => `
                        ${row.maitre ? '' : `
                        ${(!isAdminUser && row.role === 'admin') ? '' : `
                        <button class="btn btn-sm btn-outline" title="Modifier l'utilisateur" onclick="parametresModule.showEditUserForm('${row.id}')">Modifier</button>
                        <button class="btn btn-sm btn-danger" title="Supprimer l'utilisateur" onclick="parametresModule.deleteUser('${row.id}')">Supprimer</button>
                        `}`}
                    `,
                    emptyTitle: 'Aucun utilisateur',
                    emptyText: 'Aucun utilisateur enregistre.'
                })}
            </div>
        `;
    },

    async renderJournal(container) {
        const journal = await DB.getAll('journal');
        const users = await DB.getAll('users');
        const role = Auth.currentUser ? Auth.currentUser.role : '';
        const canPurge = role === 'admin' || role === 'promoteur';

        const getUser = (id) => { const u = users.find(x => x.id === id); return u ? u.nomComplet || u.nomUtilisateur : id; };

        container.innerHTML = `
            <div class="card">
                <div class="card-header"><h3>Journal d'audit (${journal.length})</h3></div>
                ${canPurge ? `
                <div class="toolbar" style="margin-bottom:12px">
                    <div class="toolbar-left" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <label style="font-size:13px;color:var(--text-secondary)">Du</label>
                        <input type="date" id="journal-date-from" class="form-input" style="width:auto;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                        <label style="font-size:13px;color:var(--text-secondary)">Au</label>
                        <input type="date" id="journal-date-to" class="form-input" style="width:auto;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
                        <button class="btn btn-danger" id="btn-purge-journal" onclick="parametresModule.deleteJournalPeriod()">Supprimer l'historique de la periode</button>
                    </div>
                </div>
                ` : ''}
                ${UI.renderTable([
                    { field: 'date', label: 'Date', render: (v) => UI.formatDateTime(v) },
                    { field: 'userId', label: 'Utilisateur', render: (v) => getUser(v) },
                    { field: 'action', label: 'Action', render: (v) => v },
                    { field: 'module', label: 'Module', render: (v) => UI.renderBadge(v, 'info') },
                    { field: 'details', label: 'Details', render: (v) => v || '-' }
                ], [...journal].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50), { actions: false, emptyTitle: 'Journal vide', emptyText: 'Aucune activite enregistree.' })}
            </div>
        `;
    },

    async deleteJournalPeriod() {
        const role = Auth.currentUser ? Auth.currentUser.role : '';
        if (role !== 'admin' && role !== 'promoteur') {
            UI.toast('Acces refuse : seuls les roles administrateur et promoteur peuvent supprimer l\'historique du journal', 'error');
            return;
        }
        const from = document.getElementById('journal-date-from')?.value;
        const to = document.getElementById('journal-date-to')?.value;
        if (!from || !to) { UI.toast('Veuillez definir les dates de debut et de fin de la periode', 'error'); return; }
        if (from > to) { UI.toast('La date de debut doit etre anterieure ou egale a la date de fin', 'error'); return; }

        const start = new Date(from + 'T00:00:00');
        const end = new Date(to + 'T23:59:59.999');
        const all = await DB.getAll('journal');
        const toDelete = all.filter(e => {
            const d = new Date(e.date);
            return d >= start && d <= end;
        });
        if (toDelete.length === 0) { UI.toast('Aucun enregistrement dans cette periode', 'info'); return; }

        const ok = await UI.confirm(`Supprimer definitivement ${toDelete.length} entree(s) du journal entre le ${from} et le ${to} ?`);
        if (!ok) return;

        for (const e of toDelete) await DB.delete('journal', e.id);
        UI.toast(`${toDelete.length} entree(s) supprimee(s)`, 'success');
        await Auth.log('Suppression', 'parametres', `Historique du journal supprime (${from} -> ${to}) : ${toDelete.length} entree(s)`);
        this.renderTab();
    },

    async showUserForm() {
        const isAdminUser = !!(Auth.currentUser && Auth.currentUser.role === 'admin');
        if (!isAdminUser) { UI.toast('Seul un administrateur peut creer des comptes', 'error'); return; }
        const roles = await Auth.getAllRoles();
        const services = (await Meta.getServices()).filter(s => s.actif);

        const roleOptions = roles.filter(r => r.key !== 'admin' || isAdminUser).map(r => ({ value: r.key, label: r.nom }));

        const formHtml = UI.buildForm([
            { name: 'nomUtilisateur', label: 'Nom d\'utilisateur', required: true },
            { name: 'motDePasse', label: 'Mot de passe', type: 'password', required: true },
            { name: 'nomComplet', label: 'Nom complet', required: true },
            { name: 'role', label: 'Role', type: 'select', required: true, options: roleOptions },
            { name: 'serviceId', label: 'Service', type: 'select', options: services.map(s => ({ value: s.id, label: s.nom })) }
        ]);

        UI.showModal('Nouvel Utilisateur', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="parametresModule.saveUser()">Enregistrer</button>
        `);
    },

    async saveUser() {
        const isAdminUser = !!(Auth.currentUser && Auth.currentUser.role === 'admin');
        if (!isAdminUser) { UI.toast('Seul un administrateur peut creer des comptes', 'error'); return; }
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.nomUtilisateur || !data.motDePasse || !data.nomComplet || !data.role) {
            UI.toast('Champs obligatoires manquants', 'error'); return;
        }
        if (String(data.nomUtilisateur).trim().toUpperCase() === Auth.MASTER_USERNAME) {
            UI.toast('Ce nom d\'utilisateur est reserve au compte maître', 'error'); return;
        }
        if (!isAdminUser && data.role === 'admin') {
            UI.toast('Seul un administrateur peut creer un compte administrateur', 'error'); return;
        }
        data.id = DB.generateId();
        data.motDePasse = Auth.hashPassword(data.motDePasse);
        data.actif = true;
        await DB.put('users', data);
        UI.toast('Utilisateur cree', 'success');
        await Auth.log('Creation', 'parametres', `Utilisateur ${data.nomUtilisateur}`);
        UI.hideModal();
        this.renderTab();
    },

    async showEditUserForm(userId) {
        const isAdminUser = !!(Auth.currentUser && Auth.currentUser.role === 'admin');
        const user = (await DB.getAll('users')).find(u => u.id === userId);
        if (!user) return;
        if (user.maitre) { UI.toast('Le compte maître est protege et ne peut pas etre modifie', 'error'); return; }
        if (!isAdminUser && user.role === 'admin') { UI.toast('Le compte administrateur est reserve a l\'administrateur', 'error'); return; }
        const roles = await Auth.getAllRoles();
        const services = (await Meta.getServices()).filter(s => s.actif);
        const roleOptions = roles.filter(r => r.key !== 'admin' || isAdminUser).map(r => ({ value: r.key, label: r.nom }));

        const formHtml = UI.buildForm([
            { name: 'nomUtilisateur', label: "Nom d'utilisateur", required: true },
            { name: 'nomComplet', label: 'Nom complet', required: true },
            { name: 'role', label: 'Role', type: 'select', required: true, options: roleOptions },
            { name: 'serviceId', label: 'Service', type: 'select', options: services.map(s => ({ value: s.id, label: s.nom })) },
            { name: 'actif', label: 'Statut', type: 'select', options: [{ value: '1', label: 'Actif' }, { value: '0', label: 'Inactif' }] },
            { name: 'motDePasse', label: 'Nouveau mot de passe (optionnel)', type: 'password' }
        ], Object.assign({}, user, { actif: user.actif ? '1' : '0', motDePasse: '' }));

        UI.showModal('Modifier l\'Utilisateur', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="parametresModule.saveEditUser('${userId}')">Enregistrer</button>
        `);
    },

    async saveEditUser(userId) {
        const isAdminUser = !!(Auth.currentUser && Auth.currentUser.role === 'admin');
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.nomUtilisateur || !data.nomComplet || !data.role) { UI.toast('Champs obligatoires manquants', 'error'); return; }
        const user = (await DB.getAll('users')).find(u => u.id === userId);
        if (!user) return;
        if (user.maitre) { UI.toast('Le compte maître est protege et ne peut pas etre modifie', 'error'); return; }
        if (String(data.nomUtilisateur).trim().toUpperCase() === Auth.MASTER_USERNAME) {
            UI.toast('Ce nom d\'utilisateur est reserve au compte maître', 'error'); return;
        }
        if (!isAdminUser && user.role === 'admin') { UI.toast('Le compte administrateur est reserve a l\'administrateur', 'error'); return; }
        if (!isAdminUser && data.role === 'admin') { UI.toast('Seul un administrateur peut attribuer le role administrateur', 'error'); return; }

        if (data.nomUtilisateur !== user.nomUtilisateur) {
            const all = await DB.getAll('users');
            if (all.some(u => u.nomUtilisateur === data.nomUtilisateur && u.id !== userId)) {
                UI.toast('Ce nom d\'utilisateur est déjà utilisé', 'error'); return;
            }
        }

        const wasActive = !!user.actif;
        const newActive = data.actif === '1' || data.actif === true;
        if (user.id === Auth.currentUser.id && wasActive && !newActive) {
            UI.toast('Vous ne pouvez pas desactiver votre propre compte', 'error'); return;
        }

        user.nomUtilisateur = data.nomUtilisateur;
        user.nomComplet = data.nomComplet;
        user.role = data.role;
        user.serviceId = data.serviceId || null;
        user.actif = newActive;
        if (data.motDePasse) user.motDePasse = Auth.hashPassword(data.motDePasse);

        await DB.put('users', user);
        UI.toast('Utilisateur mis à jour', 'success');
        await Auth.log('Modification', 'parametres', `Utilisateur ${user.nomUtilisateur} -> role ${data.role}${data.motDePasse ? ' + mot de passe' : ''}`);
        UI.hideModal();
        this.renderTab();
    },

    async deleteUser(userId) {
        const isAdminUser = !!(Auth.currentUser && Auth.currentUser.role === 'admin');
        if (!Auth.can('parametres', 3)) { UI.toast('Acces refuse : seul un administrateur peut supprimer des comptes', 'error'); return; }
        const user = (await DB.getAll('users')).find(u => u.id === userId);
        if (!user) { UI.toast('Utilisateur introuvable', 'error'); return; }
        if (user.maitre) { UI.toast('Le compte maître est protege et ne peut pas etre supprime', 'error'); return; }
        if (!isAdminUser && user.role === 'admin') { UI.toast('Le compte administrateur est reserve a l\'administrateur', 'error'); return; }
        if (user.id === Auth.currentUser.id) {
            UI.toast('Vous ne pouvez pas supprimer votre propre compte', 'error'); return;
        }
        if (user.role === 'admin') {
            const admins = (await DB.getAll('users')).filter(u => u.role === 'admin' && !!u.actif);
            if (admins.length <= 1) {
                UI.toast('Impossible : au moins un compte administrateur actif est requis', 'error'); return;
            }
        }

        const ok = await UI.confirm(
            `Supprimer le compte ${user.nomComplet || user.nomUtilisateur} (${user.nomUtilisateur}) ?`,
            'Cette action est definitive et irreversible.'
        );
        if (!ok) return;

        await DB.delete('users', userId);
        UI.toast(`Compte ${user.nomUtilisateur} supprime`, 'success');
        await Auth.log('Suppression', 'parametres', `Utilisateur ${user.nomUtilisateur} (${user.role})`);
        this.renderTab();
    },

    async saveHopital() {
        if (!Auth.estMaitre()) { UI.toast('Acces refuse : seul le compte maître (super administrateur) peut saisir ou modifier les informations de l\'hopital', 'error'); return; }
        const form = document.querySelector('#params-content').querySelectorAll('input, select, textarea');
        const data = {};
        form.forEach(input => { if (input.name) data[input.name] = input.value; });
        if (this.logoData) data.logo = this.logoData;
        await Meta.saveHopital(data);
        State.set('hopital', data);
        UI.toast('Informations enregistrees', 'success');
        await Auth.log('Modification', 'parametres', 'Informations hopital' + (this.logoData ? ' + logo' : ''));
        this.renderTab();
    },

    async renderPermissions(container) {
        const isAdmin = Auth.can('parametres', 3);
        const overrides = await Auth.loadPermissions();
        const roles = await Auth.getAllRoles();

        const levelOptions = [
            { value: 0, label: 'Aucun' },
            { value: 1, label: 'Lecture' },
            { value: 2, label: 'Ecriture' },
            { value: 3, label: 'Total' }
        ];

        // Valeur effective pour un role/module (default + override base)
        const valueFor = (role, mod) => {
            const base = (Auth.DEFAULT_PERMISSIONS[role] && Auth.DEFAULT_PERMISSIONS[role][mod]) || 0;
            return (overrides[role] && overrides[role][mod] !== undefined) ? overrides[role][mod] : base;
        };

        const isCustom = (role) => !!overrides[role];

        let html = `
            <div class="toolbar" style="margin-bottom:12px">
                <div class="toolbar-left">
                    <h3 style="font-size:14px;color:var(--text-secondary)">Niveaux d'acces par role et par module (0: aucun, 1: lecture, 2: ecriture, 3: total)</h3>
                </div>
                <div class="toolbar-right">
                    ${isAdmin ? '<button class="btn btn-outline" onclick="parametresModule.showAddRoleForm()">+ Ajouter un rôle</button>' : ''}
                    <button class="btn btn-outline" onclick="parametresModule.resetPermissions()">Retablir les defauts</button>
                    ${isAdmin ? '<button class="btn btn-primary" onclick="parametresModule.savePermissions()">Enregistrer les permissions</button>' : ''}
                </div>
            </div>
            <div class="card">
                <div class="table-container permissions-matrix"><table class="permissions-tbl">
                    <thead><tr><th>Module</th>${roles.map(r => `<th>${r.nom}${isCustom(r.key) ? ' *' : ''}</th>`).join('')}</tr></thead>
                    <tbody>
                    ${Auth.MODULES.map(m => {
                        const mod = m[0], label = m[1];
                        return `<tr>
                            <td><strong>${label}</strong></td>
                            ${roles.map(r => {
                                const v = valueFor(r.key, mod);
                                return `<td>
                                    <select data-role="${r.key}" data-module="${mod}" ${isAdmin ? '' : 'disabled'} style="padding:4px;border:1px solid var(--border);border-radius:4px">
                                        ${levelOptions.map(l => `<option value="${l.value}" ${v === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
                                    </select>
                                </td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table></div>
            </div>
            <div style="margin-top:12px">
                <h3 style="font-size:14px;color:var(--text-secondary);margin-bottom:6px">Rôles personnalises</h3>
                ${roles.filter(r => r.isCustom).length === 0
                    ? '<p style="font-size:12px;color:var(--text-secondary)">Aucun rôle personnalise. Cliquez sur "+ Ajouter un rôle".</p>'
                    : roles.filter(r => r.isCustom).map(r => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;max-width:480px">
                            <span><strong>${r.nom}</strong> <span style="color:var(--text-secondary);font-size:12px">(${r.key})</span></span>
                            ${isAdmin ? `<button class="btn btn-sm btn-danger" onclick="parametresModule.removeRole('${r.key}')">Supprimer</button>` : ''}
                        </div>`).join('')}
            </div>
            ${Object.keys(overrides).length ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:8px">* Role avec des permissions personnalisees enregistrees.</p>' : ''}
        `;
        container.innerHTML = html;
    },

    showAddRoleForm() {
        UI.showModal('Ajouter un rôle', `
            <div class="form-group">
                <label>Nom du rôle</label>
                <input type="text" id="new-role-nom" placeholder="Ex : Surveillant, Comptable, etc." style="width:100%">
            </div>
        `, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="parametresModule.saveAddRole()">Creer</button>
        `);
    },

    async saveAddRole() {
        const nom = document.getElementById('new-role-nom').value;
        const res = await Auth.addRole(nom);
        if (!res.success) { UI.toast(res.message, 'error'); return; }
        UI.toast(`Rôle "${nom}" cree (${res.key})`, 'success');
        await Auth.log('Creation', 'parametres', `Role ${res.key} (${nom})`);
        UI.hideModal();
        this.renderTab();
    },

    async removeRole(key) {
        const ok = await UI.confirm('Supprimer ce rôle personnalise ?');
        if (!ok) return;
        const res = await Auth.deleteRole(key);
        if (!res.success) { UI.toast(res.message, 'error'); return; }
        UI.toast('Rôle supprime', 'success');
        await Auth.log('Suppression', 'parametres', `Role ${key}`);
        this.renderTab();
    },

    async savePermissions() {
        const selects = document.querySelectorAll('#params-content select[data-role][data-module]');
        const grouped = {};
        selects.forEach(sel => {
            const { role, module } = sel.dataset;
            if (!grouped[role]) grouped[role] = {};
            grouped[role][module] = Number(sel.value);
        });

        const overrides = await Auth.loadPermissions();
        for (const [role, perms] of Object.entries(grouped)) {
            const merged = Object.assign({}, Auth.DEFAULT_PERMISSIONS[role] || {}, overrides[role] || {}, perms);
            await DB.put('permissions', { id: role, role, permissions: merged, date: new Date().toISOString() });
        }

        await Auth.refreshPermissions();
        UI.toast('Permissions enregistrees', 'success');
        await Auth.log('Modification', 'parametres', 'Permissions des roles');
        this.renderTab();
    },

    async resetPermissions() {
        const ok = await UI.confirm('Retablir les permissions par defaut pour tous les roles ?');
        if (!ok) return;
        const overrides = await Auth.loadPermissions();
        for (const role of Object.keys(overrides)) {
            await DB.delete('permissions', role);
        }
        await Auth.refreshPermissions();
        UI.toast('Permissions par defaut retablies', 'success');
        await Auth.log('Modification', 'parametres', 'Retablissement permissions defaut');
        this.renderTab();
    },

    async renderSauvegarde(container) {
        const s = await AutoBackup.getSettings();
        const last = await Meta.getParametre('auto_backup_last');
        const locationLabel = s.path || 'Téléchargements (dossier par défaut du navigateur)';
        const supportsDir = !!window.showDirectoryPicker;

        container.innerHTML = `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>Sauvegarde manuelle</h3></div>
                    <p style="color:var(--text-secondary);margin-bottom:16px">Exportez toutes les donnees de l'application dans un fichier JSON. Ce fichier permet de restaurer ou de transferer les donnees.</p>
                    <button class="btn btn-primary" onclick="parametresModule.doBackup()">&#11015; Effectuer une sauvegarde</button>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Restauration</h3></div>
                    <p style="color:var(--text-secondary);margin-bottom:12px">Importez un fichier de sauvegarde JSON pour restaurer toutes les donnees de l'application.</p>
                    <div id="restore-section">
                        <label for="restore-file" class="btn btn-outline" style="cursor:pointer;margin-bottom:12px">&#128194; Choisir un fichier de sauvegarde (.json)</label>
                        <input type="file" id="restore-file" accept=".json" style="display:none" onchange="parametresModule.previewBackup(this.files[0])">
                        <div id="restore-preview" style="display:none;border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px;background:var(--bg)"></div>
                        <div id="restore-actions" style="display:none;margin-bottom:12px">
                            <button class="btn btn-danger" onclick="parametresModule.doRestoreConfirmed()">&#128260; Restaurer cette sauvegarde</button>
                        </div>
                        <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Attention : la restauration remplacera definitivement toutes les donnees actuelles. Il est recommande d'effectuer une sauvegarde avant de restaurer.</p>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Stockage du navigateur</h3></div>
                <div id="storage-info" style="padding:10px 16px 14px;color:var(--text-secondary);font-size:14px;line-height:1.7">
                    Chargement...
                </div>
                <div style="padding:0 16px 14px">
                    <button class="btn btn-outline" onclick="parametresModule.refreshStorage()">&#8635; Actualiser</button>
                    <button class="btn btn-outline" onclick="parametresModule.requestPersistence()">&#128274; Activer le stockage persistant</button>
                </div>
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Export Excel</h3></div>
                <p style="color:var(--text-secondary);margin-bottom:16px">Exportez une vue d'ensemble des donnees au format CSV.</p>
                <button class="btn btn-outline" onclick="parametresModule.exportPatients()">Exporter les patients</button>
                <button class="btn btn-outline" onclick="parametresModule.exportConsultations()">Exporter les consultations</button>
                <button class="btn btn-outline" onclick="parametresModule.exportFactures()">Exporter les factures</button>
                <button class="btn btn-outline" onclick="parametresModule.exportMedicaments()">Exporter les medicaments</button>
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Sauvegarde automatique</h3></div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="auto-backup-enabled" ${s.enabled ? 'checked' : ''}>
                        Activer la sauvegarde automatique
                    </label>
                </div>
                <div class="form-group">
                    <label>Periode de sauvegarde</label>
                    <div style="display:flex;gap:10px;align-items:center">
                        <input type="number" id="auto-backup-value" min="1" value="${s.value}" style="width:90px">
                        <select id="auto-backup-unit" style="padding:8px;border:1px solid var(--border);border-radius:6px">
                            ${['minutes', 'heures', 'jours', 'semaines', 'mois'].map(u => `<option value="${u}" ${s.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Emplacement de sauvegarde</label>
                    <p style="margin:4px 0;color:var(--text-primary)">${locationLabel}</p>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
                        ${supportsDir ? '<button class="btn btn-outline" onclick="parametresModule.chooseAutoDir()">Choisir un dossier...</button>' : ''}
                        ${s.locationEnabled ? '<button class="btn btn-outline" onclick="parametresModule.clearAutoDir()">Revenir aux téléchargements</button>' : ''}
                    </div>
                    ${!supportsDir ? '<p style="font-size:12px;color:var(--text-secondary);margin-top:6px">Le choix de dossier necessite Chrome ou Edge. Sans cela, la sauvegarde est telechargee dans le dossier par defaut du navigateur.</p>' : ''}
                </div>
                <div class="form-group">
                    ${last ? `<p style="color:var(--text-secondary);font-size:13px">Derniere sauvegarde: ${new Date(parseInt(last, 10)).toLocaleString('fr-FR')}</p>` : '<p style="color:var(--text-secondary);font-size:13px">Aucune sauvegarde automatique effectuee pour le moment.</p>'}
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="parametresModule.saveAutoBackup()">Enregistrer</button>
                    <button class="btn btn-outline" onclick="parametresModule.doAutoBackupNow()">Effectuer une sauvegarde maintenant</button>
                </div>
            </div>
            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Notes</h3></div>
                <ul style="margin:10px 0 0;padding-left:20px;line-height:1.8;color:var(--text-secondary);font-size:14px">
                    <li>La sauvegarde automatique s'effectue pendant que l'application est ouverte et au lancement si la periode est depassee.</li>
                    <li>Les donnees restent stockees localement dans le navigateur (IndexedDB). Conservez vos fichers de sauvegarde dans un endroit sur.</li>
                    <li>La sauvegarde manuelle, la restauration et les exports CSV sont disponibles dans cet onglet <strong>Parametres &gt; Sauvegarde</strong>.</li>
                </ul>
            </div>
        `;
        this.refreshStorage();
    },

    async saveAutoBackup() {
        const enabled = document.getElementById('auto-backup-enabled').checked;
        const value = parseInt(document.getElementById('auto-backup-value').value, 10);
        const unit = document.getElementById('auto-backup-unit').value;
        if (enabled && (!value || value < 1)) { UI.toast('Veuillez saisir une periode valide', 'error'); return; }

        await Meta.setParametre('auto_backup_enabled', String(enabled));
        await Meta.setParametre('auto_backup_period_value', String(value || 24));
        await Meta.setParametre('auto_backup_period_unit', unit || 'heures');

        await AutoBackup.init();
        UI.toast(enabled ? 'Sauvegarde automatique activee' : 'Sauvegarde automatique desactivee', 'success');
        await Auth.log('Modification', 'parametres', `Sauvegarde auto ${enabled ? 'activee' : 'desactivee'} (${value || 24} ${unit || 'heures'})`);
        this.renderTab();
    },

    async chooseAutoDir() {
        const ok = await AutoBackup.chooseDirectory();
        if (ok) UI.toast('Emplacement de sauvegarde mis a jour', 'success');
        this.renderTab();
    },

    async clearAutoDir() {
        await AutoBackup.clearLocation();
        UI.toast('Emplacement de sauvegarde ramene aux telechargements', 'success');
        this.renderTab();
    },

    async doAutoBackupNow() {
        await AutoBackup.runBackup(false);
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

    async doBackup() {
        await Storage.backup();
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

window.parametresModule = parametresModule;
