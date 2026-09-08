const reportingModule = {
    periode: '30d',

    getPeriodeLabel() {
        return { '7d': '7 derniers jours', '30d': '30 derniers jours', '90d': '90 derniers jours', '365d': '12 mois' }[this.periode] || 'periode selectionnee';
    },

    async show() {
        UI.setPageTitle('Reporting & Statistiques');
        const container = document.getElementById('content-area');

        const [admissions, consultations, urgences, hospitalisations, factures, paiements, patients, services] = await Promise.all([
            DB.getAll('admissions'),
            DB.getAll('consultations'),
            DB.getAll('urgences'),
            DB.getAll('hospitalisations'),
            DB.getAll('factures'),
            DB.getAll('paiements'),
            DB.getAll('patients'),
            DB.getAll('services')
        ]);

        const now = new Date();
        const periodeMs = this.periode === '7d' ? 7 : this.periode === '30d' ? 30 : this.periode === '90d' ? 90 : 365;
        const debut = new Date(now.getTime() - periodeMs * 86400000);

        const inPeriode = (dateStr) => new Date(dateStr) >= debut;

        const admissionsPer = admissions.filter(a => inPeriode(a.dateAdmission)).length;
        const consultsPer = consultations.filter(c => inPeriode(c.dateConsultation)).length;
        const urgPer = urgences.filter(u => inPeriode(u.dateArrivee)).length;
        const hospPer = hospitalisations.filter(h => inPeriode(h.dateEntree)).length;
        const revenusPer = paiements.filter(p => inPeriode(p.date)).reduce((s, p) => s + p.montant, 0);
        const factPer = factures.filter(f => inPeriode(f.date)).reduce((s, f) => s + f.montantTotal, 0);
        const encaissePer = factures.filter(f => inPeriode(f.date)).reduce((s, f) => s + (f.montantPaye || 0), 0);

        const totalPayeTous = paiements.reduce((s, p) => s + p.montant, 0);

        let html = `
            <div class="toolbar">
                <div class="toolbar-left"><h3 style="font-size:14px;color:var(--text-secondary)">Activite des ${this.getPeriodeLabel()}</h3></div>
                <div class="toolbar-right">
                    <select id="reporting-periode" onchange="reportingModule.changePeriode(this.value)" style="padding:8px;border:1px solid var(--border);border-radius:4px">
                        <option value="7d" ${this.periode === '7d' ? 'selected' : ''}>7 jours</option>
                        <option value="30d" ${this.periode === '30d' ? 'selected' : ''}>30 jours</option>
                        <option value="90d" ${this.periode === '90d' ? 'selected' : ''}>90 jours</option>
                        <option value="365d" ${this.periode === '365d' ? 'selected' : ''}>12 mois</option>
                    </select>
                    <button class="btn btn-outline" onclick="reportingModule.exportCSV()">Exporter CSV</button>
                    <button class="btn btn-outline" onclick="reportingModule.printRapport()">&#128424; Imprimer</button>
                </div>
            </div>

            <div class="stats-grid">
                ${UI.renderStatCard('&#9992;', admissionsPer, 'Admissions', 'blue')}
                ${UI.renderStatCard('&#9998;', consultsPer, 'Consultations', 'purple')}
                ${UI.renderStatCard('&#9888;', urgPer, 'Urgences', 'red')}
                ${UI.renderStatCard('&#9829;', hospPer, 'Hospitalisations', 'orange')}
            </div>
            <div class="stats-grid">
                ${UI.renderStatCard('&#9830;', UI.formatMoney(factPer), 'Facturation', 'green')}
                ${UI.renderStatCard('&#10003;', UI.formatMoney(encaissePer), 'Encaissement', 'blue')}
                ${UI.renderStatCard('&#10007;', UI.formatMoney(factPer - encaissePer), 'Impayes', 'red')}
                ${UI.renderStatCard('&#9787;', patients.length, 'Total patients', 'gray')}
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>Activite par service</h3></div>
                    <div class="table-container"><table><thead><tr><th>Service</th><th>Admissions</th><th>Consultations</th></tr></thead><tbody>
                    ${services.filter(s => s.actif).map(svc => {
                        const adm = admissions.filter(a => a.serviceId === svc.id).length;
                        const cons = consultations.filter(c => c.serviceId === svc.id).length;
                        return `<tr><td><strong>${svc.nom}</strong></td><td>${adm}</td><td>${cons}</td></tr>`;
                    }).join('')}
                    </tbody></table></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Statut des paiements</h3></div>
                    ${this.renderPaiementSummary(factures)}
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    renderPaiementSummary(factures) {
        const terminees = factures.filter(f => f.statut === 'EntierementPayee').length;
        const partielles = factures.filter(f => f.statut === 'PartiellementPayee').length;
        const employees = factures.filter(f => f.statut === 'Impayee').length;
        const total = factures.length || 1;

        return `
            <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span>Factures entierement payees</span> <strong>${terminees}</strong>
                </div>
                ${UI.renderProgressBar(terminees, total, 'green')}
            </div>
            <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span>Partiellement payees</span> <strong>${partielles}</strong>
                </div>
                ${UI.renderProgressBar(partielles, total, 'blue')}
            </div>
            <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span>Impayees</span> <strong>${employees}</strong>
                </div>
                ${UI.renderProgressBar(employees, total, 'red')}
            </div>
        `;
    },

    changePeriode(value) {
        this.periode = value;
        this.show();
    },

    async printRapport() {
        const [admissions, consultations, urgences, hospitalisations, factures, paiements, patients, services] = await Promise.all([
            DB.getAll('admissions'), DB.getAll('consultations'), DB.getAll('urgences'),
            DB.getAll('hospitalisations'), DB.getAll('factures'), DB.getAll('paiements'),
            DB.getAll('patients'), DB.getAll('services')
        ]);

        const now = new Date();
        const periodeMs = this.periode === '7d' ? 7 : this.periode === '30d' ? 30 : this.periode === '90d' ? 90 : 365;
        const debut = new Date(now.getTime() - periodeMs * 86400000);
        const inPeriode = (d) => new Date(d) >= debut;

        const s = (arr, fn) => arr.filter(x => inPeriode(fn(x))).length;
        const revenusPer = paiements.filter(p => inPeriode(p.date)).reduce((a, p) => a + p.montant, 0);
        const factPer = factures.filter(f => inPeriode(f.date)).reduce((a, f) => a + f.montantTotal, 0);
        const encPer = factures.filter(f => inPeriode(f.date)).reduce((a, f) => a + (f.montantPaye || 0), 0);
        const payees = factures.filter(f => f.statut === 'EntierementPayee').length;
        const partielles = factures.filter(f => f.statut === 'PartiellementPayee').length;
        const impayees = factures.filter(f => f.statut === 'Impayee').length;

        const svcRows = services.filter(x => x.actif).map(svc => `<tr>
            <td><strong>${svc.nom}</strong></td>
            <td>${admissions.filter(a => a.serviceId === svc.id).length}</td>
            <td>${consultations.filter(c => c.serviceId === svc.id).length}</td>
        </tr>`).join('');

        const body = `
            <div class="print-title">RAPPORT D'ACTIVITE - ${this.getPeriodeLabel().toUpperCase()}</div>
            <table>
                <tbody>
                <tr><th>Admissions</th><td>${s(admissions, a => a.dateAdmission)}</td><th>Consultations</th><td>${s(consultations, c => c.dateConsultation)}</td></tr>
                <tr><th>Urgences</th><td>${s(urgences, u => u.dateArrivee)}</td><th>Hospitalisations</th><td>${s(hospitalisations, h => h.dateEntree)}</td></tr>
                <tr><th>Facturation</th><td>${UI.formatMoney(factPer)}</td><th>Encaissements</th><td>${UI.formatMoney(revenusPer)}</td></tr>
                <tr><th>Impayes (periode)</th><td>${UI.formatMoney(factPer - encPer)}</td><th>Total patients</th><td>${patients.length}</td></tr>
                </tbody>
            </table>
            <h4 style="margin:14px 0 6px">Activite par service</h4>
            <table>
                <thead><tr><th>Service</th><th>Admissions</th><th>Consultations</th></tr></thead>
                <tbody>${svcRows || '<tr><td colspan="3">Aucun service</td></tr>'}</tbody>
            </table>
            <h4 style="margin:14px 0 6px">Statut des paiements</h4>
            <table>
                <tbody>
                <tr><th>Entierement payees</th><td>${payees}</td></tr>
                <tr><th>Partiellement payees</th><td>${partielles}</td></tr>
                <tr><th>Impayees</th><td>${impayees}</td></tr>
                </tbody>
            </table>
            <div class="print-sign">
                <div><span class="line">Le Directeur</span></div>
                <div><span class="line">Le service comptabilite</span></div>
            </div>
        `;
        await Print.open('Rapport d\'activite - ' + this.getPeriodeLabel(), body);
    },

    async exportCSV() {
        const factures = await DB.getAll('factures');
        const patients = await DB.getAll('patients');

        const headers = ['Patient', 'Date', 'Total', 'Paye', 'Reste', 'Mode', 'Statut'];
        const rows = factures.map(f => {
            const p = patients.find(x => x.id === f.patientId);
            return [p ? `${p.prenom} ${p.nom}` : f.patientId, UI.formatDate(f.date), f.montantTotal, f.montantPaye, f.resteApayer, f.modePaiement, f.statut];
        });

        Excel.exportToCSV(headers, rows, `rapport_factures_${new Date().toISOString().slice(0,10)}`);
    },

    cleanup() {}
};

window.reportingModule = reportingModule;
