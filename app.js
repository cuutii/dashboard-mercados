// Dashboard de Mercados — lógica (HTML/CSS/JS puro, sin build)
// Datos: CoinGecko (cripto) y Yahoo Finance vía proxy allorigins (acciones).

const COINS_URL = (limit) =>
  `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;

const YAHOO_CHART = (ticker) =>
  `https://api.allorigins.win/get?url=${encodeURIComponent(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
  )}`;

const COIN_CHART = (id) =>
  `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7`;

const STOCK_TICKERS = ['AAPL','MSFT','GOOGL','AMZN','TSLA','NVDA','META','NFLX','AMD','INTC'];

let cryptoData = [];
let stockData = [];
let watchlist = JSON.parse(localStorage.getItem('dash-watchlist') || '[]');
let cryptoChart = null;

// ---------- Utilidades ----------
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const fmtBig = (n) => {
  if (n == null) return '—';
  if (n >= 1e12) return (n/1e12).toFixed(2)+'T';
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  return fmt(n);
};
const pctClass = (v) => (v >= 0 ? 'pos' : 'neg');
const pctStr = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%');

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  });
});

// ---------- Crypto ----------
async function loadCrypto() {
  const limit = document.getElementById('cryptoLimit').value;
  const body = document.getElementById('cryptoBody');
  body.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
  try {
    const r = await fetch(COINS_URL(limit));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    cryptoData = await r.json();
    renderCrypto();
    document.getElementById('lastUpdate').textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-AR');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="neg">Error al cargar cripto: ${e.message}</td></tr>`;
  }
}

function renderCrypto() {
  const q = document.getElementById('cryptoSearch').value.toLowerCase().trim();
  const rows = cryptoData.filter((c) =>
    !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
  );
  const body = document.getElementById('cryptoBody');
  if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>'; return; }
  body.innerHTML = rows.map((c) => `
    <tr>
      <td>${c.market_cap_rank ?? '—'}</td>
      <td><img src="${c.image}" alt="" width="18" style="vertical-align:middle;margin-right:6px;border-radius:50%">${c.name} <span class="muted">(${c.symbol.toUpperCase()})</span></td>
      <td>$${fmt(c.current_price)}</td>
      <td class="${pctClass(c.price_change_percentage_24h)}">${pctStr(c.price_change_percentage_24h)}</td>
      <td>$${fmtBig(c.market_cap)}</td>
      <td>
        <button class="btn small" data-action="chart" data-id="${c.id}" data-name="${encodeURIComponent(c.name)}">Gráfico</button>
        <button class="btn small" data-action="watch" data-id="${c.id}" data-type="crypto" data-name="${encodeURIComponent(c.name)}" data-price="${c.current_price}" data-change="${c.price_change_percentage_24h}">★</button>
      </td>
    </tr>`).join('');
}

async function showCryptoChart(id, name) {
  document.getElementById('cryptoChartTitle').textContent = `${name} — 7 días`;
  try {
    const r = await fetch(COIN_CHART(id));
    const j = await r.json();
    const labels = j.prices.map((p) => new Date(p[0]).toLocaleDateString('es-AR'));
    const values = j.prices.map((p) => p[1]);
    drawChart('cryptoChart', labels, values, '#6366f1');
  } catch (e) {
    document.getElementById('cryptoChartTitle').textContent = 'Error cargando gráfico';
  }
}

// ---------- Stocks ----------
async function loadStocks() {
  const body = document.getElementById('stockBody');
  body.innerHTML = '<tr><td colspan="6" class="muted">Cargando…</td></tr>';
  const results = await Promise.all(STOCK_TICKERS.map(async (t) => {
    try {
      const r = await fetch(YAHOO_CHART(t));
      const j = await r.json();
      const parsed = JSON.parse(j.contents);
      const meta = parsed.chart.result[0].meta;
      return {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol,
        price: meta.regularMarketPrice,
        changePct: meta.regularMarketChangePercent,
        volume: meta.regularMarketVolume,
      };
    } catch (e) {
      return { symbol: t, name: t, price: null, changePct: null, volume: null, error: true };
    }
  }));
  stockData = results;
  renderStocks();
  document.getElementById('lastUpdate').textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-AR');
}

