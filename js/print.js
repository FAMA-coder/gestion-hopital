const Print = {
    async getHopital() {
        return (await Meta.getHopital()) || {};
    },

    // En-tete imprime avec logo et coordonnees de l'hopital
    async headerHtml() {
        const h = await this.getHopital();
        const logo = h.logo ? `<img src="${h.logo}" alt="Logo" class="print-logo">` : '<div class="print-logo-placeholder">&#9764;</div>';
        const coord = [h.adresse, h.telephone ? 'Tel: ' + h.telephone : '', h.email].filter(Boolean).join('  |  ');
        return `
            <div class="print-header">
                ${logo}
                <div class="print-header-info">
                    <h1>${h.nom || 'Hopital'}</h1>
                    ${h.slogan ? `<p class="print-slogan">${h.slogan}</p>` : ''}
                    ${coord ? `<p class="print-coord">${coord}</p>` : ''}
                </div>
            </div>
            <hr class="print-rule">
        `;
    },

    // Ouvre une fenetre d'impression avec l'en-tete de l'hopital
    async open(title, bodyHtml) {
        const win = window.open('', '_blank', 'width=920,height=720');
        if (!win) {
            UI.toast('Le navigateur a bloque la fenetre d\'impression', 'error');
            return;
        }
        const header = await this.headerHtml();
        const now = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

        const doc = win.document;
        doc.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #202124; margin: 32px; font-size: 13px; }
    .print-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .print-logo { max-height: 70px; max-width: 120px; object-fit: contain; }
    .print-logo-placeholder { font-size: 40px; color: #1a73e8; line-height: 1; }
    .print-header-info h1 { margin: 0; font-size: 22px; color: #1a73e8; }
    .print-slogan { margin: 2px 0; font-style: italic; color: #5f6368; }
    .print-coord { margin: 2px 0; color: #5f6368; font-size: 12px; }
    .print-rule { border: none; border-top: 2px solid #1a73e8; margin: 12px 0; }
    .print-title { text-align: center; font-size: 17px; font-weight: 600; margin: 16px 0; }
    .print-meta { text-align: right; color: #5f6368; font-size: 11px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #dadce0; padding: 7px 9px; text-align: left; vertical-align: top; }
    th { background: #f1f3f4; font-weight: 600; }
    .print-total { font-weight: 700; font-size: 14px; }
    .print-sign { margin-top: 60px; display: flex; justify-content: space-between; }
    .print-sign div { text-align: center; width: 40%; }
    .print-sign .line { border-top: 1px solid #202124; padding-top: 4px; margin-top: 46px; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 11px; }
    .badge-success { background: #e6f4ea; color: #137333; }
    .badge-danger { background: #fce8e6; color: #c5221f; }
    .badge-warning { background: #fef7e0; color: #b36b00; }
    .badge-info { background: #e8f0fe; color: #1a73e8; }
    @media print { body { margin: 12mm; } }
</style>
</head>
<body>
${header}
<div class="print-meta">Imprime le : ${now}</div>
${bodyHtml}
<script>
    window.onload = function () { setTimeout(function () { window.print(); }, 350); };
<\/script>
</body>
</html>`);
        doc.close();
    }
};

window.Print = Print;
