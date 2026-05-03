/**

- ATLAS Dashboard — Storage Module
- All localStorage read/write operations in one place.
- No dependencies. Loaded first.
  */

const Storage = {
KEY: ‘atlas_data’,
AI_KEY: ‘atlas_ai_key’,
AI_PROVIDER_KEY: ‘atlas_ai_provider’,

/* ── Core data ───────────────────────────────────────────── */

getData() {
try {
const raw = localStorage.getItem(this.KEY);
return raw ? JSON.parse(raw) : { transactions: [], initialCapital: 0 };
} catch {
return { transactions: [], initialCapital: 0 };
}
},

saveData(data) {
try {
localStorage.setItem(this.KEY, JSON.stringify(data));
return true;
} catch (e) {
console.error(‘ATLAS Storage: write failed’, e);
return false;
}
},

/* ── Transactions ────────────────────────────────────────── */

getTransactions() {
return this.getData().transactions || [];
},

/**

- Add a new transaction.
- Automatically computes profit, revenue, and a unique ID.
  */
  addTransaction(tx) {
  const data = this.getData();

```
const costPrice   = parseFloat(tx.costPrice)   || 0;
const sellingPrice = parseFloat(tx.sellingPrice) || 0;
const quantity    = parseInt(tx.quantity, 10)   || 1;

const newTx = {
  ...tx,
  id:           `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  costPrice,
  sellingPrice,
  quantity,
  revenue:      sellingPrice * quantity,
  profit:       (sellingPrice - costPrice) * quantity,
  createdAt:    new Date().toISOString(),
};

data.transactions.push(newTx);
this.saveData(data);
return newTx;
```

},

/**

- Update an existing transaction by ID.
- Recalculates profit & revenue automatically.
  */
  updateTransaction(id, updates) {
  const data = this.getData();
  const idx  = data.transactions.findIndex(t => t.id === id);
  if (idx === -1) return false;

```
const merged = { ...data.transactions[idx], ...updates };
const costPrice    = parseFloat(merged.costPrice)    || 0;
const sellingPrice = parseFloat(merged.sellingPrice) || 0;
const quantity     = parseInt(merged.quantity, 10)   || 1;

data.transactions[idx] = {
  ...merged,
  costPrice,
  sellingPrice,
  quantity,
  revenue: sellingPrice * quantity,
  profit:  (sellingPrice - costPrice) * quantity,
};

this.saveData(data);
return true;
```

},

deleteTransaction(id) {
const data = this.getData();
data.transactions = data.transactions.filter(t => t.id !== id);
this.saveData(data);
},

/* ── Capital ─────────────────────────────────────────────── */

getCapital() {
return parseFloat(this.getData().initialCapital) || 0;
},

setCapital(amount) {
const data = this.getData();
data.initialCapital = parseFloat(amount) || 0;
this.saveData(data);
},

/* ── Reset ───────────────────────────────────────────────── */

resetAll() {
localStorage.removeItem(this.KEY);
},

/* ── AI settings (stored separately for clarity) ────────── */

getAIKey()        { return localStorage.getItem(this.AI_KEY) || ‘’; },
setAIKey(k)       { localStorage.setItem(this.AI_KEY, k); },
getAIProvider()   { return localStorage.getItem(this.AI_PROVIDER_KEY) || ‘groq’; },
setAIProvider(p)  { localStorage.setItem(this.AI_PROVIDER_KEY, p); },

/* ── Import / Export ─────────────────────────────────────── */

exportJSON() {
return JSON.stringify(this.getData(), null, 2);
},

importJSON(jsonString) {
const data = JSON.parse(jsonString); // throws if invalid
if (!Array.isArray(data.transactions)) throw new Error(‘Missing transactions array’);
this.saveData(data);
return data;
},
};
