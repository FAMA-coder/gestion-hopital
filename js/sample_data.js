const diagnosticsUrgences = ['Traumatisme', 'Fievre typhoide', 'Paludisme severe', 'Crise asthmatique', 'Intoxication alimentaire', 'Brulure thermique', 'Shock hypovolemique', 'Infarctus', 'AVC', 'Fracture'];

const SampleData = {
    async ensureAdmin() {
        const adminHash = Auth.hashPassword('admin123');
        const users = await DB.getAll('users');
        let admin = users.find(u => u.nomUtilisateur === 'admin');
        if (admin) {
            admin.motDePasse = adminHash;
            admin.actif = true;
            admin.role = 'admin';
            await DB.put('users', admin);
            return true;
        }
        await DB.put('users', { id: DB.generateId(), nomUtilisateur: 'admin', motDePasse: adminHash, nomComplet: 'Admin General', role: 'admin', actif: true });
        return true;
    },

    // Compte maître (super administrateur) : cree une seule fois,
    // jamais modifiable ni visible par les autres comptes.
    async ensureMaitre() {
        const users = await DB.getAll('users');
        const maitre = users.find(u => String(u.nomUtilisateur).toUpperCase() === Auth.MASTER_USERNAME);
        if (maitre) {
            // Repare uniquement le role, le statut et le drapeau maître.
            const modifie = !maitre.maitre || maitre.role !== 'admin' || maitre.actif !== true;
            if (modifie) {
                maitre.maitre = true;
                maitre.role = 'admin';
                maitre.actif = true;
                await DB.put('users', maitre);
            }
            return;
        }
        await DB.put('users', {
            id: DB.generateId(),
            nomUtilisateur: Auth.MASTER_USERNAME,
            motDePasse: Auth.hashPassword(Auth.MASTER_PASSWORD),
            nomComplet: 'Super Administrateur',
            role: 'admin',
            maitre: true,
            actif: true
        });
    },

    async seed() {
        const existing = await DB.getAll('users');
        if (existing.length > 0) {
            await this.seedIncremental();
            return;
        }

        const hId = DB.generateId();
        await DB.put('hopital', {
            id: 'current',
            nom: 'Hopital Central de Kinshasa',
            type: 'Public',
            adresse: '123, Av. de la Sante, Kinshasa',
            telephone: '+243 81 234 5678',
            email: 'contact@hck.cd',
            devise: 'FCFA',
            slogan: 'Sante pour tous',
            anneeCreation: 1985
        });

        await this.seedUsers();
        await this.ensureMaitre();
        await this.seedServices();
        await this.seedPersonnel();
        await this.seedSallesEtLits();
        await this.seedTypesExamen();
        await this.seedTarifs();
        await this.seedMedicaments();
        await this.seedPatients();
        await this.seedConsultations();
        await this.seedUrgences();
        await this.seedAdmissions();
        await this.seedHospitalisations();
        await this.seedDemandesExamen();
        await this.seedExamensImagerie();
        await this.seedOperations();
        await this.seedFacturations();
        await this.seedAssurances();
        await this.seedGardes();
        await this.seedRemunerations();
        await this.seedContrats();
        await this.seedDepenses();
        await this.seedOrdonnances();
        await this.seedSuivi();
        await this.seedParametres();

        Logger.info('SampleData', 'Donnees de demonstration chargees');
    },

    async seedUsers() {
        const users = [
            { id: 'um', nomUtilisateur: 'FAMA', motDePasse: Auth.hashPassword('aminatN1FA@'), nomComplet: 'Super Administrateur', role: 'admin', maitre: true, actif: true },
            { id: 'u1', nomUtilisateur: 'admin', motDePasse: Auth.hashPassword('admin123'), nomComplet: 'Admin General', role: 'admin', actif: true },
            { id: 'u2', nomUtilisateur: 'dr_mukendi', motDePasse: Auth.hashPassword('med123'), nomComplet: 'Dr. Mukendi Kasongo', role: 'medecin', serviceId: 'svc1', actif: true },
            { id: 'u3', nomUtilisateur: 'dr_kabila', motDePasse: Auth.hashPassword('med123'), nomComplet: 'Dr. Kabila Tshisekedi', role: 'medecin', serviceId: 'svc2', actif: true },
            { id: 'u4', nomUtilisateur: 'dr_lukusa', motDePasse: Auth.hashPassword('med123'), nomComplet: 'Dr. Lukusa Mbuyi', role: 'medecin', serviceId: 'svc3', actif: true },
            { id: 'u5', nomUtilisateur: 'infirmier1', motDePasse: Auth.hashPassword('inf123'), nomComplet: 'Ntumba Kalala', role: 'infirmier', serviceId: 'svc1', actif: true },
            { id: 'u6', nomUtilisateur: 'pharmacie', motDePasse: Auth.hashPassword('pharm123'), nomComplet: 'Mutombo Tshala', role: 'pharmacien', actif: true },
            { id: 'u7', nomUtilisateur: 'laboratoire', motDePasse: Auth.hashPassword('lab123'), nomComplet: 'Ilunga Kabongo', role: 'laborantin', actif: true },
            { id: 'u8', nomUtilisateur: 'caissier', motDePasse: Auth.hashPassword('cais123'), nomComplet: 'Mwamba Kasongo', role: 'caissier', actif: true },
            { id: 'u9', nomUtilisateur: 'secretaire', motDePasse: Auth.hashPassword('sec123'), nomComplet: 'Kabamba Mwamba', role: 'secretaire', actif: true },
            { id: 'u10', nomUtilisateur: 'dr_chirurgien', motDePasse: Auth.hashPassword('med123'), nomComplet: 'Dr. Ngoy Kabongo', role: 'chirurgien', serviceId: 'svc2', actif: true },
            { id: 'u11', nomUtilisateur: 'radiologue', motDePasse: Auth.hashPassword('rad123'), nomComplet: 'Dr. Tshilombo Kasongo', role: 'radiologue', serviceId: 'svc5', actif: true }
        ];
        await DB.putAll('users', users);
    },

    async seedServices() {
        const services = [
            { id: 'svc1', nom: 'Medecine Interne', type: 'Medical', chefServiceId: 'p1', localisation: 'Batiment A - Etage 1', actif: true },
            { id: 'svc2', nom: 'Chirurgie Generale', type: 'Chirurgical', chefServiceId: 'p2', localisation: 'Batiment B - Etage 1', actif: true },
            { id: 'svc3', nom: 'Pediatrie', type: 'Medical', chefServiceId: 'p3', localisation: 'Batiment A - Etage 2', actif: true },
            { id: 'svc4', nom: 'Maternite', type: 'Medical', chefServiceId: 'p4', localisation: 'Batiment C - Etage 1', actif: true },
            { id: 'svc5', nom: 'Urgences', type: 'Medical', chefServiceId: 'p5', localisation: 'Batiment D - Rez-de-chaussee', actif: true },
            { id: 'svc6', nom: 'Laboratoire', type: 'Medico-technique', chefServiceId: 'p6', localisation: 'Batiment E - Etage 1', actif: true },
            { id: 'svc7', nom: 'Imagerie Medicale', type: 'Medico-technique', chefServiceId: 'p7', localisation: 'Batiment E - Etage 2', actif: true },
            { id: 'svc8', nom: 'Pharmacie', type: 'Medico-technique', chefServiceId: null, localisation: 'Batiment A - Rez-de-chaussee', actif: true },
            { id: 'svc9', nom: 'Reanimation', type: 'Chirurgical', chefServiceId: 'p8', localisation: 'Batiment B - Etage 2', actif: true }
        ];
        await DB.putAll('services', services);
    },

    async seedPersonnel() {
        const personnel = [
            { id: 'p1', matricule: 'MED001', nom: 'Mukendi', prenom: 'Kasongo', sexe: 'M', dateNaissance: '1975-03-15', telephone: '+243811111111', type: 'Medecin', dateEmbauche: '2005-09-01', statut: 'Actif' },
            { id: 'p2', matricule: 'MED002', nom: 'Kabila', prenom: 'Tshisekedi', sexe: 'M', dateNaissance: '1978-07-22', telephone: '+243812222222', type: 'Medecin', dateEmbauche: '2008-01-15', statut: 'Actif' },
            { id: 'p3', matricule: 'MED003', nom: 'Lukusa', prenom: 'Mbuyi', sexe: 'M', dateNaissance: '1980-11-10', telephone: '+243813333333', type: 'Medecin', dateEmbauche: '2010-06-01', statut: 'Actif' },
            { id: 'p4', matricule: 'MED004', nom: 'Mambwe', prenom: 'Kapinga', sexe: 'F', dateNaissance: '1976-05-18', telephone: '+243814444444', type: 'Medecin', dateEmbauche: '2006-03-10', statut: 'Actif' },
            { id: 'p5', matricule: 'MED005', nom: 'Ngandu', prenom: 'Kilala', sexe: 'M', dateNaissance: '1982-09-25', telephone: '+243815555555', type: 'Medecin', dateEmbauche: '2012-09-01', statut: 'Actif' },
            { id: 'p6', matricule: 'MED006', nom: 'Ilunga', prenom: 'Kabongo', sexe: 'M', dateNaissance: '1979-02-14', telephone: '+243816666666', type: 'Medecin', dateEmbauche: '2009-04-01', statut: 'Actif' },
            { id: 'p7', matricule: 'MED007', nom: 'Tshilombo', prenom: 'Kasongo', sexe: 'M', dateNaissance: '1977-08-30', telephone: '+243817777777', type: 'Medecin', dateEmbauche: '2007-11-15', statut: 'Actif' },
            { id: 'p8', matricule: 'MED008', nom: 'Ngoy', prenom: 'Kabongo', sexe: 'M', dateNaissance: '1974-12-05', telephone: '+243818888888', type: 'Medecin', dateEmbauche: '2004-06-01', statut: 'Actif' },
            { id: 'p9', matricule: 'MED009', nom: 'Kasongo', prenom: 'Ngalula', sexe: 'F', dateNaissance: '1983-04-20', telephone: '+243819999999', type: 'Medecin', dateEmbauche: '2013-02-01', statut: 'Actif' },
            { id: 'p10', matricule: 'MED010', nom: 'Bijuru', prenom: 'Nzazi', sexe: 'M', dateNaissance: '1981-06-12', telephone: '+243810000000', type: 'Medecin', dateEmbauche: '2011-08-01', statut: 'Actif' },
            { id: 'p11', matricule: 'INF001', nom: 'Ntumba', prenom: 'Kalala', sexe: 'M', dateNaissance: '1985-01-20', telephone: '+243821111111', type: 'Infirmier', dateEmbauche: '2010-03-01', statut: 'Actif' },
            { id: 'p12', matricule: 'INF002', nom: 'Mbala', prenom: 'Mukoko', sexe: 'F', dateNaissance: '1988-07-15', telephone: '+243822222222', type: 'Infirmier', dateEmbauche: '2015-06-01', statut: 'Actif' },
            { id: 'p13', matricule: 'INF003', nom: 'Luyeye', prenom: 'Mvula', sexe: 'F', dateNaissance: '1990-03-28', telephone: '+243823333333', type: 'Infirmier', dateEmbauche: '2016-09-01', statut: 'Actif' },
            { id: 'p14', matricule: 'INF004', nom: 'Kabongo', prenom: 'Nsimba', sexe: 'M', dateNaissance: '1987-11-08', telephone: '+243824444444', type: 'Infirmier', dateEmbauche: '2014-01-15', statut: 'Actif' },
            { id: 'p15', matricule: 'INF005', nom: 'Mutombo', prenom: 'Tshala', sexe: 'F', dateNaissance: '1989-05-22', telephone: '+243825555555', type: 'Infirmier', dateEmbauche: '2017-04-01', statut: 'Actif' },
            { id: 'p16', matricule: 'INF006', nom: 'Kasongo', prenom: 'Mwamba', sexe: 'M', dateNaissance: '1986-09-14', telephone: '+243826666666', type: 'Infirmier', dateEmbauche: '2013-07-01', statut: 'Actif' },
            { id: 'p17', matricule: 'ADM001', nom: 'Mwamba', prenom: 'Kabamba', sexe: 'F', dateNaissance: '1990-02-10', telephone: '+243831111111', type: 'Administratif', dateEmbauche: '2018-01-01', statut: 'Actif' },
            { id: 'p18', matricule: 'ADM002', nom: 'Lukonde', prenom: 'Kanza', sexe: 'F', dateNaissance: '1992-08-05', telephone: '+243832222222', type: 'Administratif', dateEmbauche: '2019-06-15', statut: 'Actif' },
            { id: 'p19', matricule: 'PRS001', nom: 'Kadiata', prenom: 'Nsele', sexe: 'M', dateNaissance: '1984-03-19', telephone: '+243833333333', type: 'Prestataire', dateEmbauche: '2020-01-01', statut: 'Actif' },
            { id: 'p20', matricule: 'PRS002', nom: 'Yemba', prenom: 'Banza', sexe: 'F', dateNaissance: '1986-10-05', telephone: '+243834444444', type: 'Prestataire', dateEmbauche: '2021-05-01', statut: 'Actif' }
        ];
        await DB.putAll('personnel', personnel);

        const medecins = [
            { id: 'm1', personnelId: 'p1', specialite: 'Cardiologie', numeroOrdre: 'ORD-1234', grade: 'Professeur', consultationCout: 25000, disponible: true, serviceId: 'svc1' },
            { id: 'm2', personnelId: 'p2', specialite: 'Chirurgie Generale', numeroOrdre: 'ORD-1235', grade: 'Chef de Service', consultationCout: 30000, disponible: true, serviceId: 'svc2' },
            { id: 'm3', personnelId: 'p3', specialite: 'Pediatrie', numeroOrdre: 'ORD-1236', grade: 'Specialiste', consultationCout: 20000, disponible: true, serviceId: 'svc3' },
            { id: 'm4', personnelId: 'p4', specialite: 'Gynecologie-Obstetrique', numeroOrdre: 'ORD-1237', grade: 'Chef de Service', consultationCout: 25000, disponible: true, serviceId: 'svc4' },
            { id: 'm5', personnelId: 'p5', specialite: 'Medecine d\'Urgence', numeroOrdre: 'ORD-1238', grade: 'Specialiste', consultationCout: 20000, disponible: true, serviceId: 'svc5' },
            { id: 'm6', personnelId: 'p6', specialite: 'Biologie Clinique', numeroOrdre: 'ORD-1239', grade: 'Chef de Service', consultationCout: 15000, disponible: true, serviceId: 'svc6' },
            { id: 'm7', personnelId: 'p7', specialite: 'Radiologie', numeroOrdre: 'ORD-1240', grade: 'Chef de Service', consultationCout: 20000, disponible: true, serviceId: 'svc7' },
            { id: 'm8', personnelId: 'p8', specialite: 'Chirurgie Orthopedique', numeroOrdre: 'ORD-1241', grade: 'Professeur', consultationCout: 35000, disponible: true, serviceId: 'svc2' },
            { id: 'm9', personnelId: 'p9', specialite: 'Pediatrie', numeroOrdre: 'ORD-1242', grade: 'Specialiste', consultationCout: 20000, disponible: true, serviceId: 'svc3' },
            { id: 'm10', personnelId: 'p10', specialite: 'Anesthesie-Reanimation', numeroOrdre: 'ORD-1243', grade: 'Specialiste', consultationCout: 25000, disponible: true, serviceId: 'svc9' }
        ];
        await DB.putAll('medecins', medecins);

        const infirmiers = [
            { id: 'inf1', personnelId: 'p11', qualification: 'Infirmier Generaliste', serviceId: 'svc1', tour: 'Jour' },
            { id: 'inf2', personnelId: 'p12', qualification: 'Infirmier Generaliste', serviceId: 'svc2', tour: 'Jour' },
            { id: 'inf3', personnelId: 'p13', qualification: 'Infirmier Pediatrique', serviceId: 'svc3', tour: 'Jour' },
            { id: 'inf4', personnelId: 'p14', qualification: 'Infirmier Urgentiste', serviceId: 'svc5', tour: 'Nuit' },
            { id: 'inf5', personnelId: 'p15', qualification: 'Infirmier Generaliste', serviceId: 'svc4', tour: 'Jour' },
            { id: 'inf6', personnelId: 'p16', qualification: 'Infirmier Reanimation', serviceId: 'svc9', tour: 'Nuit' }
        ];
        await DB.putAll('infirmiers', infirmiers);
    },

    async seedSallesEtLits() {
        const salles = [];
        const lits = [];
        const services = ['svc1', 'svc2', 'svc3', 'svc4', 'svc5', 'svc9'];
        const serviceNoms = { svc1: 'MI', svc2: 'CHG', svc3: 'PED', svc4: 'MAT', svc5: 'URG', svc9: 'REA' };

        let sIdx = 1;
        services.forEach(svcId => {
            for (let s = 1; s <= 3; s++) {
                const salleId = `sal${sIdx}`;
                salles.push({ id: salleId, numero: `${serviceNoms[svcId]}-S${s}`, serviceId: svcId, type: svcId === 'svc9' ? 'Reanimation' : 'Standard', capacite: 4, statut: 'Libre' });
                for (let l = 1; l <= 4; l++) {
                    lits.push({
                        id: `lit${lits.length + 1}`,
                        numero: `${serviceNoms[svcId]}-S${s}-L${l}`,
                        salleId,
                        serviceId: svcId,
                        type: svcId === 'svc9' ? 'Reanimation' : 'Standard',
                        statut: 'Libre',
                        jourCout: svcId === 'svc9' ? 50000 : 25000
                    });
                }
                sIdx++;
            }
        });

        await DB.putAll('salles', salles);
        await DB.putAll('lits', lits);
        // Indexe les lits disponibles par service pour la coherence des hospitalisations
        this._litsParService = {};
        this._litsADeclarer = [];
        lits.forEach(lit => {
            if (!this._litsParService[lit.serviceId]) this._litsParService[lit.serviceId] = [];
            this._litsParService[lit.serviceId].push(lit);
        });
    },

    // Retourne un lit libre et coherent avec le service, ou null
    _prendreLit(serviceId) {
        if (!this._litsParService || !this._litsParService[serviceId]) return null;
        const dispo = this._litsParService[serviceId].filter(l => l.statut === 'Libre');
        if (dispo.length === 0) return null;
        const lit = dispo[0];
        lit.statut = 'Occupe';
        this._litsParService[serviceId] = this._litsParService[serviceId].map(l => l.id === lit.id ? lit : l);
        this._litsADeclarer.push(lit);
        return lit;
    },

    // Marque comme occupes les lits attribues pendant l'initialisation
    async _declarerLitsOccupes() {
        if (!this._litsADeclarer || this._litsADeclarer.length === 0) return;
        await DB.putAll('lits', this._litsADeclarer);
        this._litsADeclarer = [];
    },

    async seedTypesExamen() {
        const types = [
            { id: 'te1', nom: 'NFS (Num Formule Sanguine)', serviceId: 'svc6', cout: 5000, delaiResultat: '2h', actif: true },
            { id: 'te2', nom: 'Glycemie', serviceId: 'svc6', cout: 3000, delaiResultat: '1h', actif: true },
            { id: 'te3', nom: 'Creatinine', serviceId: 'svc6', cout: 4000, delaiResultat: '2h', actif: true },
            { id: 'te4', nom: 'Bilan Hepatique', serviceId: 'svc6', cout: 8000, delaiResultat: '4h', actif: true },
            { id: 'te5', nom: 'ECG', serviceId: 'svc6', cout: 10000, delaiResultat: '1h', actif: true },
            { id: 'te6', nom: 'Radiographie Thorax', serviceId: 'svc7', cout: 15000, delaiResultat: '2h', actif: true },
            { id: 'te7', nom: 'Echographie Abdominale', serviceId: 'svc7', cout: 25000, delaiResultat: '3h', actif: true },
            { id: 'te8', nom: 'Scanner Cerebral', serviceId: 'svc7', cout: 75000, delaiResultat: '24h', actif: true },
            { id: 'te9', nom: 'IRM Genou', serviceId: 'svc7', cout: 100000, delaiResultat: '48h', actif: true },
            { id: 'te10', nom: 'Radiographie Osseuse', serviceId: 'svc7', cout: 12000, delaiResultat: '2h', actif: true }
        ];
        await DB.putAll('typesExamen', types);
    },

    async seedTarifs() {
        const existing = await DB.getAll('tarifs');
        if (existing.length > 0) return;
        const tarifs = [];

        const medecins = await DB.getAll('medecins');
        medecins.forEach(m => {
            tarifs.push({ id: 'tarif' + tarifs.length + 1, categorie: 'Consultation', libelle: 'Consultation', montant: Number(m.consultationCout) || 15000, serviceId: m.serviceId || null, typeId: m.id, actif: true });
        });

        const types = await DB.getAll('typesExamen');
        types.forEach(te => {
            tarifs.push({ id: 'tarif' + tarifs.length + 1, categorie: 'Examen', libelle: te.nom || 'Examen', montant: Number(te.cout) || 0, serviceId: te.serviceId || null, typeId: te.id, actif: true });
        });

        const lits = await DB.getAll('lits');
        const jourParSvc = {};
        lits.forEach(l => { if (Number(l.jourCout)) jourParSvc[l.serviceId] = jourParSvc[l.serviceId] || Number(l.jourCout); });
        Object.entries(jourParSvc).forEach(([svc, montant]) => {
            tarifs.push({ id: 'tarif' + tarifs.length + 1, categorie: 'Hospitalisation', libelle: 'Journee d\'hospitalisation', montant, serviceId: svc, typeId: null, actif: true });
        });

        const generiques = [
            ['Imagerie', 'Radiographie', 15000], ['Imagerie', 'Echographie', 25000], ['Imagerie', 'Scanner', 75000],
            ['Imagerie', 'IRM', 100000], ['Imagerie', 'Mammographie', 20000],
            ['Chirurgie', 'Appendicectomie', 100000], ['Chirurgie', 'Cesarie', 150000],
            ['Chirurgie', 'Hernie inguinale', 90000], ['Chirurgie', 'Petite chirurgie', 30000]
        ];
        generiques.forEach(([cat, lib, montant]) => {
            tarifs.push({ id: 'tarif' + tarifs.length + 1, categorie: cat, libelle: lib, montant, serviceId: null, typeId: null, actif: true });
        });

        await DB.putAll('tarifs', tarifs);
    },

    async seedRemunerations() {
        const existing = await DB.getAll('remunerations');
        if (existing.length > 0) return;
        const personnel = await DB.getAll('personnel');
        const mois = new Date().toISOString().slice(0, 7);
        const remuns = [];

        const calcBulletin = (base, primes, type) => {
            const totalPrimes = (primes || []).reduce((s, p) => s + p.montant, 0);
            const brut = base + totalPrimes;
            if (type === 'Honoraire') {
                const precompte = Math.round(brut * 0.15);
                return {
                    montantBrut: brut, salaireBase: base, primes: primes || [], totalPrimes,
                    montantRetenus: precompte, totalRetenuesSalariales: precompte,
                    inpsSalarial: 0, amoSalarial: 0,
                    montantNet: brut - precompte,
                    inpsPatronal: 0, amoPatronal: 0, totalChargesPatronales: 0,
                    coutTotalEmployeur: brut
                };
            }
            const inps = Math.round(brut * 0.09);
            const amo = Math.round(brut * 0.02);
            const retenues = inps + amo;
            const inpsPatronal = Math.round(brut * 0.09);
            const amoPatronal = Math.round(brut * 0.03);
            return {
                montantBrut: brut, salaireBase: base, primes: primes || [], totalPrimes,
                montantRetenus: retenues, totalRetenuesSalariales: retenues,
                inpsSalarial: inps, amoSalarial: amo,
                montantNet: brut - retenues,
                inpsPatronal, amoPatronal, totalChargesPatronales: inpsPatronal + amoPatronal,
                coutTotalEmployeur: brut + inpsPatronal + amoPatronal
            };
        };

        const salari = [
            ['p1', 900000, [{ nom: "Prime d'anciennete", montant: 90000 }, { nom: 'Prime de risque', montant: 50000 }]],
            ['p11', 350000, [{ nom: 'Prime de transport', montant: 30000 }]],
            ['p17', 300000, []],
            ['p3', 700000, [{ nom: "Prime d'anciennete", montant: 70000 }]]
        ];
        salari.forEach(([pid, brut, primes]) => {
            if (!personnel.some(p => p.id === pid)) return;
            remuns.push(Object.assign({
                id: DB.generateId(), type: 'Salaire', personnelId: pid, periode: mois,
                dateEmission: new Date().toISOString(), datePaiement: null, modePaiement: null, statut: 'Etabli', motif: 'Salaire mensuel'
            }, calcBulletin(brut, primes, 'Salaire')));
        });

        const prestataire = personnel.find(p => p.type === 'Prestataire');
        if (prestataire) {
            const brut = 400000;
            remuns.push(Object.assign({
                id: DB.generateId(), type: 'Honoraire', personnelId: prestataire.id, periode: mois,
                dateEmission: new Date().toISOString(), datePaiement: null, modePaiement: null, statut: 'Etabli', motif: 'Honoraires consultations'
            }, calcBulletin(brut, [], 'Honoraire')));
        }

        if (remuns.length > 0) await DB.putAll('remunerations', remuns);
    },

    async seedContrats() {
        const existing = await DB.getAll('contrats');
        if (existing.length > 0) return;
        const aujourdHui = new Date();
        const finProche = new Date(aujourdHui);
        finProche.setDate(finProche.getDate() + 20);
        const contrats = [
            {
                id: DB.generateId(), titre: 'Contrat de travail - Dr Mukendi Kasongo', typeContrat: 'Employe',
                personnelId: 'p1', nomExterne: '', contactExterne: '', dateDebut: '2005-09-01', dateFin: null,
                montant: 0, periodicite: 'Mensuelle', statut: 'Actif',
                description: 'Contrat a duree indeterminee, service de Medecine Interne.',
                signataire1: 'Direction', signataire2: 'Dr Mukendi Kasongo', dateSignature: '2005-09-01',
                piecesJointes: '', notes: '', dateCreation: aujourdHui.toISOString(), creePar: 'u1',
                obligationsPrestataire: "Le medecin s'engage a exercer ses fonctions avec diligence, a respecter le code de deontologie medicale, les reglements interieurs de l'hopital et les horaires de service. Il assure les consultations, la surveillance des patients hospitalises et la redaction des dossiers medicaux.",
                obligationsHopital: "L'hopital s'engage a fournir les locaux, le materiel medical et les fournitures necessaires, a garantir un environnement de travail sain et securise, et a payer le salaire mensuel et les charges sociales conformement a la reglementation en vigueur.",
                modalitesPaiement: "Salaire mensuel verse au plus tard le dernier jour ouvrable du mois, sous deduction des cotisations sociales (INPS, AMO) part salariale et patronale.",
                clauseConfidentialite: "Le medecin s'engage a garder strictement confidentielles les informations relatives aux patients et a la vie de l'hopital, meme apres la cessation du contrat.",
                clauseProprieteIntellectuelle: 'Les documents et methodes internes de l\'hopital demeurent la propriete exclusive de l\'etablissement.',
                clauseResponsabilite: "Le medecin exerce sous sa responsabilite professionnelle ; l'hopital souscrit une assurance responsabilite civile professionnelle.",
                clauseResiliation: "Le contrat peut etre rompu par l'une ou l'autre partie moyennant un preavis de trois (3) mois. La faute lourde entraine une rupture immediate.",
                clauseLitiges: 'Tout litige relatif au present contrat est soumis a la juridiction competente de la ville de Kinshasa.',
                clausesDiverses: "Le present contrat entre en vigueur a la date de sa signature. Toute modification fait l'objet d'un avenant signe par les deux parties."
            },
            {
                id: DB.generateId(), titre: 'Contrat de prestation - Laboratoire externe', typeContrat: 'Prestataire',
                personnelId: null, nomExterne: 'Laboratoire BioAnalis', contactExterne: '+243 82 555 0101', dateDebut: '2024-01-01', dateFin: '2026-12-31',
                montant: 400000, periodicite: 'Mensuelle', statut: 'Actif',
                description: "Prestation d'analyses specialisees non realisees en interne.",
                signataire1: 'Administration', signataire2: 'BioAnalis SARL', dateSignature: '2023-12-15',
                piecesJointes: 'CCB_BioAnalis.pdf', notes: '', dateCreation: aujourdHui.toISOString(), creePar: 'u1',
                obligationsPrestataire: "Le laboratoire s'engage a realiser les analyses demandees dans un delai maximal de quarante-huit (48) heures, a fournir des resultats fiables accompagnes du controle de qualite, et a garantir la conservation des prelevements conformement aux normes.",
                obligationsHopital: "L'hopital s'engage a effectuer les prelevements dans de bonnes conditions, a transmettre les demandes signees par le medecin traitant et a assurer le transport approprie des echantillons.",
                modalitesPaiement: "Facturation mensuelle sur la base du tarif convenu par categorie d'analyse, payable par virement bancaire sous trente (30) jours.",
                clauseConfidentialite: "Les resultats des analyses sont strictement confidentiels et ne peuvent etre communiques qu'au patient ou a son medecin.",
                clauseProprieteIntellectuelle: 'Non applicable a la presente prestation de services.',
                clauseResponsabilite: "Le laboratoire est responsable de la qualite et de l'exactitude des resultats ; il souscrit une assurance responsabilite civile.",
                clauseResiliation: "Le contrat peut etre resilie avec un preavis de deux (2) mois. Tout defaut de qualite constate en cours d'execution peut entrainer la suspension immediate des prestations.",
                clauseLitiges: 'Les litiges seront regles a l\'amiable, a defaut par le tribunal de commerce de Kinshasa.',
                clausesDiverses: "Le present contrat est reconductible par tacite reconduction sauf denonciation par lettre recommandee trois (3) mois avant l'echeance."
            },
            {
                id: DB.generateId(), titre: 'Partenariat - Approvisionnement medicaments', typeContrat: 'Partenaire',
                personnelId: null, nomExterne: 'Fondation Sante Plus', contactExterne: '+243 99 000 1212', dateDebut: '2025-01-01', dateFin: '2027-12-31',
                montant: 2500000, periodicite: 'Trimestrielle', statut: 'Actif',
                description: 'Convention de partenariat pour fourniture de medicaments essentiels a prix subventionne.',
                signataire1: 'Direction', signataire2: 'Fondation Sante Plus', dateSignature: '2024-12-20',
                piecesJointes: '', notes: '', dateCreation: aujourdHui.toISOString(), creePar: 'u1',
                obligationsPrestataire: "La Fondation s'engage a approvisionner l'hopital en medicaments essentiels de qualite certifiee, a des prix subventionnes, avec un inventaire mensuel et une tracabilite des lots livres.",
                obligationsHopital: "L'hopital s'engage a mettre en place des circuits de stockage conformes (chaine du froid, registres), a vendre les medicaments subventionnes aux patients et a rendre compte trimestriellement de leur utilisation.",
                modalitesPaiement: "Une dotation trimestrielle de 2 500 000 FCFA est versee par la Fondation ; l'hopital justifie l'emploi des fonds par des rapports certifies.",
                clauseConfidentialite: 'Les donnees d\'approvisionnement et les prix convenus restent confidentiels entre les deux parties.',
                clauseProprieteIntellectuelle: 'Non applicable.',
                clauseResponsabilite: "La Fondation ne saurait etre tenue responsable des dommages decoulant d'une mauvaise conservation des medicaments par l'hopital.",
                clauseResiliation: "La convention peut etre resiliee par chacune des parties moyennant un preavis de trois (3) mois et apres verification des comptes.",
                clauseLitiges: 'Les differends sont portes devant les juridictions de Kinshasa, apres tentative de conciliation.',
                clausesDiverses: "Un comite de suivi paritaire se reunit chaque trimestre pour evaluer l'execution de la presente convention."
            },
            {
                id: DB.generateId(), titre: 'Contrat a duree determinee - Ntumba Kalala', typeContrat: 'Employe',
                personnelId: 'p11', nomExterne: '', contactExterne: '', dateDebut: '2025-01-01', dateFin: finProche.toISOString().slice(0, 10),
                montant: 0, periodicite: 'Mensuelle', statut: 'Actif',
                description: 'Renouvellement du CDD du personnel infirmier - service Medecine Interne.',
                signataire1: 'Direction', signataire2: 'Ntumba Kalala', dateSignature: '2024-12-20',
                piecesJointes: '', notes: 'Renouvelable', dateCreation: aujourdHui.toISOString(), creePar: 'u1',
                obligationsPrestataire: "L'infirmier s'engage a dispenser des soins conformes aux protocoles du service, a tenir les dossiers de soins et a participer aux gardes ainsi qu'aux formations continues.",
                obligationsHopital: "L'hopital s'engage a garantir les conditions de travail, la formation continue et le versement regulier de la remuneration et des cotisations sociales.",
                modalitesPaiement: "Salaire mensuel verse au plus tard le 25 du mois, sous deduction legale des cotisations sociales.",
                clauseConfidentialite: "Confidentialite totale des informations medicales et administratives de l'hopital.",
                clauseProprieteIntellectuelle: 'Les protocoles de soins rediges durant le contrat restent la propriete de l\'hopital.',
                clauseResponsabilite: "L'hopital souscrit une assurance accidents de travail au profit de l'infirmier.",
                clauseResiliation: "Le present CDD expire de plein droit a son terme sauf reconduction. Il peut etre rompu avant terme par accord mutuel ou pour faute grave.",
                clauseLitiges: 'Les litiges sont regis par le droit du travail congolais et portes devant le tribunal du travail.',
                clausesDiverses: "La periode d'essai est de trente (30) jours ; elle peut etre renouvelee une seule fois."
            },
            {
                id: DB.generateId(), titre: 'Convention de stage - Jean Kalonji', typeContrat: 'Stage',
                personnelId: null, nomExterne: 'Jean Kalonji', contactExterne: '+243 89 333 4444', dateDebut: '2025-02-01', dateFin: '2025-07-31',
                montant: 0, periodicite: 'Ponctuelle', statut: 'Termine',
                description: 'Stage de perfectionnement en pharmacie hospitaliere.',
                signataire1: 'Administration', signataire2: 'Jean Kalonji', dateSignature: '2025-01-25',
                piecesJointes: '', notes: '', dateCreation: aujourdHui.toISOString(), creePar: 'u1',
                obligationsPrestataire: "Le stagiaire s'engage a suivre les instructions du maitre de stage, a respecter le reglement interieur, l'hygiene et la confidentialite des donnees, et a rendre compte de ses travaux.",
                obligationsHopital: "L'hopital s'engage a assurer l'encadrement du stagiaire par un pharmacien tuteur, a lui fournir les moyens necessaires et une attestation de fin de stage.",
                modalitesPaiement: 'Stage non remunere, une indemnite de transport forfaitaire peut etre allouee sur decision de la direction.',
                clauseConfidentialite: "Le stagiaire est tenu au secret professionnel pendant et apres le stage.",
                clauseProprieteIntellectuelle: 'Tout document ou etude realisee pendant le stage est la propriete de l\'hopital.',
                clauseResponsabilite: "L'hopital declare souscrire une assurance couvrant le stagiaire pendant les heures de stage.",
                clauseResiliation: 'La convention peut etre denoncee par l\'une ou l\'autre partie avec un preavis de quinze (15) jours.',
                clauseLitiges: 'Les differends seront regles a l\'amiable entre l\'etablissement et l\'etablissement d\'origine du stagiaire.',
                clausesDiverses: "Le stagiaire est couvert par la convention de stage signee avec son etablissement d'enseignement."
            }
        ];
        await DB.putAll('contrats', contrats);
    },

    async seedDepenses() {
        const existing = await DB.getAll('depenses');
        if (existing.length > 0) return;
        const aujourdHui = new Date();
        const iso = (d) => d.toISOString().slice(0, 10);
        const ilYaJours = (n) => { const d = new Date(aujourdHui); d.setDate(d.getDate() - n); return iso(d); };
        const depenses = [
            { id: DB.generateId(), categorie: 'Electricite', sousCategorie: '', libelle: 'Facture electrique SNEL - Batiment A', montant: 350000, date: ilYaJours(10), modePaiement: 'Virement', beneficiaire: 'SNEL', serviceId: null, facture: 'SNEL-2026-0412', enregistrePar: 'u1', dateEnregistrement: aujourdHui.toISOString(), notes: '' },
            { id: DB.generateId(), categorie: 'Construction', sousCategorie: 'Extension', libelle: 'Extension aile pediatrie - acompte 1', montant: 2500000, date: ilYaJours(38), modePaiement: 'Virement', beneficiaire: 'Entreprise BTP Congo', serviceId: 'svc3', facture: 'BTP-001', enregistrePar: 'u1', dateEnregistrement: aujourdHui.toISOString(), notes: 'Seance de planification validee' },
            { id: DB.generateId(), categorie: 'Entretien', sousCategorie: 'Climatisation', libelle: 'Entretien climatiseurs bloc operatoire', montant: 180000, date: ilYaJours(3), modePaiement: 'Cheque', beneficiaire: 'Sarl Froid & Climat', serviceId: 'svc2', facture: 'FC-778', enregistrePar: 'u1', dateEnregistrement: aujourdHui.toISOString(), notes: '' },
            { id: DB.generateId(), categorie: 'Achats Materiels', sousCategorie: 'Equipement medical', libelle: 'Achat moniteur de signes vitaux', montant: 4500000, date: ilYaJours(15), modePaiement: 'Virement', beneficiaire: 'MedTech Solutions', serviceId: 'svc9', facture: 'MT-2026-09', enregistrePar: 'u1', dateEnregistrement: aujourdHui.toISOString(), notes: 'Garantie 24 mois' },
            { id: DB.generateId(), categorie: 'Achats Fournitures', sousCategorie: '', libelle: 'Fournitures de bureau - administration', montant: 85000, date: ilYaJours(2), modePaiement: 'Especes', beneficiaire: 'Papeterie Centrale', serviceId: null, facture: '', enregistrePar: 'u1', dateEnregistrement: aujourdHui.toISOString(), notes: '' },
            { id: DB.generateId(), categorie: 'Transports', sousCategorie: 'Carburant', libelle: 'Carburant ambulance urgences', montant: 60000, date: ilYaJours(1), modePaiement: 'Especes', beneficiaire: 'Station Total', serviceId: 'svc5', facture: '', enregistrePar: 'u1', dateEnregistrement: aujourdHui.toISOString(), notes: '' }
        ];
        await DB.putAll('depenses', depenses);
    },

    async seedMedicaments() {
        const meds = [
            { id: 'med1', nom: 'Paracetamol', forme: 'Comprime', dosage: '500mg', categorie: 'Antidouleur', stockMin: 100, stockActuel: 500, prixAchat: 50, prixVente: 100, datePeremption: '2027-12-31', fournisseur: 'PharmaKin' },
            { id: 'med2', nom: 'Amoxicilline', forme: 'Gelule', dosage: '500mg', categorie: 'Antibiotique', stockMin: 50, stockActuel: 200, prixAchat: 150, prixVente: 300, datePeremption: '2027-06-30', fournisseur: 'PharmaKin' },
            { id: 'med3', nom: 'Ibuprofene', forme: 'Comprime', dosage: '400mg', categorie: 'Anti-inflammatoire', stockMin: 80, stockActuel: 300, prixAchat: 80, prixVente: 150, datePeremption: '2027-09-30', fournisseur: 'PharmaKin' },
            { id: 'med4', nom: 'Metformine', forme: 'Comprime', dosage: '850mg', categorie: 'Antidiabetique', stockMin: 40, stockActuel: 150, prixAchat: 200, prixVente: 400, datePeremption: '2027-03-31', fournisseur: 'MediCongo' },
            { id: 'med5', nom: 'Amlodipine', forme: 'Comprime', dosage: '5mg', categorie: 'Antihypertenseur', stockMin: 30, stockActuel: 120, prixAchat: 250, prixVente: 500, datePeremption: '2027-11-30', fournisseur: 'MediCongo' },
            { id: 'med6', nom: 'Omeprazole', forme: 'Gelule', dosage: '20mg', categorie: 'Gastro-protecteur', stockMin: 40, stockActuel: 180, prixAchat: 180, prixVente: 350, datePeremption: '2027-08-31', fournisseur: 'PharmaKin' },
            { id: 'med7', nom: 'Ciprofloxacine', forme: 'Comprime', dosage: '500mg', categorie: 'Antibiotique', stockMin: 30, stockActuel: 100, prixAchat: 300, prixVente: 600, datePeremption: '2027-05-31', fournisseur: 'PharmaKin' },
            { id: 'med8', nom: 'Salbutamol', forme: 'Spray', dosage: '100mcg/dose', categorie: 'Bronchodilatateur', stockMin: 20, stockActuel: 50, prixAchat: 2000, prixVente: 3500, datePeremption: '2027-04-30', fournisseur: 'MediCongo' },
            { id: 'med9', nom: 'Cetirizine', forme: 'Comprime', dosage: '10mg', categorie: 'Antihistaminique', stockMin: 50, stockActuel: 200, prixAchat: 60, prixVente: 120, datePeremption: '2027-10-31', fournisseur: 'PharmaKin' },
            { id: 'med10', nom: 'Diclofenac', forme: 'Gel', dosage: '1%', categorie: 'Anti-inflammatoire topique', stockMin: 20, stockActuel: 60, prixAchat: 500, prixVente: 1000, datePeremption: '2027-07-31', fournisseur: 'MediCongo' }
        ];
        await DB.putAll('medicaments', meds);
    },

    async seedPatients() {
        const patients = [];
        const noms = ['Tshisekedi', 'Kabila', 'Lukusa', 'Mukendi', 'Kasongo', 'Ngoy', 'Mwamba', 'Ilunga', 'Mutombo', 'Tshilombo', 'Bijuru', 'Kabongo', 'Ntumba', 'Mbala', 'Luyeye', 'Kalala', 'Kapinga', 'Mbuyi', 'Nzazi', 'Kanza'];
        const prenoms = ['Jean', 'Pierre', 'Marie', 'Grace', 'David', 'Sarah', 'Paul', 'Andre', 'Claire', 'Emmanuel', 'Joseph', 'Therese', 'Michel', 'Helene', 'Patrick', 'Annie', 'Robert', 'Sylvie', 'Georges', 'Nathalie'];
        const genres = ['M', 'F'];
        const groupes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

        for (let i = 0; i < 50; i++) {
            const nom = noms[Math.floor(Math.random() * noms.length)];
            const prenom = prenoms[Math.floor(Math.random() * prenoms.length)];
            patients.push({
                id: `pat${i + 1}`,
                matricule: `PAT${String(i + 1).padStart(4, '0')}`,
                nom, prenom,
                sexe: genres[Math.floor(Math.random() * 2)],
                dateNaissance: `${1950 + Math.floor(Math.random() * 50)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                lieuNaissance: 'Kinshasa',
                telephone: `+24381${String(Math.floor(Math.random() * 9000000) + 1000000)}`,
                adresse: `${Math.floor(Math.random() * 200) + 1}, Av. ${['de la Paix', 'du Commerce', 'Independance', 'Lumumba', 'Kasa-Vubu'][Math.floor(Math.random() * 5)]}`,
                email: '',
                groupeSanguin: groupes[Math.floor(Math.random() * groupes.length)],
                allergie: Math.random() > 0.8 ? ['Penicilline'] : [],
                antecedents: [],
                dateCreation: new Date().toISOString()
            });
        }
        await DB.putAll('patients', patients);
    },

    async seedConsultations() {
        const consults = [];
        const motifs = ['Douleur thoracique', 'Fievre persistante', 'Maux de tete', 'Douleurs abdominales', 'Toux chronique', 'Hypertension', 'Diabete - controle', 'Douleur lombaire', 'Vertiges', 'Allergie cutanee'];
        const diagnostics = ['Gastrique', 'Paludisme', 'Infection respiratoire', 'Hypertension arterielle', 'Diabete type 2', 'Lombalgie', 'Migraine', 'Dermatite allergique', 'Bronchite', 'Anemie'];

        for (let i = 0; i < 80; i++) {
            const patIdx = (i % 50) + 1;
            const medIdx = (i % 10) + 1;
            consults.push({
                id: `cons${i + 1}`,
                patientId: `pat${patIdx}`,
                medecinId: `m${medIdx}`,
                dateConsultation: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString(),
                motif: motifs[Math.floor(Math.random() * motifs.length)],
                symptomes: 'Symptomes declares par le patient',
                diagnostic: diagnostics[Math.floor(Math.random() * diagnostics.length)],
                prescription: 'Traitement prescribe',
                notes: '',
                serviceId: ['svc1', 'svc2', 'svc3', 'svc4'][Math.floor(Math.random() * 4)],
                type: Math.random() > 0.8 ? 'Urgence' : (Math.random() > 0.5 ? 'Controle' : 'Normale')
            });
        }
        await DB.putAll('consultations', consults);
    },

    async seedUrgences() {
        const urgences = [];
        const motifs = ['Accident de voiture', 'Chute', 'Crise cardiaque', 'Fievre intense', 'Traumatisme cranien', 'Brulure', 'Intoxication', 'Douleur intense'];
        const decisions = ['Hospitalisation', 'Ambulatoire', 'Transfert'];
        const niveaux = [1, 2, 3, 4, 5];

        for (let i = 0; i < 30; i++) {
            urgences.push({
                id: `urg${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                dateArrivee: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
                motif: motifs[Math.floor(Math.random() * motifs.length)],
                niveauTriage: niveaux[Math.floor(Math.random() * 5)],
                medecinId: `m5`,
                statut: ['EnCours', 'Terminee', 'EnAttente'][Math.floor(Math.random() * 3)],
                datePriseEnCharge: new Date(Date.now() - Math.floor(Math.random() * 29) * 86400000).toISOString(),
                dateSortie: Math.random() > 0.3 ? new Date(Date.now() - Math.floor(Math.random() * 28) * 86400000).toISOString() : null,
                diagnostic: diagnosticsUrgences[Math.floor(Math.random() * diagnosticsUrgences.length)],
                decision: decisions[Math.floor(Math.random() * 3)]
            });
        }
        await DB.putAll('urgences', urgences);
    },

    async seedAdmissions() {
        const admissions = [];
        for (let i = 0; i < 40; i++) {
            const dateEntree = new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000);
            const duree = Math.floor(Math.random() * 14) + 1;
            const dateSortie = new Date(dateEntree.getTime() + duree * 86400000);
            const isTerminee = dateSortie < new Date();
            const serviceId = ['svc1', 'svc2', 'svc3', 'svc4', 'svc9'][Math.floor(Math.random() * 5)];

            const adm = {
                id: `adm${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                dateAdmission: dateEntree.toISOString(),
                motif: ['Hospitalisation programmee', 'Transfert', 'Urgence'][Math.floor(Math.random() * 3)],
                type: ['Urgence', 'Consultation', 'Hospitalisation', 'Programmee'][Math.floor(Math.random() * 4)],
                serviceId,
                litId: null,
                medecinId: `m${Math.floor(Math.random() * 10) + 1}`,
                statut: isTerminee ? 'Terminee' : 'EnCours',
                dateSortie: isTerminee ? dateSortie.toISOString() : null,
                motifSortie: isTerminee ? ['Guerison', 'Transfert', 'Demande patient'][Math.floor(Math.random() * 3)] : null
            };

            // Assigne un lit coherent pour les admissions en cours
            if (!isTerminee && (adm.type === 'Hospitalisation' || adm.type === 'Urgence')) {
                const lit = this._prendreLit(serviceId);
                if (lit) adm.litId = lit.id;
            }

            admissions.push(adm);
        }
        await DB.putAll('admissions', admissions);
    },

    async seedHospitalisations() {
        const hosps = [];
        for (let i = 0; i < 25; i++) {
            const dateEntree = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000);
            const duree = Math.floor(Math.random() * 10) + 1;
            const dateSortie = new Date(dateEntree.getTime() + duree * 86400000);
            const isTerminee = dateSortie < new Date();
            const serviceId = ['svc1', 'svc2', 'svc3', 'svc9'][Math.floor(Math.random() * 4)];

            const hosp = {
                id: `hosp${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                admissionId: `adm${(i % 40) + 1}`,
                serviceId,
                litId: null,
                dateEntree: dateEntree.toISOString(),
                dateSortiePrevu: dateSortie.toISOString(),
                dateSortieReel: isTerminee ? dateSortie.toISOString() : null,
                medecinId: `m${Math.floor(Math.random() * 10) + 1}`,
                diagnostic: ['Post-op', 'Surveillance', 'Traitement intensif', 'Reeducation'][Math.floor(Math.random() * 4)],
                statut: isTerminee ? 'Terminee' : 'EnCours'
            };

            // Assigne un lit coherent pour les hospitalisations en cours
            if (!isTerminee) {
                const lit = this._prendreLit(serviceId);
                if (lit) hosp.litId = lit.id;
            }

            hosps.push(hosp);
        }
        await DB.putAll('hospitalisations', hosps);

        // Marque comme occupes les lits attribues
        await this._declarerLitsOccupes();
    },

    async seedDemandesExamen() {
        const demandes = [];
        for (let i = 0; i < 40; i++) {
            demandes.push({
                id: `dem${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                medecinId: `m${(i % 10) + 1}`,
                dateDemande: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
                typeExamenId: `te${(i % 10) + 1}`,
                priorite: ['Normale', 'Urgente', 'TresUrgente'][Math.floor(Math.random() * 3)],
                statut: ['Demande', 'EnCours', 'Realisee'][Math.floor(Math.random() * 3)],
                motif: 'Bilan de sante',
                serviceId: ['svc1', 'svc2', 'svc3', 'svc4'][Math.floor(Math.random() * 4)]
            });
        }
        await DB.putAll('demandesExamen', demandes);
    },

    async seedExamensImagerie() {
        const exams = [];
        for (let i = 0; i < 20; i++) {
            exams.push({
                id: `img${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                medecinId: `m${(i % 10) + 1}`,
                dateDemande: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
                type: ['Radio', 'Echographie', 'IRM', 'Scanner'][Math.floor(Math.random() * 4)],
                priorite: ['Normale', 'Urgente'][Math.floor(Math.random() * 2)],
                statut: ['Demande', 'Planifiee', 'Realisee'][Math.floor(Math.random() * 3)],
                indications: 'Examens de routine',
                serviceId: ['svc1', 'svc2', 'svc9'][Math.floor(Math.random() * 3)]
            });
        }
        await DB.putAll('examensImagerie', exams);
    },

    async seedOperations() {
        const ops = [];
        const types = ['Appendicectomie', 'Cholecystectomie', 'Hernie inguinale', 'Cesarienne', 'Pose de prothese', 'Arthroscopie', 'Laparotomie'];
        const statuts = ['Planifiee', 'EnCours', 'Terminee', 'Annulee'];

        for (let i = 0; i < 20; i++) {
            ops.push({
                id: `op${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                medecinId: `m${[2, 8][Math.floor(Math.random() * 2)] + 1}`,
                typeIntervention: types[Math.floor(Math.random() * types.length)],
                datePrevue: new Date(Date.now() + Math.floor(Math.random() * 30 - 15) * 86400000).toISOString(),
                dureeEstimee: Math.floor(Math.random() * 180) + 30,
                salleId: `sal4`,
                statut: statuts[Math.floor(Math.random() * 4)],
                anesthesie: ['Locale', 'Generale', 'Locoregionale'][Math.floor(Math.random() * 3)],
                compteRendu: ''
            });
        }
        await DB.putAll('operations', ops);
    },

    async seedFacturations() {
        const factures = [];
        const paiements = [];
        const modes = ['Especes', 'Carte', 'Virement', 'Assurance', 'Mutuelle'];

        for (let i = 0; i < 35; i++) {
            const total = Math.floor(Math.random() * 200000) + 10000;
            const paye = Math.floor(Math.random() * total);
            const date = new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString();
            const modePaiement = paye > 0 ? modes[Math.floor(Math.random() * modes.length)] : null;
            const statut = paye >= total ? 'EntierementPayee' : (paye > 0 ? 'PartiellementPayee' : 'Impayee');
            factures.push({
                id: `fac${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                admissionId: i < 25 ? `adm${(i % 40) + 1}` : null,
                date,
                lignes: [
                    { description: 'Consultation', montant: Math.floor(Math.random() * 30000) + 5000 },
                    { description: 'Examens', montant: Math.floor(Math.random() * 20000) + 2000 },
                    { description: 'Medicaments', montant: Math.floor(Math.random() * 15000) + 1000 }
                ],
                montantTotal: total,
                montantPaye: paye,
                resteApayer: total - paye,
                statut,
                modePaiement
            });

            // Cree un enregistrement de paiement correspondant quand un montant est paye
            if (paye > 0) {
                paiements.push({
                    id: `pay${i + 1}`,
                    factureId: `fac${i + 1}`,
                    patientId: `pat${(i % 50) + 1}`,
                    date,
                    montant: paye,
                    mode: modePaiement,
                    caissierId: 'u8'
                });
            }
        }
        await DB.putAll('factures', factures);
        if (paiements.length > 0) await DB.putAll('paiements', paiements);
    },

    async seedAssurances() {
        const assurances = [
            { id: 'ass1', nom: 'Assurance Nationale', type: 'Mutuelle', couverturePourcentage: 70, adresse: 'Av. Lumumba, Kinshasa', telephone: '+243811001001', contact: 'M. Kalonji', actif: true },
            { id: 'ass2', nom: 'Promas', type: 'Privee', couverturePourcentage: 80, adresse: 'Av. du 30 Juin, Kinshasa', telephone: '+243812002002', contact: 'Mme. Tshimanga', actif: true },
            { id: 'ass3', nom: 'MMI Congo', type: 'Privee', couverturePourcentage: 60, adresse: 'Av. Kasa-Vubu, Kinshasa', telephone: '+243813003003', contact: 'Dr. Nkusu', actif: true }
        ];
        await DB.putAll('assurances', assurances);
    },

    async seedGardes() {
        const gardes = [];
        const personnelMed = ['p1', 'p2', 'p3', 'p4', 'p5', 'p8', 'p9'];
        for (let d = -3; d <= 3; d++) {
            const date = new Date();
            date.setDate(date.getDate() + d);
            const dateStr = date.toISOString().slice(0, 10);
            personnelMed.forEach((pid, idx) => {
                if (idx % 2 === 0) {
                    gardes.push({
                        id: DB.generateId(),
                        personnelId: pid,
                        date: dateStr,
                        typeGarde: idx % 4 === 0 ? 'Nuit' : 'Jour',
                        heureDebut: idx % 4 === 0 ? '18:00' : '08:00',
                        heureFin: idx % 4 === 0 ? '06:00' : '18:00'
                    });
                } else {
                    gardes.push({ id: DB.generateId(), personnelId: pid, date: dateStr, typeGarde: 'Off' });
                }
            });
        }
        await DB.putAll('planningPersonnel', gardes);
    },

    async seedOrdonnances() {
        const ordos = [];
        const medIds = ['med1', 'med2', 'med3', 'med4', 'med5', 'med6', 'med7', 'med8', 'med9', 'med10'];
        const prix = { med1: 100, med2: 300, med3: 150, med4: 400, med5: 500, med6: 350, med7: 600, med8: 3500, med9: 120, med10: 1000 };
        for (let i = 0; i < 25; i++) {
            const nbLignes = Math.floor(Math.random() * 3) + 1;
            const lignes = [];
            for (let l = 0; l < nbLignes; l++) {
                const medId = medIds[Math.floor(Math.random() * medIds.length)];
                const quantite = Math.floor(Math.random() * 3) + 1;
                lignes.push({
                    medicamentId: medId,
                    nomMedicament: `Medicament ${medId}`,
                    posologie: `${quantite} x ${Math.floor(Math.random() * 3) + 1} fois/jour`,
                    quantite,
                    prixUnitaire: prix[medId] || 100,
                    montantTotal: (prix[medId] || 100) * quantite
                });
            }
            ordos.push({
                id: `ordo${i + 1}`,
                patientId: `pat${(i % 50) + 1}`,
                medecinId: `m${(i % 10) + 1}`,
                date: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
                statut: ['Prescrite', 'Dispensee', 'Partielle'][Math.floor(Math.random() * 3)],
                lignes
            });
        }
        await DB.putAll('ordonnances', ordos);
    },

    async seedSuivi() {
        const suivis = [];
        for (let i = 0; i < 20; i++) {
            suivis.push({
                id: DB.generateId(),
                hospitalisationId: `hosp${(i % 25) + 1}`,
                date: new Date(Date.now() - Math.floor(Math.random() * 15) * 86400000).toISOString(),
                temperature: (36 + Math.random() * 3).toFixed(1),
                ta: `${110 + Math.floor(Math.random() * 40)}/${70 + Math.floor(Math.random() * 20)}`,
                pouls: Math.floor(Math.random() * 40) + 60,
                observation: ['Etat stable', 'Amelioration du tableau clinique', 'Fievre controle', 'Bonne evolution', 'Complications mineures surveillees'][Math.floor(Math.random() * 5)],
                traitement: 'Poursuite du traitement prescrit',
                par: 'Infirmier'
            });
        }
        await DB.putAll('suiviHospitalisation', suivis);
    },

    async seedParametres() {
        const params = [
            { cle: 'seuil_stock_bas', valeur: 20, description: 'Seuil minimum stock medicaments' },
            { cle: 'devise', valeur: 'FCFA', description: 'Devise du systeme' },
            { cle: 'delai_consultation', valeur: 30, description: 'Duree moyenne consultation (min)' }
        ];
        await DB.putAll('parametres', params);
    },

    async seedIncremental() {
        const users = await DB.getAll('users');

        await this.ensureMaitre();

        const admin = users.find(u => u.nomUtilisateur === 'admin');
        if (!admin) {
            await DB.put('users', { id: DB.generateId(), nomUtilisateur: 'admin', motDePasse: Auth.hashPassword('admin123'), nomComplet: 'Admin General', role: 'admin', actif: true });
        } else if (admin.motDePasse !== Auth.hashPassword('admin123')) {
            admin.motDePasse = Auth.hashPassword('admin123');
            await DB.put('users', admin);
        }

        const gardes = await DB.getAll('planningPersonnel');
        if (gardes.length === 0) await this.seedGardes();

        const ordos = await DB.getAll('ordonnances');
        if (ordos.length === 0) await this.seedOrdonnances();

        const suivis = await DB.getAll('suiviHospitalisation');
        if (suivis.length === 0) await this.seedSuivi();

        const meds = await DB.getAll('medicaments');
        if (meds.length === 0) await this.seedMedicaments();

        const tarifs = await DB.getAll('tarifs');
        if (tarifs.length === 0) await this.seedTarifs();

        const remuns = await DB.getAll('remunerations');
        if (remuns.length === 0) await this.seedRemunerations();

        const contrats = await DB.getAll('contrats');
        if (contrats.length === 0) await this.seedContrats();

        const depenses = await DB.getAll('depenses');
        if (depenses.length === 0) await this.seedDepenses();
    }
};

window.SampleData = SampleData;
