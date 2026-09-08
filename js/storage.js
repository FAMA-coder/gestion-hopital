const Storage = {
    async backup() {
        const data = await DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gesthopital_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Sauvegarde effectuee avec succes', 'success');
        await Auth.log('Sauvegarde', 'parametres', 'Export JSON');
    },

    async restore(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    await DB.importAll(data);
                    Cache.invalidateAll();
                    UI.toast('Restauration effectuee avec succes', 'success');
                    await Auth.log('Restauration', 'parametres', 'Import JSON');
                    resolve(true);
                } catch (err) {
                    UI.toast('Erreur lors de la restauration: ' + err.message, 'error');
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
};

window.Storage = Storage;
