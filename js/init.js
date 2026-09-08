const Init = {
    async run() {
        await DB.init();
        const mode = DB.mode();
        if (mode === 'cloud') {
            const r = (window && window.RemoteDB) ? window.RemoteDB : null;
            if (!r || !r.impl) {
                UI.toast('Mode cloud: configuration manquante dans js/config.js (URL + cles du backend).', 'error');
            } else {
                UI.toast('Mode cloud: base de donnees centrale partagee activee.', 'success');
            }
            // Registre des etablissements : creer le premier + migrer
            // les anciennes donnees si besoin. Sans effet en mode local.
            if (window.Tenant) await Tenant.ensureDefault();
        }
        await this.ensureSeed();
        const hopital = await Meta.getHopital();
        if (hopital) State.set('hopital', hopital);
        return true;
    },

    // Semer les donnees d'exemple une seule fois par etablissement.
    // En mode cloud, on attend qu'un etablissement soit choisi (le premier
    // login d'un hopital). En mode local, le seed reste immediat.
    async ensureSeed() {
        if (DB.mode() !== 'cloud') return SampleData.seed();
        const tid = window.Tenant ? Tenant.get() : null;
        if (!tid) return false;
        if (window.Meta) {
            const done = await Meta.getParametre('seed_done');
            if (done) return false;
        }
        await SampleData.seed();
        if (window.Meta) await Meta.setParametre('seed_done', '1');
        return true;
    }
};

window.Init = Init;