/**

- ATLAS Dashboard — AI Module
- • AI.chat()            → calls Groq or OpenRouter with sales context
- • AI.generateInsights()→ offline analytics (no API needed)
- Depends on: Storage.
  */

const AI = {
ENDPOINTS: {
groq:       ‘https://api.groq.com/openai/v1/chat/completions’,
openrouter: ‘https://openrouter.ai/api/v1/chat/completions’,
},

MODELS: {
groq:       ‘llama-3.1-8b-instant’,
openrouter: ‘meta-llama/llama-3.1-8b-instruct:free’,
},

/* ── Build context string injected into every AI call ──────── */
buildContext(transactions) {
if (!transactions.length) return ‘No transactions recorded yet.’;

```
const totalRevenue  = transactions.reduce((s, t) => s + t.revenue, 0);
const totalProfit   = transactions.reduce((s, t) => s + t.profit,  0);
const totalCost     = transactions.reduce((s, t) => s + (t.costPrice * t.quantity), 0);

// Aggregate by category
const cats = {};
transactions.forEach(t => {
  if (!cats[t.category]) cats[t.category] = { revenue: 0, profit: 0, count: 0 };
  cats[t.category].revenue += t.revenue;
  cats[t.category].profit  += t.profit;
  cats[t.category].count++;
});

// Aggregate by product
const prods = {};
transactions.forEach(t => {
  if (!prods[t.name]) prods[t.name] = { revenue: 0, profit: 0, count: 0 };
  prods[t.name].revenue += t.revenue;
  prods[t.name].profit  += t.profit;
  prods[t.name].count   += t.quantity;
});

const topProducts = Object.entries(prods)
  .sort((a, b) => b[1].profit - a[1].profit)
  .slice(0, 5)
  .map(([name, d]) => `  - ${name}: $${d.revenue.toFixed(2)} revenue, $${d.profit.toFixed(2)} profit (${d.count} units)`)
  .join('\n');

const recent = [...transactions]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 8)
  .map(t => `  ${t.date} | ${t.name} (${t.category}) | qty:${t.quantity} | sell:$${t.sellingPrice} | profit:$${t.profit.toFixed(2)}`)
  .join('\n');

return `=== ATLAS SALES CONTEXT ===
```

Total Transactions : ${transactions.length}
Total Revenue      : $${totalRevenue.toFixed(2)}
Total Profit       : $${totalProfit.toFixed(2)}
Total Cost         : $${totalCost.toFixed(2)}
Profit Margin      : ${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%

Category Breakdown:
${Object.entries(cats).map(([cat, d]) => `  - ${cat}: $${d.revenue.toFixed(2)} revenue, $${d.profit.toFixed(2)} profit, ${d.count} transactions`).join(’\n’)}

Top Products by Profit:
${topProducts}

Recent Transactions:
${recent}
===========================`;
},

/* ── Call AI API ────────────────────────────────────────────── */
async chat(conversationMessages, transactions) {
const key      = Storage.getAIKey();
const provider = Storage.getAIProvider();

```
if (!key) {
  throw new Error('No API key found. Go to Settings → AI Chatbot to add your key.');
}

const url   = this.ENDPOINTS[provider];
const model = this.MODELS[provider];
const salesContext = this.buildContext(transactions);

const systemPrompt = `You are ATLAS AI, a sharp and concise sales intelligence assistant embedded in a dashboard for an electronics reseller.
```

You have live access to the following sales data:

${salesContext}

Rules:

- Be concise and data-driven. Max 3-4 sentences per answer unless asked for detail.
- Reference actual numbers from the data when possible.
- Use plain text (no markdown headers). You may use ** for bold key figures.
- If asked for recommendations, be specific and actionable.
- You may answer general business/finance questions too.`;
  
  const response = await fetch(url, {
  method: ‘POST’,
  headers: {
  ‘Content-Type’:  ‘application/json’,
  ‘Authorization’: `Bearer ${key}`,
  …(provider === ‘openrouter’ ? {
  ‘HTTP-Referer’: window.location.origin || ‘https://atlas-dashboard.app’,
  ‘X-Title’:      ‘ATLAS Sales Dashboard’,
  } : {}),
  },
  body: JSON.stringify({
  model,
  max_tokens:  600,
  temperature: 0.65,
  messages: [
  { role: ‘system’, content: systemPrompt },
  …conversationMessages,
  ],
  }),
  });
  
  if (!response.ok) {
  let errMsg = `API error ${response.status}`;
  try {
  const errBody = await response.json();
  errMsg = errBody?.error?.message || errMsg;
  } catch {}
  throw new Error(errMsg);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || ‘No response received.’;
  },
  
  /* ── Built-in offline insights (no API required) ─────────────── */
  generateInsights(transactions, capital) {
  if (!transactions.length) return null;
  
  /* Best product by profit */
  const prodMap = {};
  transactions.forEach(t => {
  if (!prodMap[t.name]) prodMap[t.name] = { profit: 0, revenue: 0, units: 0 };
  prodMap[t.name].profit  += t.profit;
  prodMap[t.name].revenue += t.revenue;
  prodMap[t.name].units   += t.quantity;
  });
  const bestProduct = Object.entries(prodMap).sort((a, b) => b[1].profit - a[1].profit)[0];
  
  /* Best category by profit */
  const catMap = {};
  transactions.forEach(t => {
  if (!catMap[t.category]) catMap[t.category] = { profit: 0, revenue: 0, count: 0 };
  catMap[t.category].profit  += t.profit;
  catMap[t.category].revenue += t.revenue;
  catMap[t.category].count++;
  });
  const bestCat = Object.entries(catMap).sort((a, b) => b[1].profit - a[1].profit)[0];
  
  /* Sales trend — compare first half vs second half of transactions */
  let trend = ‘stable’;
  const sorted = […transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length >= 4) {
  const mid      = Math.floor(sorted.length / 2);
  const firstRev = sorted.slice(0, mid).reduce((s, t) => s + t.revenue, 0);
  const lastRev  = sorted.slice(mid).reduce((s, t) => s + t.revenue, 0);
  const delta    = firstRev > 0 ? ((lastRev - firstRev) / firstRev) * 100 : 0;
  trend = delta > 8 ? ‘increasing’ : delta < -8 ? ‘decreasing’ : ‘stable’;
  }
  
  /* Forecast — 3-period moving average projection */
  const byDate = {};
  transactions.forEach(t => {
  byDate[t.date] = (byDate[t.date] || 0) + t.revenue;
  });
  const series = Object.values(byDate).sort();
  let forecast = null;
  if (series.length >= 3) {
  const last3 = series.slice(-3);
  forecast = last3.reduce((a, b) => a + b, 0) / 3;
  }
  
  /* ROI */
  const totalProfit  = transactions.reduce((s, t) => s + t.profit,  0);
  const totalRevenue = transactions.reduce((s, t) => s + t.revenue, 0);
  const roi          = capital > 0 ? ((totalProfit / capital) * 100).toFixed(1) : null;
  const margin       = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : ‘0.0’;
  
  /* Worst product (for warning insight) */
  const worstProduct = Object.entries(prodMap).sort((a, b) => a[1].profit - b[1].profit)[0];
  
  return { bestProduct, bestCat, trend, forecast, roi, margin, totalProfit, totalRevenue, worstProduct };
  },
  };
