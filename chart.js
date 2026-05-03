/**

- ATLAS Dashboard — Charts Module
- Wraps Chart.js instances. Supports dashboard (small) and analytics (full) canvases.
- Depends on: Chart.js CDN, Storage.
  */

/* ── Shared chart theme ─────────────────────────────────────── */
const CHART_COLORS = [’#00d4ff’, ‘#00ff88’, ‘#ffaa00’, ‘#ff4466’, ‘#a855f7’, ‘#fb923c’];

const TOOLTIP_OPTS = {
backgroundColor: ‘#131320’,
borderColor: ‘rgba(0,212,255,0.2)’,
borderWidth: 1,
titleColor: ‘#e0e0f0’,
bodyColor: ‘#8888aa’,
padding: 10,
cornerRadius: 8,
};

const AXIS_OPTS = {
grid:  { color: ‘rgba(255,255,255,0.04)’ },
ticks: { color: ‘#555577’, font: { family: ‘JetBrains Mono’, size: 10 } },
};

const LEGEND_OPTS = {
labels: { color: ‘#8888aa’, font: { family: ‘JetBrains Mono’, size: 11 }, padding: 16, boxWidth: 12 },
};

/* ── Gradient helper ────────────────────────────────────────── */
function buildGradient(ctx, hexColor) {
try {
const g = ctx.createLinearGradient(0, 0, 0, 300);
g.addColorStop(0, hexColor + ‘55’);
g.addColorStop(1, hexColor + ‘00’);
return g;
} catch {
return hexColor + ‘33’;
}
}

/* ── Charts object ──────────────────────────────────────────── */
const Charts = {
_instances: {},

destroy(id) {
if (this._instances[id]) {
this._instances[id].destroy();
delete this._instances[id];
}
},

/* ── Category doughnut ────────────────────────────────────── */
renderCategoryChart(canvasId, transactions) {
this.destroy(canvasId);
const canvas = document.getElementById(canvasId);
if (!canvas) return;

```
const totals = {};
transactions.forEach(tx => {
  totals[tx.category] = (totals[tx.category] || 0) + tx.revenue;
});

const labels = Object.keys(totals);
const values = Object.values(totals);

if (!labels.length) {
  this._drawEmpty(canvas, 'No data yet');
  return;
}

this._instances[canvasId] = new Chart(canvas.getContext('2d'), {
  type: 'doughnut',
  data: {
    labels,
    datasets: [{
      data: values,
      backgroundColor: CHART_COLORS.slice(0, labels.length).map(c => c + 'aa'),
      borderColor: CHART_COLORS.slice(0, labels.length),
      borderWidth: 2,
      hoverOffset: 10,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: LEGEND_OPTS.labels },
      tooltip: {
        ...TOOLTIP_OPTS,
        callbacks: {
          label: ctx => ` ${ctx.label}: $${ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        },
      },
    },
  },
});
```

},

/* ── Profit vs Loss bar ───────────────────────────────────── */
renderProfitChart(canvasId, transactions) {
this.destroy(canvasId);
const canvas = document.getElementById(canvasId);
if (!canvas) return;

```
let totalProfit = 0, totalLoss = 0;
transactions.forEach(tx => {
  if (tx.profit >= 0) totalProfit += tx.profit;
  else totalLoss += Math.abs(tx.profit);
});

this._instances[canvasId] = new Chart(canvas.getContext('2d'), {
  type: 'bar',
  data: {
    labels: ['Total Profit', 'Total Loss'],
    datasets: [{
      data: [totalProfit, totalLoss],
      backgroundColor: ['rgba(0,255,136,0.15)', 'rgba(255,68,102,0.15)'],
      borderColor:      ['#00ff88', '#ff4466'],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_OPTS,
        callbacks: {
          label: ctx => ` $${ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: AXIS_OPTS,
      y: {
        ...AXIS_OPTS,
        ticks: {
          ...AXIS_OPTS.ticks,
          callback: v => '$' + v.toLocaleString(),
        },
      },
    },
  },
});
```

},

/* ── Revenue trend line (+ MA + linear trend) ─────────────── */
renderTrendChart(canvasId, transactions) {
this.destroy(canvasId);
const canvas = document.getElementById(canvasId);
if (!canvas) return;

```
// Group revenue by date
const byDate = {};
transactions.forEach(tx => {
  const d = tx.date || new Date().toISOString().split('T')[0];
  byDate[d] = (byDate[d] || 0) + tx.revenue;
});

const sorted  = Object.keys(byDate).sort();
if (!sorted.length) {
  this._drawEmpty(canvas, 'No data yet');
  return;
}

const labels  = sorted.map(d => {
  const dt = new Date(d + 'T12:00:00'); // noon avoids timezone flip
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
});
const values  = sorted.map(d => byDate[d]);

// 3-period moving average
const ma = values.map((_, i) => {
  const w = values.slice(Math.max(0, i - 2), i + 1);
  return w.reduce((a, b) => a + b, 0) / w.length;
});

// Linear regression trend
const n   = values.length;
const xs  = values.map((_, i) => i);
const xm  = xs.reduce((a, b) => a + b, 0) / n;
const ym  = values.reduce((a, b) => a + b, 0) / n;
const num = xs.reduce((s, x, i) => s + (x - xm) * (values[i] - ym), 0);
const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
const slope = den !== 0 ? num / den : 0;
const intercept = ym - slope * xm;
const trend = xs.map(x => parseFloat((slope * x + intercept).toFixed(2)));

const ctx = canvas.getContext('2d');

this._instances[canvasId] = new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: values,
        borderColor: '#00d4ff',
        backgroundColor: buildGradient(ctx, '#00d4ff'),
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#00d4ff',
        pointBorderColor: '#080810',
        pointBorderWidth: 2,
        borderWidth: 2,
      },
      {
        label: '3-Day MA',
        data: ma,
        borderColor: '#ffaa00',
        borderDash: [7, 4],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Trend',
        data: trend,
        borderColor: '#a855f7',
        borderDash: [3, 3],
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 1.5,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: LEGEND_OPTS.labels },
      tooltip: {
        ...TOOLTIP_OPTS,
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: $${ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: AXIS_OPTS,
      y: {
        ...AXIS_OPTS,
        ticks: {
          ...AXIS_OPTS.ticks,
          callback: v => '$' + v.toLocaleString(),
        },
      },
    },
  },
});
```

},

/* ── Helpers ──────────────────────────────────────────────── */

renderDashboard(transactions) {
this.renderCategoryChart(‘categoryChart’, transactions);
this.renderProfitChart(‘profitChart’, transactions);
this.renderTrendChart(‘trendChart’, transactions);
},

renderAnalytics(transactions) {
this.renderCategoryChart(‘categoryChartFull’, transactions);
this.renderProfitChart(‘profitChartFull’, transactions);
this.renderTrendChart(‘trendChartFull’, transactions);
},

renderAll(transactions) {
this.renderDashboard(transactions);
if (document.getElementById(‘section-analytics’)?.classList.contains(‘active’)) {
this.renderAnalytics(transactions);
}
},

_drawEmpty(canvas, msg) {
const ctx = canvas.getContext(‘2d’);
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = ‘#333355’;
ctx.font = ‘13px JetBrains Mono’;
ctx.textAlign = ‘center’;
ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
},
};
