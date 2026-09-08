const UI = {
    showModal(title, bodyHtml, footerHtml = '') {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-footer').innerHTML = footerHtml;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    hideModal() {
        document.getElementById('modal-overlay').style.display = 'none';
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: '&#10003;', error: '&#10007;', warning: '&#9888;', info: '&#8505;' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    setPageTitle(title) {
        document.getElementById('page-title').textContent = title;
    },

    renderTable(columns, rows, options = {}) {
        if (!rows || rows.length === 0) {
            return `<div class="empty-state">
                <div class="empty-state-icon">${options.emptyIcon || '&#9787;'}</div>
                <h3>${options.emptyTitle || 'Aucune donnee'}</h3>
                <p>${options.emptyText || 'Aucun enregistrement trouve.'}</p>
            </div>`;
        }

        let html = '<div class="table-container"><table><thead><tr>';
        columns.forEach(col => {
            html += `<th>${col.label}</th>`;
        });
        if (options.actions !== false) html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';

        rows.forEach((row, idx) => {
            html += '<tr>';
            columns.forEach(col => {
                let val = row[col.field];
                if (col.render) val = col.render(val, row, idx);
                else if (val === undefined || val === null) val = '-';
                html += `<td>${val}</td>`;
            });
            if (options.actions !== false) {
                html += `<td>${options.renderActions ? options.renderActions(row, idx) : ''}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    },

    renderBadge(text, type = 'gray') {
        return `<span class="badge badge-${type}">${text}</span>`;
    },

    renderStatCard(icon, value, label, color = 'blue') {
        return `<div class="stat-card">
            <div class="stat-icon ${color}">${icon}</div>
            <div class="stat-info">
                <h4>${value}</h4>
                <p>${label}</p>
            </div>
        </div>`;
    },

    buildForm(fields, values = {}) {
        let html = '<div class="form-row">';
        fields.forEach((field, idx) => {
            if (field.type === 'section') {
                html += `</div><div class="form-section-title">${field.label || ''}</div><div class="form-row">`;
                return;
            }
            if (field.type === 'hidden') {
                html += `<input type="hidden" name="${field.name}" value="${values[field.name] || ''}">`;
                return;
            }

            const isHalf = field.half !== false;
            if (idx > 0 && idx % 2 === 0 && isHalf) html += '</div><div class="form-row">';

            const val = values[field.name] !== undefined ? values[field.name] : (field.default || '');
            const required = field.required ? 'required' : '';
            const disabled = field.disabled ? 'disabled' : '';

            html += `<div class="form-group${field.full ? ' full' : ''}">`;
            html += `<label>${field.label}${field.required ? ' *' : ''}</label>`;

            if (field.type === 'select') {
                html += `<select name="${field.name}" ${required} ${disabled}>`;
                html += `<option value="">-- ${field.label} --</option>`;
                (field.options || []).forEach(opt => {
                    const selected = String(val) === String(opt.value) ? 'selected' : '';
                    html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                });
                html += '</select>';
            } else if (field.type === 'textarea') {
                html += `<textarea name="${field.name}" ${required} ${disabled} placeholder="${field.placeholder || ''}">${val}</textarea>`;
            } else if (field.type === 'checkbox') {
                const checked = val ? 'checked' : '';
                html += `<label class="checkbox-field"><input type="checkbox" name="${field.name}" ${checked} ${disabled}> <span>${field.label}</span></label>`;
            } else {
                const inputType = field.type || 'text';
                const min = field.min !== undefined ? `min="${field.min}"` : '';
                const max = field.max !== undefined ? `max="${field.max}"` : '';
                html += `<input type="${inputType}" name="${field.name}" value="${val}" ${required} ${disabled} ${min} ${max} placeholder="${field.placeholder || ''}">`;
            }

            html += '</div>';
        });
        html += '</div>';
        return html;
    },

    getFormData(formEl) {
        const data = {};
        const inputs = formEl.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (!input.name) return;
            if (input.type === 'checkbox') {
                data[input.name] = input.checked;
            } else if (input.type === 'radio') {
                if (input.checked) data[input.name] = input.value;
            } else if (input.type === 'number') {
                const v = input.value;
                data[input.name] = v === '' ? '' : Number(v);
            } else {
                data[input.name] = input.value;
            }
        });
        return data;
    },

    renderPagination(total, page, perPage, onPageChange) {
        const totalPages = Math.ceil(total / perPage);
        if (totalPages <= 1) return '';

        let html = '<div class="pagination">';
        if (page > 1) html += `<button data-page="${page - 1}">&laquo;</button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                html += `<button data-page="${i}" class="${i === page ? 'active' : ''}">${i}</button>`;
            } else if (i === page - 3 || i === page + 3) {
                html += '<button disabled>...</button>';
            }
        }

        if (page < totalPages) html += `<button data-page="${page + 1}">&raquo;</button>`;
        html += '</div>';
        return html;
    },

    renderProgressBar(value, max = 100, color = 'blue') {
        const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
        const barColor = pct > 80 ? 'red' : pct > 50 ? 'orange' : color;
        return `<div class="progress-bar">
            <div class="progress-fill ${barColor}" style="width:${pct}%"></div>
        </div>`;
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR');
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },

    formatMoney(amount, currency = 'FCFA') {
        if (amount === undefined || amount === null) return '0 ' + currency;
        return Number(amount).toLocaleString('fr-FR') + ' ' + currency;
    },

    confirm(message) {
        return new Promise(resolve => {
            this.showModal('Confirmation', `<p>${message}</p>`, `
                <button class="btn btn-outline" id="confirm-no">Annuler</button>
                <button class="btn btn-danger" id="confirm-yes">Confirmer</button>
            `);
            document.getElementById('confirm-yes').onclick = () => { this.hideModal(); resolve(true); };
            document.getElementById('confirm-no').onclick = () => { this.hideModal(); resolve(false); };
        });
    }
};

window.UI = UI;