function renderStocks() {
  const q = document.getElementById('stockSearch').value.toLowerCase().trim();
  const rows = stockData.filter((s) => !q || s.symbol.toLowerCase().includes(q) || (s.name||'').toLowerCase().includes(q));
  const body = document.getElementById('stockBody');
  if (!rows.length) { body.innerHTML = '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>'; return; }
  body.innerHTML = rows.map((s) => `
    <tr>
      <td><strong>${s.symbol}</strong></td>
      <td>${s.name}</td>
      <td>${s.price == null ? '—' : '$'+fmt(s.price)}</td>
      <td class="${pctClass(s.changePct)}">${pctStr(s.changePct)}</td>
      <td>${s.volume == null ? '—' : fmtBig(s.volume)}</td>
      <td>
        <button class="btn small" data-action="watch" data-id="${s.symbol}" data-type="stock" data-name="${encodeURIComponent(s.name)}" data-price="${s.price}" data-change="${s.changePct}">★</button>
      </td>
    </tr>`).join('');
}

// Agregar ticker manual
document.getElementById('addStockBtn').addEventListener('click', () => {
  const t = prompt('Ticker (ej. AAPL):');
  if (!t) return;
  const up = t.trim().toUpperCase();
  if (!STOCK_TICKERS.includes(up)) STOCK_TICKERS.push(up);
  loadStocks();
});

// ---------- Watchlist ----------
function saveWatch() { localStorage.setItem('dash-watchlist', JSON.stringify(watchlist)); }
function addToWatch(id, type, name, price, change) {
  if (watchlist.find((w) => w.id === id && w.type === type)) { alert('Ya está en tu watchlist.'); return; }
  watchlist.push({ id, type, name, price: Number(price), change: Number(change) });
  saveWatch();
  renderWatch();
}
function removeFromWatch(id, type) {
  watchlist = watchlist.filter((w) => !(w.id === id && w.type === type));
  saveWatch();
  renderWatch();
}
function renderWatch() {
  const body = document.getElementById('watchBody');
  if (!watchlist.length) { body.innerHTML = '<tr><td colspan="5" class="muted">Vacía. Agrega desde las otras pestañas.</td></tr>'; return; }
  body.innerHTML = watchlist.map((w) => `
    <tr>
      <td>${w.name} <span class="muted">(${w.id})</span></td>
      <td>${w.type === 'crypto' ? 'Cripto' : 'Acción'}</td>
      <td>$${fmt(w.price)}</td>
      <td class="${pctClass(w.change)}">${pctStr(w.change)}</td>
      <td><button class="btn small danger" data-action="remove" data-id="${w.id}" data-type="${w.type}">Quitar</button></td>
    </tr>`).join('');
}

// ---------- Chart ----------
function drawChart(canvasId, labels, values, color) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (cryptoChart) cryptoChart.destroy();
  cryptoChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: values, borderColor: color, backgroundColor: color+'33', fill: true, tension: 0.3, pointRadius: 0 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8fa0bf', maxTicksLimit: 7 } },
        y: { ticks: { color: '#8fa0bf', callback: (v) => '$' + v.toFixed(2) } }
      }
    }
  });
}

// ---------- Delegación de eventos (evita inline handlers bloqueados por CSP) ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'chart') {
    showCryptoChart(btn.dataset.id, decodeURIComponent(btn.dataset.name));
  } else if (action === 'watch') {
    addToWatch(btn.dataset.id, btn.dataset.type, decodeURIComponent(btn.dataset.name), btn.dataset.price, btn.dataset.change);
  } else if (action === 'remove') {
    removeFromWatch(btn.dataset.id, btn.dataset.type);
  }
});

// ---------- Eventos ----------
document.getElementById('cryptoSearch').addEventListener('input', renderCrypto);
document.getElementById('cryptoLimit').addEventListener('change', loadCrypto);
document.getElementById('stockSearch').addEventListener('input', renderStocks);
document.getElementById('refreshBtn').addEventListener('click', () => { loadCrypto(); loadStocks(); });

// ---------- Init ----------
renderWatch();
loadCrypto();
loadStocks();
setInterval(() => { loadCrypto(); loadStocks(); }, 60000);
