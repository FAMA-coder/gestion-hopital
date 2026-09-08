const Excel = {
    exportToCSV(headers, rows, filename) {
        let csv = headers.join(';') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => {
                const val = String(cell || '').replace(/"/g, '""');
                return `"${val}"`;
            }).join(';') + '\n';
        });

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Export CSV effectue', 'success');
    },

    exportToJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + '.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    async importCSV(file, headers) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const lines = e.target.result.split('\n').filter(l => l.trim());
                if (lines.length < 2) { resolve([]); return; }

                const result = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(';').map(v => v.replace(/^"|"$/g, '').replace('""', '"'));
                    const row = {};
                    headers.forEach((h, idx) => {
                        row[h] = values[idx] || '';
                    });
                    result.push(row);
                }
                resolve(result);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
};

window.Excel = Excel;
