const AutoBackup = {
    _timer: null,
    _dirHandle: null,

    async getSettings() {
        const enabled = await Meta.getParametre('auto_backup_enabled');
        const value = await Meta.getParametre('auto_backup_period_value');
        const unit = await Meta.getParametre('auto_backup_period_unit');
        const enabledLoc = await Meta.getParametre('auto_backup_location');
        const path = await Meta.getParametre('auto_backup_path');
        return {
            enabled: enabled === 'true',
            value: parseInt(value || '24', 10),
            unit: unit || 'heures',
            locationEnabled: enabledLoc === 'true',
            path: path || null
        };
    },

    periodToMs(s) {
        const perUnitMin = { minutes: 1, heures: 60, jours: 1440, semaines: 10080, mois: 43200 }[s.unit] || 1440;
        return (s.value || 0) * perUnitMin * 60 * 1000;
    },

    // Initialise la planification : decalage + intervalle tant que l'app est ouverte.
    async init() {
        this.stop();
        const s = await this.getSettings();
        if (!s.enabled) return;
        const ms = this.periodToMs(s);
        if (!ms) return;

        const last = await Meta.getParametre('auto_backup_last');
        const now = Date.now();
        if (!last || (now - parseInt(last, 10)) >= ms) {
            await this.runBackup(true);
        }
        this._timer = setInterval(() => this.runBackup(true), ms);
    },

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    async runBackup(silent) {
        try {
            const s = await this.getSettings();
            const fileName = `gesthopital_backup_${new Date().toISOString().slice(0, 10)}_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.json`;

            if (s.locationEnabled && this._dirHandle) {
                const fileHandle = await this._dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                const data = await DB.exportAll();
                await writable.write(JSON.stringify(data, null, 2));
                await writable.close();
            } else {
                await Storage.backup();
            }

            await Meta.setParametre('auto_backup_last', String(Date.now()));
            if (!silent) UI.toast('Sauvegarde automatique effectuee', 'success');
            await Auth.log('Sauvegarde auto', 'parametres', fileName);
        } catch (err) {
            if (!silent) UI.toast('Echec de la sauvegarde automatique: ' + err.message, 'error');
        }
    },

    // Choisit un dossier de destination (Chromium uniquement).
    async chooseDirectory() {
        if (!window.showDirectoryPicker) {
            UI.toast('Choix de dossier non supporte. Utilisez Chrome ou Edge.', 'warning');
            return false;
        }
        try {
            const dir = await window.showDirectoryPicker();
            if (dir && dir.requestPermission) {
                const perm = await dir.requestPermission({ mode: 'readwrite' });
                if (perm !== 'granted') {
                    UI.toast('Permission d\'ecriture refusee pour ce dossier', 'warning');
                    return false;
                }
            }
            this._dirHandle = dir;
            await Meta.setParametre('auto_backup_location', 'true');
            await Meta.setParametre('auto_backup_path', dir.name || 'Dossier choisi');
            return true;
        } catch (err) {
            if (err.name !== 'AbortError') UI.toast('Erreur: ' + err.message, 'error');
            return false;
        }
    },

    // Revient a l'emplacement par defaut (telechargements).
    async clearLocation() {
        this._dirHandle = null;
        await Meta.setParametre('auto_backup_location', 'false');
        await Meta.setParametre('auto_backup_path', null);
    }
};

window.AutoBackup = AutoBackup;
