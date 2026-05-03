/**

- ATLAS Dashboard — Main Application
- Orchestrates UI, events, modals, table, insights, and chatbot.
- Depends on: Storage, Charts, AI (loaded before this file).
  */

/* ═══════════════════════════════════════════════════════════════
APP CONTROLLER
═══════════════════════════════════════════════════════════════ */
const App = {
_sortField: ‘date’,
_sortDir:   ‘desc’,
_filterCat: ‘all’,

/* ── Bootstrap ───────────────────────────────────────────── */
init() {
this._setupNav();
this._setupEventListeners();
this._loadSettings();
this.refresh();
this._animateCards();
},

/* ── Full refresh (call after any data change) ───────────── */
refresh() {
const txs     = Storage.getTransactions();
const capital = Storage.getCapital();

```
this._updateSummaryCards(txs, capital);
this._renderInsights(txs, capital);
this._renderTable(txs);
Charts.renderAll(txs);
```

},

/* ── Navigation ──────────────────────────────────────────── */
_setupNav() {
document.querySelectorAll(’[data-nav]’).forEach(btn => {
btn.addEventListener(‘click’, () => this._navigateTo(btn.dataset.nav));
});
},

_navigateTo(section) {
document.querySelectorAll(’[data-nav]’).forEach(b =>
b.classList.toggle(‘active’, b.dataset.nav === section));
document.querySelectorAll(’.section’).forEach(s =>
s.classList.toggle(‘active’, s.id === `section-${section}`));

```
// Close mobile sidebar overlay
document.getElementById('sidebar')?.classList.remove('open');

// Re-render charts for the active section
const txs = Storage.getTransactions();
if (section === 'dashboard')  Charts.renderDashboard(txs);
if (section === 'analytics')  setTimeout(() => Charts.renderAnalytics(txs), 60);
```

},

/* ── Summary cards ───────────────────────────────────────── */
_updateSummaryCards(txs, capital) {
const totalRevenue = txs.reduce((s, t) => s + t.revenue, 0);
const totalCost    = txs.reduce((s, t) => s + (t.costPrice * t.quantity), 0);
const totalProfit  = txs.reduce((s, t) => s + t.profit,  0);
const remaining    = capital + totalProfit;   // capital grows with profit
const roi          = capital > 0 ? (totalProfit / capital) * 100 : 0;

```
this._setCard('totalRevenue',      this._fmt(totalRevenue));
this._setCard('totalProfit',       this._fmt(totalProfit),  totalProfit  >= 0 ? 'profit' : 'loss');
this._setCard('totalTransactions', txs.length.toString());
this._setCard('remainingCapital',  this._fmt(remaining),    remaining    >= capital ? 'profit' : 'loss');
this._setCard('roiValue',          `${roi.toFixed(1)}%`,    roi >= 0 ? 'profit' : 'loss');
```

},

_setCard(id, value, colorClass = ‘’) {
const el = document.getElementById(id);
if (!el) return;
el.textContent = value;
el.className   = ‘card-value’ + (colorClass ? ` ${colorClass}` : ‘’);
},

_fmt(n) {
return ‘$’ + n.toLocaleString(‘en-US’, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
},

/* ── AI Insights panel ───────────────────────────────────── */
_renderInsights(txs, capital) {
const container = document.getElementById(‘insightsContainer’);
if (!container) return;

```
const ins = AI.generateInsights(txs, capital);
if (!ins) {
  container.innerHTML = '<p class="no-data-msg">Add transactions to unlock AI insights.</p>';
  return;
}

const trendMeta = {
  increasing: { icon: '📈', cls: 'profit', label: 'Increasing' },
  decreasing: { icon: '📉', cls: 'loss',   label: 'Decreasing' },
  stable:     { icon: '➡️', cls: '',       label: 'Stable' },
}[ins.trend];

const profitSign = ins.totalProfit >= 0 ? '+' : '';

container.innerHTML = `
  ${this._insightCard('🏆', 'Best Product',   ins.bestProduct[0],
      `${profitSign}${this._fmt(ins.bestProduct[1].profit)} profit`, 'profit')}
  ${this._insightCard('📦', 'Top Category',   ins.bestCat[0],
      `${this._fmt(ins.bestCat[1].revenue)} revenue`, 'profit')}
  ${this._insightCard(trendMeta.icon, 'Sales Trend', trendMeta.label,
      'Based on transaction history', trendMeta.cls)}
  ${ins.forecast !== null ? this._insightCard('🔮', 'Forecast / Period',
      this._fmt(ins.forecast), '3-period moving average', '') : ''}
  ${ins.roi ? this._insightCard('💹', 'ROI vs Capital',
      `${ins.roi}%`, `${ins.margin}% gross margin`, parseFloat(ins.roi) >= 0 ? 'profit' : 'loss') : ''}
  ${ins.worstProduct && ins.worstProduct[1].profit < 0
      ? this._insightCard('⚠️', 'Watch Out', ins.worstProduct[0],
          `${this._fmt(ins.worstProduct[1].profit)} loss`, 'loss') : ''}
`;
```

},

_insightCard(icon, label, value, sub, valueCls) {
return ` <div class="insight-card"> <div class="insight-icon">${icon}</div> <div class="insight-body"> <div class="insight-label">${label}</div> <div class="insight-value${valueCls ? ' ' + valueCls : ''}">${this._esc(value)}</div> <div class="insight-sub${valueCls === 'profit' ? ' green' : valueCls === 'loss' ? ' red' : ''}">${sub}</div> </div> </div>`;
},

/* ── Transaction table ───────────────────────────────────── */
_renderTable(txs) {
const tbody = document.getElementById(‘transactionTableBody’);
if (!tbody) return;

```
// Filter
let rows = this._filterCat === 'all'
  ? [...txs]
  : txs.filter(t => t.category === this._filterCat);

// Sort
const sf = this._sortField, sd = this._sortDir;
rows.sort((a, b) => {
  let va = a[sf], vb = b[sf];
  if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
  return sd === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
});

if (!rows.length) {
  tbody.innerHTML = `<tr><td colspan="9" class="empty-state">
    No transactions found. Add your first sale using the button above!
  </td></tr>`;
  return;
}

tbody.innerHTML = rows.map(tx => {
  const profCls = tx.profit >= 0 ? 'profit' : 'loss';
  const sign    = tx.profit >= 0 ? '+' : '';
  return `<tr class="tx-row" data-id="${tx.id}">
    <td><span class="tx-name">${this._esc(tx.name)}</span></td>
    <td><span class="cat-badge cat-${tx.category.toLowerCase()}">${tx.category}</span></td>
    <td class="mono">$${parseFloat(tx.costPrice).toFixed(2)}</td>
    <td class="mono">$${parseFloat(tx.sellingPrice).toFixed(2)}</td>
    <td class="mono center">${tx.quantity}</td>
    <td class="mono">$${tx.revenue.toFixed(2)}</td>
    <td class="mono ${profCls}">${sign}$${tx.profit.toFixed(2)}</td>
    <td class="mono date-cell">${tx.date}</td>
    <td class="actions-cell">
      <button class="icon-btn edit-btn"  onclick="App.openEditModal('${tx.id}')" title="Edit">✎</button>
      <button class="icon-btn del-btn"   onclick="App.confirmDelete('${tx.id}')" title="Delete">✕</button>
    </td>
  </tr>`;
}).join('');
```

},

sortTable(field) {
if (this._sortField === field) this._sortDir = this._sortDir === ‘asc’ ? ‘desc’ : ‘asc’;
else { this._sortField = field; this._sortDir = ‘desc’; }

```
// Update sort indicator
document.querySelectorAll('[data-sort]').forEach(th => {
  th.classList.toggle('sorted', th.dataset.sort === field);
});
this._renderTable(Storage.getTransactions());
```

},

filterCategory(cat) {
this._filterCat = cat;
document.querySelectorAll(’.filter-btn’).forEach(b =>
b.classList.toggle(‘active’, b.dataset.cat === cat));
this._renderTable(Storage.getTransactions());
},

/* ── Modals ──────────────────────────────────────────────── */
openAddModal() {
document.getElementById(‘txDate’).value = new Date().toISOString().split(‘T’)[0];
document.getElementById(‘profitPreview’).textContent = ‘—’;
document.getElementById(‘profitPreview’).className = ‘profit-display’;
this._openModal(‘addModal’);
},

closeAddModal() {
this._closeModal(‘addModal’);
document.getElementById(‘addTxForm’).reset();
},

openEditModal(id) {
const tx = Storage.getTransactions().find(t => t.id === id);
if (!tx) return;
const f = document.getElementById(‘editTxForm’);
f.editTxId.value          = tx.id;
f.editTxName.value        = tx.name;
f.editTxCategory.value    = tx.category;
f.editTxCostPrice.value   = tx.costPrice;
f.editTxSellingPrice.value = tx.sellingPrice;
f.editTxQuantity.value    = tx.quantity;
f.editTxDate.value        = tx.date;
this._openModal(‘editModal’);
},

closeEditModal() { this._closeModal(‘editModal’); },

confirmDelete(id) {
this._openModal(‘confirmModal’);
document.getElementById(‘confirmDeleteBtn’).onclick = () => {
Storage.deleteTransaction(id);
this._closeModal(‘confirmModal’);
this.refresh();
this.showToast(‘Transaction deleted’, ‘error’);
};
},

closeConfirmModal() { this._closeModal(‘confirmModal’); },

_openModal(id)  { document.getElementById(id)?.classList.add(‘open’); },
_closeModal(id) { document.getElementById(id)?.classList.remove(‘open’); },

/* ── Form handlers ───────────────────────────────────────── */
_handleAdd(e) {
e.preventDefault();
const f  = e.target;
const tx = {
name:         f.txName.value.trim(),
category:     f.txCategory.value,
costPrice:    f.txCostPrice.value,
sellingPrice: f.txSellingPrice.value,
quantity:     f.txQuantity.value,
date:         f.txDate.value,
};
if (!tx.name || !tx.date) { this.showToast(‘Please fill all required fields’, ‘error’); return; }
Storage.addTransaction(tx);
this.closeAddModal();
this.refresh();
this.showToast(‘Transaction added ✓’, ‘success’);
},

_handleEdit(e) {
e.preventDefault();
const f  = e.target;
const id = f.editTxId.value;
Storage.updateTransaction(id, {
name:         f.editTxName.value.trim(),
category:     f.editTxCategory.value,
costPrice:    f.editTxCostPrice.value,
sellingPrice: f.editTxSellingPrice.value,
quantity:     f.editTxQuantity.value,
date:         f.editTxDate.value,
});
this.closeEditModal();
this.refresh();
this.showToast(‘Transaction updated ✓’, ‘success’);
},

/* ── Profit preview (add modal) ──────────────────────────── */
_updateProfitPreview() {
const cost  = parseFloat(document.getElementById(‘txCostPrice’)?.value)    || 0;
const sell  = parseFloat(document.getElementById(‘txSellingPrice’)?.value) || 0;
const qty   = parseInt(document.getElementById(‘txQuantity’)?.value, 10)   || 1;
const profit = (sell - cost) * qty;
const el    = document.getElementById(‘profitPreview’);
if (!el) return;
const sign = profit >= 0 ? ‘+’ : ‘’;
el.textContent = `${sign}$${profit.toFixed(2)}`;
el.className   = ’profit-display ’ + (profit >= 0 ? ‘profit’ : ‘loss’);
},

/* ── Settings ────────────────────────────────────────────── */
_loadSettings() {
const capInput = document.getElementById(‘capitalInput’);
const cap      = Storage.getCapital();
if (capInput && cap > 0) capInput.value = cap;

```
const prov = document.getElementById('aiProvider');
const key  = document.getElementById('aiApiKey');
if (prov) prov.value = Storage.getAIProvider();
if (key)  key.value  = Storage.getAIKey();
```

},

saveCapital() {
const val = parseFloat(document.getElementById(‘capitalInput’)?.value);
if (isNaN(val) || val < 0) { this.showToast(‘Enter a valid amount’, ‘error’); return; }
Storage.setCapital(val);
this.refresh();
this.showToast(‘Capital saved ✓’, ‘success’);
},

saveSettings() {
const provider = document.getElementById(‘aiProvider’)?.value;
const key      = document.getElementById(‘aiApiKey’)?.value?.trim();
if (provider) Storage.setAIProvider(provider);
if (key !== undefined) Storage.setAIKey(key);
this.showToast(‘Settings saved ✓’, ‘success’);
},

resetAll() {
if (!confirm(‘Reset ALL data permanently? This cannot be undone.’)) return;
Storage.resetAll();
Chatbot.reset();
this.refresh();
this._loadSettings();
this.showToast(‘Data reset complete’, ‘error’);
},

/* ── Import / Export ─────────────────────────────────────── */
exportData() {
const json = Storage.exportJSON();
const blob = new Blob([json], { type: ‘application/json’ });
const url  = URL.createObjectURL(blob);
const a    = document.createElement(‘a’);
a.href     = url;
a.download = `atlas-export-${new Date().toISOString().split('T')[0]}.json`;
a.click();
URL.revokeObjectURL(url);
this.showToast(‘Data exported ✓’, ‘success’);
},

importData(e) {
const file = e.target.files?.[0];
if (!file) return;
const reader = new FileReader();
reader.onload = ev => {
try {
Storage.importJSON(ev.target.result);
this.refresh();
this._loadSettings();
this.showToast(‘Data imported ✓’, ‘success’);
} catch (err) {
this.showToast(`Import failed: ${err.message}`, ‘error’);
}
};
reader.readAsText(file);
e.target.value = ‘’; // reset file input
},

/* ── Toast notifications ─────────────────────────────────── */
showToast(msg, type = ‘success’) {
const el = document.getElementById(‘toast’);
if (!el) return;
el.textContent = msg;
el.className   = `toast ${type} show`;
clearTimeout(this._toastTimer);
this._toastTimer = setTimeout(() => el.classList.remove(‘show’), 3200);
},

/* ── Card entrance animation ─────────────────────────────── */
_animateCards() {
const cards = document.querySelectorAll(’.stat-card’);
cards.forEach((c, i) => {
c.style.opacity   = ‘0’;
c.style.transform = ‘translateY(12px)’;
setTimeout(() => {
c.style.transition = ‘opacity 0.4s ease, transform 0.4s ease’;
c.style.opacity    = ‘1’;
c.style.transform  = ‘translateY(0)’;
}, 80 + i * 60);
});
},

/* ── Helpers ─────────────────────────────────────────────── */
_esc(str) {
const d = document.createElement(‘div’);
d.appendChild(document.createTextNode(String(str)));
return d.innerHTML;
},

/* ── Event wiring ────────────────────────────────────────── */
_setupEventListeners() {
// Forms
document.getElementById(‘addTxForm’)?.addEventListener(‘submit’,  e => this._handleAdd(e));
document.getElementById(‘editTxForm’)?.addEventListener(‘submit’, e => this._handleEdit(e));

```
// Profit preview
['txCostPrice', 'txSellingPrice', 'txQuantity'].forEach(id =>
  document.getElementById(id)?.addEventListener('input', () => this._updateProfitPreview()));

// Settings buttons
document.getElementById('setCapitalBtn')?.addEventListener('click',   () => this.saveCapital());
document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
document.getElementById('resetAllBtn')?.addEventListener('click',     () => this.resetAll());
document.getElementById('exportBtn')?.addEventListener('click',       () => this.exportData());
document.getElementById('importInput')?.addEventListener('change',    e  => this.importData(e));

// Table sort headers
document.querySelectorAll('[data-sort]').forEach(th =>
  th.addEventListener('click', () => this.sortTable(th.dataset.sort)));

// Category filters
document.querySelectorAll('.filter-btn').forEach(btn =>
  btn.addEventListener('click', () => this.filterCategory(btn.dataset.cat)));

// Modal backdrop click to close
document.querySelectorAll('.modal-backdrop').forEach(bd =>
  bd.addEventListener('click', e => { if (e.target === bd) bd.classList.remove('open'); }));

// Mobile sidebar overlay close
document.getElementById('overlayBg')?.addEventListener('click', () =>
  document.getElementById('sidebar')?.classList.remove('open'));

// Mobile menu button
document.getElementById('menuBtn')?.addEventListener('click', () =>
  document.getElementById('sidebar')?.classList.toggle('open'));
```

},
};

/* ═══════════════════════════════════════════════════════════════
CHATBOT CONTROLLER
═══════════════════════════════════════════════════════════════ */
const Chatbot = {
_history: [],   // {role, content} for the API
_isOpen:  false,

toggle() {
this._isOpen = !this._isOpen;
document.getElementById(‘chatPanel’)?.classList.toggle(‘open’, this._isOpen);
document.getElementById(‘chatToggleBtn’)?.classList.toggle(‘active’, this._isOpen);

```
if (this._isOpen && this._history.length === 0) {
  this._addBubble('assistant',
    'Hi! I\'m **ATLAS AI**. Ask me anything about your sales — best products, trends, profit analysis, or general business questions.');
}
if (this._isOpen) {
  setTimeout(() => document.getElementById('chatInput')?.focus(), 150);
}
```

},

async send() {
const input   = document.getElementById(‘chatInput’);
const text    = input?.value?.trim();
if (!text) return;

```
input.value = '';
input.disabled = true;

this._history.push({ role: 'user', content: text });
this._addBubble('user', text);

const typingId = this._showTyping();

try {
  const reply = await AI.chat(this._history, Storage.getTransactions());
  this._removeTyping(typingId);
  this._history.push({ role: 'assistant', content: reply });
  this._addBubble('assistant', reply);
} catch (err) {
  this._removeTyping(typingId);
  this._addBubble('assistant', `⚠️ ${err.message}`);
} finally {
  input.disabled = false;
  input.focus();
}
```

},

handleKeydown(e) {
if (e.key === ‘Enter’ && !e.shiftKey) { e.preventDefault(); this.send(); }
},

reset() {
this._history = [];
const msgs = document.getElementById(‘chatMessages’);
if (msgs) msgs.innerHTML = ‘’;
this._isOpen = false;
document.getElementById(‘chatPanel’)?.classList.remove(‘open’);
document.getElementById(‘chatToggleBtn’)?.classList.remove(‘active’);
},

/* ── Internal helpers ────────────────────────────────────── */
_addBubble(role, content) {
const msgs = document.getElementById(‘chatMessages’);
if (!msgs) return;
const div = document.createElement(‘div’);
div.className = `chat-msg ${role}`;
div.innerHTML = `<div class="chat-bubble">${this._format(content)}</div>`;
msgs.appendChild(div);
msgs.scrollTop = msgs.scrollHeight;
},

_format(text) {
return String(text)
.replace(/&/g, ‘&’).replace(/</g, ‘<’).replace(/>/g, ‘>’)
.replace(/**(.*?)**/g, ‘<strong>$1</strong>’)
.replace(/\n/g, ‘<br>’);
},

_showTyping() {
const msgs = document.getElementById(‘chatMessages’);
const id   = `typing-${Date.now()}`;
const div  = document.createElement(‘div’);
div.id        = id;
div.className = ‘chat-msg assistant typing-msg’;
div.innerHTML = ‘<div class="chat-bubble"><span></span><span></span><span></span></div>’;
msgs?.appendChild(div);
msgs && (msgs.scrollTop = msgs.scrollHeight);
return id;
},

_removeTyping(id) { document.getElementById(id)?.remove(); },
};

/* ═══════════════════════════════════════════════════════════════
INIT
═══════════════════════════════════════════════════════════════ */
document.addEventListener(‘DOMContentLoaded’, () => App.init());
