const Charts = {
    createBarChart(canvasId, labels, datasets, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth || 600;
        const height = canvas.clientHeight || 300;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const allValues = datasets.flatMap(d => d.data);
        const maxVal = Math.max(...allValues, 1);
        const niceMax = Math.ceil(maxVal / 10) * 10;

        ctx.clearRect(0, 0, width, height);

        const colors = datasets.map(d => d.color || '#1a73e8');

        const barGroupWidth = chartW / labels.length;
        const barWidth = Math.min((barGroupWidth * 0.7) / Math.max(datasets.length, 1), 40);

        // Grid + Y axis labels
        ctx.strokeStyle = '#e0e0e0';
        ctx.fillStyle = '#5f6368';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const val = (niceMax / ySteps) * i;
            const y = padding.top + chartH - (chartH / ySteps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            ctx.fillText(Math.round(val).toString(), padding.left - 8, y);
        }

        // Bars
        labels.forEach((label, idx) => {
            const groupX = padding.left + barGroupWidth * idx;
            datasets.forEach((ds, dsIdx) => {
                const barX = groupX + (barGroupWidth / 2) - ((datasets.length * barWidth) / 2) + dsIdx * barWidth;
                const value = ds.data[idx] || 0;
                const barH = (value / niceMax) * chartH;
                const y = padding.top + chartH - barH;

                ctx.fillStyle = colors[dsIdx];
                ctx.fillRect(barX, y, barWidth - 2, barH);

                if (options.showValues) {
                    ctx.fillStyle = '#202124';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(value.toString(), barX + barWidth / 2, y - 2);
                }
            });

            ctx.fillStyle = '#5f6368';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, groupX + barGroupWidth / 2, padding.top + chartH + 5);
        });

        if (datasets.length > 1 && options.legend !== false) {
            let legendX = padding.left;
            datasets.forEach((ds, idx) => {
                const w = ctx.measureText(ds.label).width;
                ctx.fillStyle = colors[idx];
                ctx.fillRect(legendX, 5, 12, 12);
                ctx.fillStyle = '#202124';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(ds.label, legendX + 16, 11);
                legendX += 16 + w + 20;
            });
        }
    },

    createDoughnutChart(canvasId, labels, values, colors = []) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth || 300;
        const height = canvas.clientHeight || 300;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) / 2 - 20;
        const innerRadius = radius * 0.6;

        const defaultColors = ['#1a73e8', '#1e8e3e', '#f9ab00', '#d93025', '#8430ce', '#12b5cb', '#ea4335', '#fbbc04'];
        const palette = colors.length ? colors : defaultColors;

        const total = values.reduce((s, v) => s + v, 0);
        if (total === 0) {
            ctx.fillStyle = '#5f6368';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Aucune donnee', cx, cy);
            return;
        }

        let angle = -Math.PI / 2;
        values.forEach((value, idx) => {
            if (value <= 0) return;
            const angleArc = (value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, angle, angle + angleArc);
            ctx.arc(cx, cy, innerRadius, angle + angleArc, angle, true);
            ctx.closePath();
            ctx.fillStyle = palette[idx % palette.length];
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            angle += angleArc;
        });

        ctx.fillStyle = '#202124';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total.toString(), cx, cy - 8);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#5f6368';
        ctx.fillText('Total', cx, cy + 12);
    },

    createLineChart(canvasId, labels, datasets, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth || 600;
        const height = canvas.clientHeight || 300;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const allValues = datasets.flatMap(d => d.data);
        const maxVal = Math.max(...allValues, 1);
        const niceMax = Math.ceil(maxVal / 10) * 10;

        ctx.clearRect(0, 0, width, height);

        const colors = datasets.map(d => d.color || '#1a73e8');

        ctx.strokeStyle = '#e0e0e0';
        ctx.fillStyle = '#5f6368';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const val = (niceMax / ySteps) * i;
            const y = padding.top + chartH - (chartH / ySteps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            ctx.fillText(Math.round(val).toString(), padding.left - 8, y);
        }

        const stepX = labels.length > 1 ? chartW / (labels.length - 1) : chartW;

        datasets.forEach((ds, dsIdx) => {
            ctx.strokeStyle = colors[dsIdx];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ds.data.forEach((value, idx) => {
                const x = padding.left + idx * stepX;
                const y = padding.top + chartH - (value / niceMax) * chartH;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });

        labels.forEach((label, idx) => {
            ctx.fillStyle = '#5f6368';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            if (labels.length <= 8 || idx % 2 === 0 || idx === labels.length - 1) {
                ctx.fillText(label, padding.left + idx * stepX, padding.top + chartH + 5);
            }
        });

        if (options.legend !== false && datasets.length > 1) {
            let legendX = padding.left;
            datasets.forEach((ds, idx) => {
                const w = ctx.measureText(ds.label).width;
                ctx.fillStyle = colors[idx];
                ctx.fillRect(legendX, 5, 12, 12);
                ctx.fillStyle = '#202124';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(ds.label, legendX + 16, 11);
                legendX += 16 + w + 20;
            });
        }
    }
};

window.Charts = Charts;
