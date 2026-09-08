const dashboardModule = {
    async show() {
        UI.setPageTitle('Tableau de bord');
        const container = document.getElementById('content-area');

        const [patients, admissions, hospitalisations, urgences, factures, paiements, lits, services, personnel, consultations] = await Promise.all([
            DB.getAll('patients'),
            DB.getAll('admissions'),
            DB.getAll('hospitalisations'),
            DB.getAll('urgences'),
            DB.getAll('factures'),
            DB.getAll('paiements'),
            DB.getAll('lits'),
            DB.getAll('services'),
            DB.getAll('personnel'),
            DB.getAll('consultations')
        ]);

        const patientsActifs = patients.length;
        const admissionsToday = admissions.filter(a => new Date(a.dateAdmission).toDateString() === new Date().toDateString()).length;
        const patientsHospitalises = hospitalisations.filter(h => h.statut === 'EnCours').length;
        const urgencesEnAttente = urgences.filter(u => u.statut === 'EnAttente').length;
        const litsOccupes = lits.filter(l => l.statut === 'Occupe').length;
        const litsTotal = lits.length;
        const tauxOccupation = litsTotal > 0 ? Math.round((litsOccupes / litsTotal) * 100) : 0;
        const totalFactures = factures.reduce((s, f) => s + (f.montantTotal || 0), 0);
        const totalEncaisse = paiements.reduce((s, p) => s + (p.montant || 0), 0);
        const totalPayeFactures = factures.reduce((s, f) => s + (f.montantPaye || 0), 0);
        const totalImpaye = Math.max(totalFactures - totalPayeFactures, 0);

        const recentAdmissions = [...admissions].sort((a, b) => new Date(b.dateAdmission) - new Date(a.dateAdmission)).slice(0, 5);
        const recentUrgences = [...urgences].sort((a, b) => new Date(b.dateArrivee) - new Date(a.dateArrivee)).slice(0, 5);

        const patName = (id) => { const p = patients.find(x => x.id === id); return p ? `${p.prenom} ${p.nom}` : id; };
        const enrichedAdmissions = recentAdmissions.map(a => ({ ...a, patientNom: patName(a.patientId) }));
        const enrichedUrgences = recentUrgences.map(u => ({ ...u, patientNom: patName(u.patientId) }));

        const moisAdmissions = this.countByMonth(admissions, 'dateAdmission');
        const moisConsultations = this.countByMonth(consultations, 'dateConsultation');
        const moisRevenus = this.sumsByMonth(paiements, 'date', 'montant');

        const serviceAdmissions = services.filter(s => s.actif).map(svc => {
            return { label: svc.nom, value: admissions.filter(a => a.serviceId === svc.id).length };
        });

        let html = `
            <div class="stats-grid">
                ${UI.renderStatCard('&#9787;', patientsActifs, 'Patients enregistres', 'blue')}
                ${UI.renderStatCard('&#9992;', admissionsToday, 'Admissions aujourd\'hui', 'green')}
                ${UI.renderStatCard('&#9829;', patientsHospitalises, 'Hospitalises', 'red')}
                ${UI.renderStatCard('&#9888;', urgencesEnAttente, 'Urgences en attente', 'orange')}
            </div>
            <div class="stats-grid">
                ${UI.renderStatCard('&#9881;', `${tauxOccupation}%`, `Occupation lits (${litsOccupes}/${litsTotal})`, tauxOccupation > 80 ? 'red' : 'blue')}
                ${UI.renderStatCard('&#9830;', UI.formatMoney(totalFactures), 'Total factures', 'purple')}
                ${UI.renderStatCard('&#10003;', UI.formatMoney(totalEncaisse), 'Total encaisse', 'green')}
                ${UI.renderStatCard('&#10007;', UI.formatMoney(totalImpaye), 'Impayes', 'red')}
            </div>

            <div class="chart-grid">
                <div class="card">
                    <div class="card-header"><h3>Admissions & Consultations (6 derniers mois)</h3></div>
                    <div class="chart-container"><canvas id="chart-activite" height="280"></canvas></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Admissions par service</h3></div>
                    <div class="chart-container" style="height:280px"><canvas id="chart-services"></canvas></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>Revenus encaisses (6 derniers mois)</h3></div>
                <div class="chart-container"><canvas id="chart-revenus" height="240"></canvas></div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3>Admissions recentes</h3>
                    </div>
                    ${UI.renderTable([
                        { field: 'patientNom', label: 'Patient', render: (v) => `<strong>${v}</strong>` },
                        { field: 'dateAdmission', label: 'Date', render: (v) => UI.formatDate(v) },
                        { field: 'type', label: 'Type', render: (v) => UI.renderBadge(v, 'info') },
                        { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v === 'EnCours' ? 'En cours' : v, v === 'EnCours' ? 'warning' : 'success') }
                    ], enrichedAdmissions, { actions: false })}
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3>Urgences recentes</h3>
                    </div>
                    ${UI.renderTable([
                        { field: 'patientNom', label: 'Patient', render: (v) => `<strong>${v}</strong>` },
                        { field: 'motif', label: 'Motif', render: (v) => v },
                        { field: 'niveauTriage', label: 'Triage', render: (v) => UI.renderBadge(`N${v}`, `urgency-${v}`) },
                        { field: 'statut', label: 'Statut', render: (v) => UI.renderBadge(v === 'EnAttente' ? 'En attente' : v, v === 'EnAttente' ? 'danger' : 'success') }
                    ], enrichedUrgences, { actions: false })}
                </div>
            </div>

            <div class="card" style="margin-top:16px;">
                <div class="card-header">
                    <h3>Occupation par service</h3>
                </div>
                ${this.renderServiceOccupation(services, lits, hospitalisations)}
            </div>
        `;

        container.innerHTML = html;

        this.moisData = {
            labels: moisAdmissions.labels,
            admissions: moisAdmissions.counts,
            consultations: moisConsultations.counts,
            revenus: moisRevenus.counts
        };

        requestAnimationFrame(() => {
            Charts.createBarChart('chart-activite', moisAdmissions.labels, [
                { label: 'Admissions', data: moisAdmissions.counts, color: '#1a73e8' },
                { label: 'Consultations', data: moisConsultations.counts, color: '#8430ce' }
            ], { showValues: true });

            const svcLabels = serviceAdmissions.map(s => s.label);
            const svcValues = serviceAdmissions.map(s => s.value);
            Charts.createDoughnutChart('chart-services', svcLabels, svcValues);

            Charts.createLineChart('chart-revenus', moisRevenus.labels, [
                { label: 'Revenus', data: moisRevenus.counts, color: '#1e8e3e' }
            ]);
        });
    },

    countByMonth(items, dateField) {
        const months = [];
        const counts = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('fr-FR', { month: 'short' });
            months.push(label);
            const count = items.filter(item => {
                const itemDate = new Date(item[dateField]);
                return itemDate.getFullYear() === d.getFullYear() && itemDate.getMonth() === d.getMonth();
            }).length;
            counts.push(count);
        }
        return { labels: months, counts };
    },

    sumsByMonth(items, dateField, amountField) {
        const months = [];
        const counts = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('fr-FR', { month: 'short' });
            months.push(label);
            const sum = items.filter(item => {
                const itemDate = new Date(item[dateField]);
                return itemDate.getFullYear() === d.getFullYear() && itemDate.getMonth() === d.getMonth();
            }).reduce((s, item) => s + (item[amountField] || 0), 0);
            counts.push(Math.round(sum));
        }
        return { labels: months, counts };
    },

    renderServiceOccupation(services, lits, hospitalisations) {
        let html = '<div class="table-container"><table><thead><tr><th>Service</th><th>Lits</th><th>Occupes</th><th>Disponibles</th><th>Taux</th></tr></thead><tbody>';
        services.filter(s => s.actif).forEach(svc => {
            const svcLits = lits.filter(l => l.serviceId === svc.id);
            const ocupados = svcLits.filter(l => l.statut === 'Occupe').length;
            const total = svcLits.length;
            const pct = total > 0 ? Math.round((ocupados / total) * 100) : 0;
            const color = pct > 80 ? 'red' : pct > 50 ? 'orange' : 'green';
            html += `<tr>
                <td><strong>${svc.nom}</strong></td>
                <td>${total}</td>
                <td>${ocupados}</td>
                <td>${total - ocupados}</td>
                <td style="min-width:150px">${UI.renderProgressBar(pct, 100, color)} <small>${pct}%</small></td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        return html;
    },

    cleanup() {}
};

window.dashboardModule = dashboardModule;
