const servicesModule = {
    async show() {
        UI.setPageTitle('Services & Lits');
        const container = document.getElementById('content-area');
        const services = await DB.getAll('services');
        const lits = await DB.getAll('lits');

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9881;', services.filter(s => s.actif).length, 'Services actifs', 'blue')}
                ${UI.renderStatCard('&#9829;', lits.filter(l => l.statut === 'Libre').length, 'Lits disponibles', 'green')}
                ${UI.renderStatCard('&#9829;', lits.filter(l => l.statut === 'Occupe').length, 'Lits occupes', 'red')}
                ${UI.renderStatCard('&#9881;', lits.filter(l => l.statut === 'Maintenance').length, 'Maintenance', 'orange')}
            </div>

            ${Auth.can('services', 3) ? '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="servicesModule.showServiceForm()">+ Nouveau Service</button> <button class="btn btn-outline" onclick="servicesModule.printEtat()">&#128424; Etat des lits</button></div>' : ''}

            <div class="card">
                <div class="card-header"><h3>Services</h3></div>
                ${UI.renderTable([
                    { field: 'nom', label: 'Nom', render: (v) => `<strong>${v}</strong>` },
                    { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, v === 'Chirurgical' ? 'danger' : v === 'Medico-technique' ? 'purple' : 'info') },
                    { field: 'localisation', label: 'Localisation', render: (v) => v || '-' },
                    { label: 'Lits (Total)', render: (v, row) => lits.filter(l => l.serviceId === row.id).length },
                    { label: 'Occupes', render: (v, row) => lits.filter(l => l.serviceId === row.id && l.statut === 'Occupe').length },
                    { label: 'Disponibles', render: (v, row) => lits.filter(l => l.serviceId === row.id && l.statut === 'Libre').length },
                    { field: 'actif', label: 'Statut', render: (v) => UI.renderBadge(v ? 'Actif' : 'Inactif', v ? 'success' : 'gray') }
                ], services, {
                    actions: Auth.can('services', 3),
                    renderActions: (row) => `
                        <button class="btn-icon" title="Modifier le service" onclick="servicesModule.showEditServiceForm('${row.id}')">&#9998;</button>
                        <button class="btn-icon" title="Supprimer le service" onclick="servicesModule.deleteService('${row.id}')">&#128465;</button>
                    `
                })}
            </div>

            <div class="card" style="margin-top:16px">
                <div class="card-header"><h3>Plan des lits</h3></div>
                ${this.renderLitsGrid(services, lits)}
            </div>
        `;

        container.innerHTML = html;
    },

    renderLitsGrid(services, lits) {
        const canManage = Auth.can('services', 3);
        let html = '';
        services.filter(s => s.actif).forEach(svc => {
            const svcLits = lits.filter(l => l.serviceId === svc.id);
            if (svcLits.length === 0) return;

            html += `<h4 style="margin:12px 0 8px">${svc.nom}</h4><div class="bed-grid">`;
            svcLits.forEach(lit => {
                const cls = lit.statut === 'Libre' ? 'bed-free' : lit.statut === 'Occupe' ? 'bed-occupied' : 'bed-maintenance';
                const action = canManage && lit.statut !== 'Occupe'
                    ? ` onclick="servicesModule.toggleMaintenance('${lit.id}')" style="cursor:pointer" title="${lit.numero} - ${lit.statut}. Cliquer pour ${lit.statut === 'Maintenance' ? 'remettre en service' : 'mettre en maintenance'}"`
                    : ` title="${lit.numero} - ${lit.statut}"`;
                html += `<div class="bed-item ${cls}"${action}>
                    ${lit.numero}<br><small>${lit.statut}</small>
                </div>`;
            });
            html += '</div>';
        });
        return html || '<p style="color:var(--text-secondary)">Aucun lit configure.</p>';
    },

    async toggleMaintenance(litId) {
        const lit = await DB.get('lits', litId);
        if (!lit) return;
        if (lit.statut === 'Occupe') { UI.toast('Lit occupe, impossible de changer', 'error'); return; }
        lit.statut = lit.statut === 'Maintenance' ? 'Libre' : 'Maintenance';
        await DB.put('lits', lit);
        UI.toast('Lit ' + (lit.statut === 'Maintenance' ? 'mis en maintenance' : 'remis en service'), 'success');
        this.show();
    },

    async showServiceForm() {
        const formHtml = UI.buildForm([
            { name: 'nom', label: 'Nom du service', required: true },
            { name: 'type', label: 'Type', type: 'select', required: true, options: [
                { value: 'Medical', label: 'Medical' }, { value: 'Chirurgical', label: 'Chirurgical' }, { value: 'Medico-technique', label: 'Medico-technique' }, { value: 'Administratif', label: 'Administratif' }
            ]},
            { name: 'localisation', label: 'Localisation', placeholder: 'Batiment, etage...' }
        ]);
        UI.showModal('Nouveau Service', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="servicesModule.saveService()">Enregistrer</button>
        `);
    },

    async saveService() {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.nom) { UI.toast('Nom requis', 'error'); return; }
        data.id = DB.generateId();
        data.actif = true;
        await DB.put('services', data);
        Cache.invalidate('services');
        UI.toast('Service cree', 'success');
        UI.hideModal();
        this.show();
    },

    async showEditServiceForm(id) {
        const svc = await DB.get('services', id);
        if (!svc) return;
        const formHtml = UI.buildForm([
            { name: 'nom', label: 'Nom du service', required: true },
            { name: 'type', label: 'Type', type: 'select', required: true, options: [
                { value: 'Medical', label: 'Medical' }, { value: 'Chirurgical', label: 'Chirurgical' }, { value: 'Medico-technique', label: 'Medico-technique' }, { value: 'Administratif', label: 'Administratif' }
            ]},
            { name: 'localisation', label: 'Localisation', placeholder: 'Batiment, etage...' },
            { name: 'actif', label: 'Statut', type: 'select', options: [{ value: '1', label: 'Actif' }, { value: '0', label: 'Inactif' }] }
        ], Object.assign({}, svc, { actif: svc.actif ? '1' : '0' }));
        UI.showModal('Modifier le Service', formHtml, `
            <button class="btn btn-outline" onclick="UI.hideModal()">Annuler</button>
            <button class="btn btn-primary" onclick="servicesModule.saveEditService('${id}')">Enregistrer</button>
        `);
    },

    async saveEditService(id) {
        const form = document.querySelector('.modal-body');
        const data = UI.getFormData(form);
        if (!data.nom) { UI.toast('Nom requis', 'error'); return; }
        const svc = await DB.get('services', id);
        if (!svc) return;
        svc.nom = data.nom;
        svc.type = data.type;
        svc.localisation = data.localisation || '';
        svc.actif = data.actif === '1' || data.actif === true;
        await DB.put('services', svc);
        Cache.invalidate('services');
        UI.toast('Service modifie', 'success');
        await Auth.log('Modification', 'services', `Service ${svc.nom}`);
        UI.hideModal();
        this.show();
    },

    async deleteService(id) {
        const svc = await DB.get('services', id);
        if (!svc) return;
        const lits = await DB.getAll('lits');
        const svcLits = lits.filter(l => l.serviceId === id);
        if (svcLits.length) {
            UI.toast(`Impossible de supprimer : ce service contient ${svcLits.length} lit(s)`, 'error');
            return;
        }
        const ok = await UI.confirm(`Supprimer le service "${svc.nom}" ?`);
        if (!ok) return;
        await DB.delete('services', id);
        Cache.invalidate('services');
        UI.toast('Service supprime', 'success');
        await Auth.log('Suppression', 'services', `Service ${svc.nom}`);
        this.show();
    },

    async printEtat() {
        const [services, lits, hospitalisations] = await Promise.all([DB.getAll('services'), DB.getAll('lits'), DB.getAll('hospitalisations')]);
        const enCours = hospitalisations.filter(h => h.statut === 'EnCours');
        const getHosp = (litId) => enCours.find(h => h.litId === litId);

        const rows = lits.map(lit => {
            const svc = services.find(s => s.id === lit.serviceId);
            const hosp = getHosp(lit.id);
            return `<tr>
                <td>${svc ? svc.nom : '-'}</td><td>${lit.numero || '-'}</td><td>${lit.salleId || '-'}</td>
                <td>${lit.statut}</td><td>${lit.type || '-'}</td><td style="text-align:right">${UI.formatMoney(lit.jourCout)}</td><td>${hosp ? hosp.id.slice(-6).toUpperCase() : '-'}</td>
            </tr>`;
        }).join('');

        const total = lits.length;
        const libres = lits.filter(l => l.statut === 'Libre').length;
        const occupes = lits.filter(l => l.statut === 'Occupe').length;
        const maint = lits.filter(l => l.statut === 'Maintenance').length;

        const body = `
            <div class="print-title">ETAT DES LITS</div>
            <p style="margin:4px 0">Total: <strong>${total}</strong> | Libres: <strong>${libres}</strong> | Occupes: <strong>${occupes}</strong> | Maintenance: <strong>${maint}</strong></p>
            <table>
                <thead><tr><th>Service</th><th>Lit</th><th>Salle</th><th>Statut</th><th>Type</th><th style="text-align:right">Jour cout</th><th>Hospitalisation</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="7">Aucun lit</td></tr>'}</tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">L'administration</span></div>
                <div><span class="line">La direction des soins</span></div>
            </div>
        `;
        await Print.open('Etat des lits', body);
    },

    cleanup() {}
};

window.servicesModule = servicesModule;
