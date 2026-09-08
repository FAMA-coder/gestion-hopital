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
        }
        await SampleData.seed();
        const hopital = await Meta.getHopital();
        if (hopital) State.set('hopital', hopital);
        return true;
    }
};

window.Init = Init;