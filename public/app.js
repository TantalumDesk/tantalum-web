// ═══════════════════════════════════════════════════════════════════════════
// TANTALUM WEB — Frontend App
// ═══════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
let watches = [], accessories = [], estimates = [], jobs = [], customers = [];
let purchases = [], outgoingInvoices = [], expenses = [], appraisals = [], dealers = [];
let notebook = { notes: [], leads: [], tasks: [], wantList: [] };
let settings = {};
let invoiceNextNumber = 1101;
let currentEstimateId = null;
let editingWatchId = null;
let filterStatus = 'all';

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res.json();
}
const GET  = path => api('GET', path);
const POST = (path, body) => api('POST', path, body);
const DEL  = path => api('DELETE', path);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    [settings, watches, accessories, estimates, customers, jobs, notebook] = await Promise.all([
      GET('/settings'), GET('/watches'), GET('/accessories'),
      GET('/estimates'), GET('/customers'), GET('/jobs'), GET('/notebook')
    ]);
    const invData = await GET('/invoices/outgoing');
    outgoingInvoices = invData.items || [];
    invoiceNextNumber = invData.nextNumber || 1101;
    purchases = await GET('/invoices/purchases');
    expenses  = await GET('/invoices/expenses');
    dealers   = await GET('/invoices/dealers');
    appraisals = await GET('/invoices/appraisals');

    applyTheme(settings.theme);
    setupNav();
    setupMobileMenu();
    setupLogout();
    setupThemeToggle();
    setupEstimateForm();
    setupWatchForm();
    renderInventory();
    renderHistory();
    switchView('dashboard');
    renderDashboard();
  } catch(e) {
    console.error('Init error:', e);
    showToast('Error loading data');
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.classList.toggle('light-mode', theme === 'light');
  const sw = document.getElementById('toggle-switch');
  const lbl = document.getElementById('theme-label');
  if (sw) sw.classList.toggle('on', theme !== 'light');
  if (lbl) lbl.textContent = theme === 'light' ? 'Light Mode' : 'Dark Mode';
}

function setupThemeToggle() {
  document.getElementById('theme-toggle')?.addEventListener('click', async () => {
    settings.theme = settings.theme === 'light' ? 'dark' : 'light';
    applyTheme(settings.theme);
    await POST('/settings', { theme: settings.theme });
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      // Close mobile menu
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('visible');
    });
  });
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name) || document.getElementById('view-new');
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));

  // Render relevant view
  if (name === 'dashboard')         renderDashboard();
  if (name === 'history')           renderHistory();
  if (name === 'inventory')         renderInventory();
  if (name === 'customers')         renderCustomers();
  if (name === 'purchase-log')      renderPurchaseLog();
  if (name === 'outgoing-invoices') renderOutgoingInvoices();
  if (name === 'dealers')           renderDealers();
  if (name === 'notebook')          renderNotebook();
  if (name === 'repair-jobs')       renderJobs();
  if (name === 'reports')           renderReports();
  if (name === 'settings')          loadSettingsForm();
  if (name === 'appraisals')        renderAppraisals();
  if (name === 'accessories')       renderAccessories();
}

// ── Mobile menu ───────────────────────────────────────────────────────────────
function setupMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', sidebar.classList.contains('open'));
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────
function setupLogout() {
  async function logout() {
    await POST('/logout');
    window.location.href = '/login';
  }
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('mobile-logout')?.addEventListener('click', logout);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function genId() { return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(v) { const n=parseFloat(v); return isNaN(n)?'—':'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function renderDashboard() {
  // Stats
  const inStock = watches.filter(w => w.status !== 'Sold');
  const invested = inStock.reduce((a,w) => a+(parseFloat(w.cost)||0), 0);
  const soldW = watches.filter(w => w.soldPrice && w.cost);
  const profit = soldW.reduce((a,w) => a+(parseFloat(w.soldPrice)-parseFloat(w.cost)), 0);
  const pending = estimates.filter(e => (e.jobStatus||'Pending Approval') === 'Pending Approval');
  const leads = (notebook.leads||[]).filter(l => !l.closed);

  document.getElementById('dash-stats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-label">Watches In Stock</div><div class="dash-stat-val">${inStock.length}</div><div class="dash-stat-sub">${watches.length} total</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Total Invested</div><div class="dash-stat-val">${fmt(invested)}</div><div class="dash-stat-sub">current inventory</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Net Profit</div><div class="dash-stat-val" style="color:var(--green)">${fmt(profit)}</div><div class="dash-stat-sub">${soldW.length} sold total</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Pending Estimates</div><div class="dash-stat-val">${pending.length}</div><div class="dash-stat-sub">awaiting approval</div></div>
    <div class="dash-stat"><div class="dash-stat-label">Open Leads</div><div class="dash-stat-val">${leads.length}</div><div class="dash-stat-sub">potential buyers</div></div>
  `;

  // Recent activity
  const recent = [...watches].sort((a,b) => new Date(b.dateAdded)-new Date(a.dateAdded)).slice(0,5);
  document.getElementById('dash-recent').innerHTML = recent.length
    ? recent.map(w => `<div class="dash-est-item" onclick="switchView('inventory')" style="border-left-color:var(--blue)"><div style="font-weight:600">${escHtml(w.brand)} ${escHtml(w.model)}</div><div style="font-size:12px;color:var(--text2)">${escHtml(w.stockNum||'')} · ${escHtml(w.status)}</div></div>`).join('')
    : '<div class="dash-empty">No watches yet.</div>';

  // Pending estimates
  document.getElementById('dash-estimates').innerHTML = pending.length
    ? pending.slice(0,5).map(e => `<div class="dash-est-item" onclick="switchView('history')"><div style="font-weight:600">${escHtml(e.customer?.name||'—')}</div><div style="font-size:12px;color:var(--text2)">${escHtml([e.watch?.brand,e.watch?.model].filter(Boolean).join(' ')||'Watch')} · ${fmt(e.total)}</div></div>`).join('')
    : '<div class="dash-empty">No pending estimates.</div>';

  // Leads
  document.getElementById('dash-leads').innerHTML = leads.length
    ? leads.slice(0,5).map(l => `<div class="dash-est-item" onclick="switchView('notebook')" style="border-left-color:var(--blue)"><div style="font-weight:600">${escHtml(l.name||'—')}</div><div style="font-size:12px;color:var(--text2)">${escHtml(l.looking||'')}</div></div>`).join('')
    : '<div class="dash-empty">No open leads.</div>';

  // Alerts
  renderDashAlerts();

  // Quick actions
  document.getElementById('dash-actions').innerHTML = `
    <button class="dash-action-btn" onclick="switchView('new')">+ New Estimate</button>
    <button class="dash-action-btn" onclick="switchView('watch-add')">+ Add Watch</button>
    <button class="dash-action-btn" onclick="switchView('history')">Estimates & Jobs</button>
  `;

  // Want list
  const wl = notebook.wantList || [];
  document.getElementById('dash-wantlist').innerHTML = wl.length
    ? wl.map(w => `<div class="dash-est-item" style="border-left-color:var(--green)"><div style="font-weight:600">${escHtml(w.brand)} ${escHtml(w.model||'')}</div><div style="font-size:12px;color:var(--text2)">${w.maxBudget?'Up to '+fmt(w.maxBudget):''}</div></div>`).join('')
    : '<div class="dash-empty">Nothing on your want list yet.</div>';
}

function renderDashAlerts() {
  const el = document.getElementById('dash-alerts');
  if (!el) return;
  const today = new Date();
  const alerts = [];

  // Expiry alerts
  if (settings.expiryAlertsEnabled !== false) {
    const expiryDays = settings.estimateExpiryDays || 30;
    estimates.forEach(e => {
      if (e.jobStatus && e.jobStatus !== 'Pending Approval') return;
      const created = new Date(e.date);
      const daysOld = Math.floor((today - created) / 86400000);
      const daysLeft = expiryDays - daysOld;
      if (daysLeft <= 5) alerts.push({ type:'expiry', est:e, daysLeft });
    });
  }

  // Follow-up reminders
  if (settings.followupRemindersEnabled !== false) {
    customers.forEach(c => {
      if (!c.followupDate) return;
      const fd = new Date(c.followupDate);
      const days = Math.ceil((fd - today) / 86400000);
      if (days >= -1 && days <= 14) alerts.push({ type:'followup', name:c.name, date:c.followupDate, days, note:c.followupNote });
    });
  }

  // Birthday reminders
  if (settings.birthdayRemindersEnabled !== false) {
    customers.forEach(c => {
      if (!c.birthday) return;
      try {
        const bStr = c.birthday.replace(/(\d+)\/(\d+)/, '$1/$2/' + today.getFullYear());
        const bDate = new Date(bStr);
        if (isNaN(bDate)) return;
        bDate.setFullYear(today.getFullYear());
        if (bDate < today) bDate.setFullYear(today.getFullYear() + 1);
        const days = Math.ceil((bDate - today) / 86400000);
        if (days >= 0 && days <= 14) alerts.push({ type:'birthday', name:c.name, days, date:bDate.toLocaleDateString('en-US',{month:'long',day:'numeric'}) });
      } catch(e2) {}
    });
  }

  if (!alerts.length) { el.innerHTML = '<div class="dash-empty">No alerts.</div>'; return; }
  el.innerHTML = alerts.map(a => {
    if (a.type === 'expiry') return `<div class="dash-est-item" style="border-left-color:var(--gold)"><div style="font-weight:600;color:var(--gold2)">⏰ Expiring${a.daysLeft<=0?' — EXPIRED':' in '+a.daysLeft+'d'}</div><div style="font-size:12px;color:var(--text2)">Job #${escHtml(a.est.customer?.name||'—')}</div></div>`;
    if (a.type === 'followup') return `<div class="dash-est-item" style="border-left-color:var(--blue)"><div style="font-weight:600;color:var(--blue)">📞 Follow-up: ${escHtml(a.name)}</div><div style="font-size:12px;color:var(--text2)">${escHtml(a.date||'')}${a.note?' · '+escHtml(a.note):''}</div></div>`;
    if (a.type === 'birthday') return `<div class="dash-est-item" style="border-left-color:var(--green)"><div style="font-weight:600;color:var(--green)">🎂 Birthday: ${escHtml(a.name)}</div><div style="font-size:12px;color:var(--text2)">${escHtml(a.date)}${a.days===0?' — Today!':' in '+a.days+'d'}</div></div>`;
    return '';
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTIMATES
// ═══════════════════════════════════════════════════════════════════════════
function setupEstimateForm() {
  document.getElementById('btn-add-service')?.addEventListener('click', () => addServiceRow());
  document.getElementById('btn-add-optional')?.addEventListener('click', () => addOptionalRow());
  document.getElementById('shipping-amount')?.addEventListener('input', recalcTotal);
  document.getElementById('btn-clear')?.addEventListener('click', clearEstimateForm);
  document.getElementById('btn-new-estimate-from-history')?.addEventListener('click', () => switchView('new'));
  document.getElementById('btn-save')?.addEventListener('click', saveEstimate);
  document.getElementById('history-search')?.addEventListener('input', renderHistory);
}

function addServiceRow(name='', price='') {
  const row = document.createElement('div');
  row.className = 'service-row';
  row.innerHTML = `<input class="field service-name" type="text" placeholder="Service description" value="${escHtml(name)}"/><input class="field service-price" type="number" placeholder="0.00" value="${price}" min="0" step="0.01" style="width:90px"/><button class="btn-remove">×</button>`;
  row.querySelector('.btn-remove').addEventListener('click', () => { row.remove(); recalcTotal(); });
  row.querySelector('.service-price').addEventListener('input', recalcTotal);
  document.getElementById('services-list').appendChild(row);
  recalcTotal();
}

function addOptionalRow(name='', price='') {
  const row = document.createElement('div');
  row.className = 'optional-row';
  row.innerHTML = `<input class="field service-name" type="text" placeholder="Optional item" value="${escHtml(name)}"/><input class="field service-price" type="number" placeholder="0.00" value="${price}" min="0" step="0.01" style="width:90px"/><button class="btn-remove">×</button>`;
  row.querySelector('.btn-remove').addEventListener('click', () => { row.remove(); recalcTotal(); });
  row.querySelector('.service-price').addEventListener('input', recalcTotal);
  document.getElementById('optional-list').appendChild(row);
  recalcTotal();
}

function recalcTotal() {
  const prices = [...document.querySelectorAll('#services-list .service-price')].map(i => parseFloat(i.value)||0);
  const subtotal = prices.reduce((a,b) => a+b, 0);
  const shipping = parseFloat(document.getElementById('shipping-amount')?.value)||0;
  const taxRate = parseFloat(settings.taxRate)||0;
  const taxAmt = subtotal * (taxRate/100);
  const total = subtotal + shipping + taxAmt;
  if (document.getElementById('subtotal-display')) document.getElementById('subtotal-display').textContent = '$'+subtotal.toFixed(2);
  if (document.getElementById('total-display')) document.getElementById('total-display').textContent = '$'+total.toFixed(2);
  return { subtotal, shipping, taxRate, taxAmt, total };
}

function clearEstimateForm() {
  currentEstimateId = null;
  ['cust-name','cust-phone','watch-brand','watch-model','watch-serial','notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('cust-email').value = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  document.getElementById('services-list').innerHTML = '';
  document.getElementById('optional-list').innerHTML = '';
  document.getElementById('shipping-amount').value = '75';
  recalcTotal();
}

async function saveEstimate() {
  const g = id => document.getElementById(id)?.value.trim()||'';
  const rows = document.querySelectorAll('#services-list .service-row');
  const lineItems = [...rows].map(r=>({name:r.querySelector('.service-name').value.trim(),price:parseFloat(r.querySelector('.service-price').value)||0})).filter(i=>i.name);
  const optRows = document.querySelectorAll('#optional-list .optional-row');
  const optionalItems = [...optRows].map(r=>({name:r.querySelector('.service-name').value.trim(),price:parseFloat(r.querySelector('.service-price').value)||0})).filter(i=>i.name);
  const { subtotal, shipping, taxRate, taxAmt, total } = recalcTotal();
  if (!g('cust-name')) { showToast('Please enter a job number'); return; }
  const est = {
    id: currentEstimateId || genId(),
    date: new Date().toISOString(),
    customer: { name:g('cust-name'), email:g('cust-email'), phone:g('cust-phone') },
    watch: { brand:g('watch-brand'), model:g('watch-model'), serial:g('watch-serial') },
    lineItems, optionalItems, subtotal, shipping, taxRate, taxAmt, total,
    notes: g('notes'), jobStatus: 'Pending Approval'
  };
  await POST('/estimates', est);
  estimates = await GET('/estimates');
  currentEstimateId = est.id;
  showToast('Estimate saved ✓');
}

function renderHistory() {
  const q = (document.getElementById('history-search')?.value||'').toLowerCase();
  const list = document.getElementById('history-list');
  if (!list) return;
  const filtered = estimates.filter(e =>
    !q || (e.customer?.name||'').toLowerCase().includes(q) ||
    (e.watch?.brand||'').toLowerCase().includes(q) ||
    (e.watch?.model||'').toLowerCase().includes(q)
  ).sort((a,b) => new Date(b.date)-new Date(a.date));
  if (!filtered.length) { list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No estimates yet.</div>'; return; }
  list.innerHTML = filtered.map(e => {
    const watch = [e.watch?.brand, e.watch?.model].filter(Boolean).join(' ') || 'No watch info';
    const date = new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const status = e.jobStatus || 'Pending Approval';
    return `<div class="hist-card" data-id="${e.id}">
      <div class="hist-card-top">
        <div><div class="hist-card-name">Job #${escHtml(e.customer?.name||'—')}</div><div class="hist-card-watch">${escHtml(watch)}</div></div>
        <div><div class="hist-card-total">${fmt(e.total)}</div><div class="hist-card-date">${date}</div></div>
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;background:var(--bg3);padding:2px 8px;border-radius:10px;color:var(--text2)">${escHtml(status)}</span>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.hist-card').forEach(card => {
    card.addEventListener('click', () => {
      const e = estimates.find(x => x.id === card.dataset.id);
      if (e) openEstimateDetail(e);
    });
  });
}

function openEstimateDetail(e) {
  const watch = [e.watch?.brand, e.watch?.model].filter(Boolean).join(' ') || 'Watch';
  const date = new Date(e.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  showModal('Estimate Detail', `
    <div style="margin-bottom:12px"><strong>Job #${escHtml(e.customer?.name||'—')}</strong> — ${escHtml(watch)}</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${date} · ${escHtml(e.customer?.phone||'')}</div>
    ${e.lineItems.map(i=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px"><span>${escHtml(i.name)}</span><span>${fmt(i.price)}</span></div>`).join('')}
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-weight:600;color:var(--gold2)"><span>Total</span><span>${fmt(e.total)}</span></div>
    ${e.notes?`<div style="font-size:13px;color:var(--text2);margin-top:8px">${escHtml(e.notes)}</div>`:''}
  `, [
    { label:'Load & Edit', action: () => { loadEstimateIntoForm(e); closeModal(); switchView('new'); } },
    { label:'Delete', danger:true, action: async () => { if(confirm('Delete this estimate?')) { await DEL('/estimates/'+e.id); estimates = await GET('/estimates'); renderHistory(); closeModal(); showToast('Deleted.'); } } }
  ]);
}

function loadEstimateIntoForm(e) {
  currentEstimateId = e.id;
  document.getElementById('cust-name').value = e.customer?.name||'';
  document.getElementById('cust-email').value = e.customer?.email||'';
  document.getElementById('cust-phone').value = e.customer?.phone||'';
  document.getElementById('watch-brand').value = e.watch?.brand||'';
  document.getElementById('watch-model').value = e.watch?.model||'';
  document.getElementById('watch-serial').value = e.watch?.serial||'';
  document.getElementById('notes').value = e.notes||'';
  document.getElementById('shipping-amount').value = e.shipping||'0';
  document.getElementById('services-list').innerHTML = '';
  document.getElementById('optional-list').innerHTML = '';
  (e.optionalItems||[]).forEach(i => addOptionalRow(i.name, i.price));
  (e.lineItems||[]).forEach(i => addServiceRow(i.name, i.price));
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════
function renderInventory() {
  const q = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const grid = document.getElementById('watch-grid');
  if (!grid) return;

  // Stats
  const statsBar = document.getElementById('stats-bar');
  if (statsBar) {
    const inStock = watches.filter(w=>w.status!=='Sold').length;
    const invested = watches.reduce((a,w)=>a+(parseFloat(w.cost)||0),0);
    statsBar.innerHTML = `<div class="stat-chip"><div class="stat-chip-label">Total</div><div class="stat-chip-val">${watches.length}</div></div><div class="stat-chip"><div class="stat-chip-label">In Stock</div><div class="stat-chip-val">${inStock}</div></div><div class="stat-chip"><div class="stat-chip-label">Invested</div><div class="stat-chip-val" style="font-size:15px">${fmt(invested)}</div></div>`;
  }

  // Filter pills
  const pillsEl = document.getElementById('filter-pills');
  if (pillsEl && pillsEl.children.length === 0) {
    pillsEl.innerHTML = `<button class="btn-add ${filterStatus==='all'?'active':''}" data-f="all">All</button>` +
      (settings.statuses||[]).map(s=>`<button class="btn-add ${filterStatus===s?'active':''}" data-f="${escHtml(s)}">${escHtml(s)}</button>`).join('');
    pillsEl.querySelectorAll('[data-f]').forEach(p => p.addEventListener('click', () => { filterStatus=p.dataset.f; renderInventory(); }));
  }

  const list = watches.filter(w => {
    if (filterStatus!=='all' && w.status!==filterStatus) return false;
    if (q) return [w.stockNum,w.brand,w.model,w.ref,w.serial].join(' ').toLowerCase().includes(q);
    return true;
  });

  if (!list.length) { grid.innerHTML = `<div class="watch-empty">⌚<br>${watches.length?'No watches match your filter.':'No watches yet — click Add Watch to get started.'}</div>`; return; }
  grid.innerHTML = list.map(w => `
    <div class="watch-card" data-id="${w.id}">
      <div class="watch-card-img">${w.photos&&Object.values(w.photos).find(p=>p)?`<img src="${Object.values(w.photos).find(p=>p)}" alt="${escHtml(w.brand)}"/>`:``}⌚${w.stockNum?`<div class="watch-stock-tag">${escHtml(w.stockNum)}</div>`:''}</div>
      <div class="watch-card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="badge" style="background:var(--bg3);color:var(--text2)">${escHtml(w.status)}</span>
          <span style="font-size:11px;color:var(--text3);font-family:monospace">${escHtml(w.ref||'')}</span>
        </div>
        <div class="watch-brand">${escHtml(w.brand||'—')}</div>
        <div class="watch-model">${escHtml(w.model||'—')}</div>
        ${(w.dialColor||w.bracelet)?`<div class="watch-card-meta">${[w.dialColor,w.bracelet].filter(Boolean).map(escHtml).join(' · ')}</div>`:''}
        <hr class="watch-card-divider"/>
        <div class="watch-card-prices">
          <div><div class="price-col-label">Cost</div><div class="price-col-val">${fmt(w.cost)}</div></div>
          ${w.retailPrice?`<div style="text-align:right"><div class="price-col-label">Retail</div><div class="price-col-val">${fmt(w.retailPrice)}</div></div>`:''}
        </div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.watch-card').forEach(c => c.addEventListener('click', () => openWatchModal(c.dataset.id)));

  // Setup search
  const searchEl = document.getElementById('inv-search');
  if (searchEl && !searchEl._wired) { searchEl._wired=true; searchEl.addEventListener('input', renderInventory); }
  const addBtn = document.getElementById('btn-add-watch-nav');
  if (addBtn && !addBtn._wired) { addBtn._wired=true; addBtn.addEventListener('click', () => switchView('watch-add')); }
}

function openWatchModal(id) {
  const w = watches.find(x=>x.id===id);
  if (!w) return;
  const rp = (w.cost&&w.retailPrice)?parseFloat(w.retailPrice)-parseFloat(w.cost):null;
  showModal(w.brand+' '+w.model, `
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div style="width:80px;height:80px;background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">⌚</div>
      <div>
        <div style="font-size:11px;color:var(--gold);font-family:monospace;margin-bottom:4px">${escHtml(w.stockNum||'')}</div>
        <div style="font-size:18px;font-family:var(--font-serif)">${escHtml(w.brand||'—')}</div>
        <div style="color:var(--text2)">${escHtml(w.model||'—')}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">Ref: ${escHtml(w.ref||'—')} · Serial: ${escHtml(w.serial||'—')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${detail('Condition',w.condition)}${detail('Dial Color',w.dialColor)}
      ${detail('Bracelet',w.bracelet)}${detail('Accessories',w.accessories)}
      ${detail('Cost',fmt(w.cost))}${detail('Retail',fmt(w.retailPrice))}
      ${rp!==null?detail('Retail Profit',(rp>=0?'+':'')+fmt(rp),'color:'+(rp>=0?'var(--green)':'var(--red)')):''}
      ${detail('Status',w.status)}${detail('Source',w.sourceName)}
    </div>
    ${w.notes?`<div style="margin-top:12px;padding:10px;background:var(--bg3);border-radius:6px;font-size:13px;color:var(--text2)">${escHtml(w.notes)}</div>`:''}
  `, [
    { label:'Edit', action: () => { editWatch(w); closeModal(); } },
    { label:'Delete', danger:true, action: async () => { if(confirm('Delete this watch?')) { await DEL('/watches/'+w.id); watches = await GET('/watches'); renderInventory(); closeModal(); showToast('Watch deleted.'); } } }
  ]);
}

function detail(label, val, style='') { return val?`<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text3);margin-bottom:2px">${escHtml(label)}</div><div style="font-size:14px;${style}">${escHtml(val)}</div></div>`:''; }

// ── Watch form ─────────────────────────────────────────────────────────────────
function setupWatchForm() {
  const body = document.getElementById('watch-form-body');
  if (!body) return;
  body.innerHTML = `
    <div class="form-row two-col">
      <div class="card"><div class="card-label">Watch Details</div>
        <div class="field-group"><label class="field-label">Stock #</label><input class="field" id="f-stock" type="text" placeholder="Auto-assigned" readonly/></div>
        <div class="field-group"><label class="field-label">Status</label><input class="field" id="f-status" type="text" placeholder="Status…"/></div>
        <div class="field-group"><label class="field-label">Brand</label><input class="field" id="f-brand" type="text" placeholder="Brand…"/></div>
        <div class="field-group"><label class="field-label">Model</label><input class="field" id="f-model" type="text" placeholder="Model…"/></div>
        <div class="field-group"><label class="field-label">Reference #</label><input class="field" id="f-ref" type="text" placeholder="e.g. 116610LN"/></div>
        <div class="field-group"><label class="field-label">Serial #</label><input class="field" id="f-serial" type="text" placeholder="Serial #"/></div>
        <div class="field-group"><label class="field-label">Condition</label><input class="field" id="f-condition" type="text" placeholder="Condition…"/></div>
        <div class="field-group"><label class="field-label">Accessories</label><input class="field" id="f-accessories" type="text" placeholder="Box & Papers, etc."/></div>
        <div class="field-group"><label class="field-label">Dial Color</label><input class="field" id="f-dial-color" type="text" placeholder="e.g. Black, Blue…"/></div>
        <div class="field-group"><label class="field-label">Bracelet Type</label><input class="field" id="f-bracelet" type="text" placeholder="e.g. Oyster, Jubilee…"/></div>
        <div class="field-group"><label class="field-label">Notes</label><textarea class="field" id="f-notes" rows="3" placeholder="Service history, condition details…"></textarea></div>
      </div>
      <div class="card"><div class="card-label">Pricing</div>
        <div class="field-group"><label class="field-label">Cost</label><input class="field" id="f-cost" type="number" step="0.01" placeholder="0.00"/></div>
        <div class="field-group"><label class="field-label">Retail Price</label><input class="field" id="f-retail" type="number" step="0.01" placeholder="0.00"/></div>
        <div class="field-group"><label class="field-label">Wholesale Price</label><input class="field" id="f-wholesale" type="number" step="0.01" placeholder="0.00"/></div>
        <div class="field-group"><label class="field-label">Sold Price</label><input class="field" id="f-sold-price" type="number" step="0.01" placeholder="0.00"/></div>
        <div class="card-label" style="margin-top:16px">Purchase / Source</div>
        <div class="field-group"><label class="field-label">Source Type</label>
          <select class="field" id="f-source-type">
            <option value="">Select…</option>
            <option>Private Sale</option><option>Auction</option><option>Trade-in</option>
            <option>Estate Sale</option><option>Watch Show</option><option>Dealer</option><option>Other</option>
          </select>
        </div>
        <div class="field-group"><label class="field-label">Purchase Date</label><input class="field" id="f-purchase-date" type="text" placeholder="e.g. April 15, 2026"/></div>
        <div class="field-group"><label class="field-label">Seller / Source Name</label><input class="field" id="f-source-name" type="text" placeholder="Name or business"/></div>
        <div class="field-group"><label class="field-label">Seller Contact</label><input class="field" id="f-source-contact" type="text" placeholder="Phone or email"/></div>
      </div>
    </div>`;

  document.getElementById('btn-save-watch')?.addEventListener('click', saveWatch);
  document.getElementById('btn-delete-watch')?.addEventListener('click', async () => {
    if (!editingWatchId || !confirm('Delete this watch?')) return;
    await DEL('/watches/'+editingWatchId);
    watches = await GET('/watches');
    editingWatchId = null;
    clearWatchForm();
    renderInventory();
    switchView('inventory');
    showToast('Watch deleted.');
  });
  document.getElementById('btn-clear-watch-form')?.addEventListener('click', () => { editingWatchId=null; clearWatchForm(); document.getElementById('watch-form-title').textContent='Add Watch'; document.getElementById('btn-delete-watch')?.classList.add('hidden'); });
  clearWatchForm();
}

function clearWatchForm() {
  ['f-brand','f-model','f-ref','f-serial','f-condition','f-accessories','f-dial-color','f-bracelet','f-notes','f-cost','f-retail','f-wholesale','f-sold-price','f-source-name','f-source-contact','f-purchase-date'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const stockEl = document.getElementById('f-stock');
  if (stockEl) stockEl.value = 'PRW'+((settings.lastStockNum||2000)+1);
  const statusEl = document.getElementById('f-status');
  if (statusEl) statusEl.value = (settings.statuses||['In Stock'])[0];
  const sourceEl = document.getElementById('f-source-type');
  if (sourceEl) sourceEl.value = '';
}

function editWatch(w) {
  editingWatchId = w.id;
  switchView('watch-add');
  document.getElementById('watch-form-title').textContent = 'Edit Watch';
  document.getElementById('btn-delete-watch')?.classList.remove('hidden');
  document.getElementById('f-stock').value = w.stockNum||'';
  document.getElementById('f-brand').value = w.brand||'';
  document.getElementById('f-model').value = w.model||'';
  document.getElementById('f-ref').value = w.ref||'';
  document.getElementById('f-serial').value = w.serial||'';
  document.getElementById('f-condition').value = w.condition||'';
  document.getElementById('f-accessories').value = w.accessories||'';
  document.getElementById('f-dial-color').value = w.dialColor||'';
  document.getElementById('f-bracelet').value = w.bracelet||'';
  document.getElementById('f-notes').value = w.notes||'';
  document.getElementById('f-cost').value = w.cost||'';
  document.getElementById('f-retail').value = w.retailPrice||'';
  document.getElementById('f-wholesale').value = w.wholesalePrice||'';
  document.getElementById('f-sold-price').value = w.soldPrice||'';
  document.getElementById('f-source-type').value = w.sourceType||'';
  document.getElementById('f-purchase-date').value = w.purchaseDate||'';
  document.getElementById('f-source-name').value = w.sourceName||'';
  document.getElementById('f-source-contact').value = w.sourceContact||'';
  document.getElementById('f-status').value = w.status||'';
}

async function saveWatch() {
  const g = id => document.getElementById(id)?.value.trim()||'';
  const sn = g('f-stock') || ('PRW'+((settings.lastStockNum||2000)+1));
  const data = {
    id: editingWatchId || genId(),
    stockNum: sn, brand: g('f-brand'), model: g('f-model'),
    ref: g('f-ref'), serial: g('f-serial'), condition: g('f-condition'),
    accessories: g('f-accessories'), dialColor: g('f-dial-color'), bracelet: g('f-bracelet'),
    notes: g('f-notes'), cost: parseFloat(g('f-cost'))||null,
    retailPrice: parseFloat(g('f-retail'))||null,
    wholesalePrice: parseFloat(g('f-wholesale'))||null,
    soldPrice: parseFloat(g('f-sold-price'))||null,
    status: g('f-status')||(settings.statuses||['In Stock'])[0],
    sourceType: g('f-source-type'), purchaseDate: g('f-purchase-date'),
    sourceName: g('f-source-name'), sourceContact: g('f-source-contact'),
    dateAdded: new Date().toISOString()
  };
  if (!editingWatchId) {
    settings.lastStockNum = (settings.lastStockNum||2000)+1;
    await POST('/settings', { lastStockNum: settings.lastStockNum });
    // Auto-create purchase log entry
    if (data.cost) {
      const pl = { id:genId(), watchDesc:[data.brand,data.model,data.stockNum].filter(Boolean).join(' — '), dealerName:data.sourceName||'', date:data.purchaseDate||new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}), amount:data.cost, type:data.sourceType||'dealer', paymentMethod:'cash', notes:'', status:'complete', linkedWatchId:data.id, autoCreated:true, createdAt:new Date().toISOString() };
      await POST('/invoices/purchases', pl);
      purchases = await GET('/invoices/purchases');
    }
  }
  await POST('/watches', data);
  watches = await GET('/watches');
  editingWatchId = null;
  clearWatchForm();
  renderInventory();
  switchView('inventory');
  showToast(editingWatchId?'Watch updated.':'Watch added — '+sn);
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════
function renderCustomers() {
  const q = (document.getElementById('cust-search')?.value||'').toLowerCase();
  const list = document.getElementById('customer-list');
  if (!list) return;
  const filtered = customers.filter(c => !q || [c.name,c.phone,c.email].join(' ').toLowerCase().includes(q)).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if (!filtered.length) { list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No customers yet.</div>'; return; }
  list.innerHTML = filtered.map(c => `<div class="customer-card" data-id="${c.id}"><div><div class="customer-name">${escHtml(c.name||'—')}</div><div class="customer-meta">${[c.phone,c.email].filter(Boolean).map(escHtml).join(' · ')}</div>${c.birthday?`<div style="font-size:12px;color:var(--text3);margin-top:2px">🎂 ${escHtml(c.birthday)}</div>`:''}</div><div style="font-size:12px;color:var(--text3)">${c.followupDate?`📞 ${escHtml(c.followupDate)}`:''}</div></div>`).join('');
  list.querySelectorAll('.customer-card').forEach(card => card.addEventListener('click', () => { const c=customers.find(x=>x.id===card.dataset.id); if(c) openCustomerDetail(c); }));

  const searchEl = document.getElementById('cust-search');
  if (searchEl && !searchEl._wired) { searchEl._wired=true; searchEl.addEventListener('input', renderCustomers); }
  const addBtn = document.getElementById('btn-add-customer');
  if (addBtn && !addBtn._wired) { addBtn._wired=true; addBtn.addEventListener('click', () => openCustomerForm()); }
}

function openCustomerDetail(c) {
  showModal(c.name, `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${c.phone?`<div><div style="font-size:11px;color:var(--text3)">Phone</div><div>${escHtml(c.phone)}</div></div>`:''}
      ${c.email?`<div><div style="font-size:11px;color:var(--text3)">Email</div><div>${escHtml(c.email)}</div></div>`:''}
      ${c.address?`<div><div style="font-size:11px;color:var(--text3)">Address</div><div>${escHtml(c.address)}</div></div>`:''}
      ${c.birthday?`<div><div style="font-size:11px;color:var(--text3)">Birthday</div><div>${escHtml(c.birthday)}</div></div>`:''}
      ${c.notes?`<div><div style="font-size:11px;color:var(--text3)">Notes</div><div style="font-size:13px;color:var(--text2)">${escHtml(c.notes)}</div></div>`:''}
      ${c.followupDate?`<div><div style="font-size:11px;color:var(--text3)">Follow-up</div><div>${escHtml(c.followupDate)} ${c.followupNote?'· '+escHtml(c.followupNote):''}</div></div>`:''}
    </div>
  `, [
    { label:'Edit', action:() => { openCustomerForm(c); closeModal(); } },
    { label:'Delete', danger:true, action:async()=>{ if(confirm('Delete?')){ await DEL('/customers/'+c.id); customers=await GET('/customers'); renderCustomers(); closeModal(); showToast('Deleted.'); } } }
  ]);
}

function openCustomerForm(c=null) {
  showModal(c?'Edit Customer':'Add Customer', `
    <div class="field-group"><label class="field-label">Name</label><input class="field" id="cm-name" type="text" value="${escHtml(c?.name||'')}"/></div>
    <div class="field-group"><label class="field-label">Phone</label><input class="field" id="cm-phone" type="text" value="${escHtml(c?.phone||'')}"/></div>
    <div class="field-group"><label class="field-label">Email</label><input class="field" id="cm-email" type="email" value="${escHtml(c?.email||'')}"/></div>
    <div class="field-group"><label class="field-label">Address</label><input class="field" id="cm-address" type="text" value="${escHtml(c?.address||'')}"/></div>
    <div class="field-group"><label class="field-label">Birthday</label><input class="field" id="cm-birthday" type="text" placeholder="e.g. June 15" value="${escHtml(c?.birthday||'')}"/></div>
    <div class="field-group"><label class="field-label">Notes</label><textarea class="field" id="cm-notes" rows="3">${escHtml(c?.notes||'')}</textarea></div>
    <div class="field-group"><label class="field-label">Follow-up Date</label><input class="field" id="cm-followup" type="text" value="${escHtml(c?.followupDate||'')}"/></div>
    <div class="field-group"><label class="field-label">Follow-up Note</label><input class="field" id="cm-followup-note" type="text" value="${escHtml(c?.followupNote||'')}"/></div>
  `, [{ label:'Save Customer', action: async()=>{
    const g = id => document.getElementById(id)?.value.trim()||'';
    const data = { id:c?.id||genId(), name:g('cm-name'), phone:g('cm-phone'), email:g('cm-email'), address:g('cm-address'), birthday:g('cm-birthday'), notes:g('cm-notes'), followupDate:g('cm-followup'), followupNote:g('cm-followup-note'), addedAt:c?.addedAt||new Date().toISOString() };
    await POST('/customers', data);
    customers = await GET('/customers');
    renderCustomers();
    closeModal();
    showToast('Customer saved ✓');
  }}]);
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE LOG
// ═══════════════════════════════════════════════════════════════════════════
function renderPurchaseLog() {
  const q = (document.getElementById('pl-search')?.value||'').toLowerCase();
  const list = document.getElementById('purchase-list');
  if (!list) return;
  const filtered = purchases.filter(p => !q || [p.watchDesc,p.dealerName,p.notes].join(' ').toLowerCase().includes(q)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if (!filtered.length) { list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">No purchases yet.</div>'; return; }
  list.innerHTML = filtered.map(p=>`<div class="purchase-item"><div><div class="purchase-item-title">${escHtml(p.watchDesc||'Purchase')} <span class="pl-status-tag ${p.status||'complete'}">${p.status||'complete'}</span>${p.autoCreated?'<span style="font-size:10px;background:var(--blue-dim);color:var(--blue);padding:1px 7px;border-radius:10px;margin-left:6px">Auto</span>':''}</div><div class="purchase-item-sub">${escHtml(p.dealerName||'Unknown supplier')} · ${escHtml(p.type||'')} · ${escHtml(p.paymentMethod||'')}</div></div><div><div class="purchase-item-amount">${p.amount?fmt(p.amount):'—'}</div><div class="purchase-item-date">${escHtml(p.date||'')}</div></div></div>`).join('');

  const searchEl = document.getElementById('pl-search');
  if (searchEl && !searchEl._wired) { searchEl._wired=true; searchEl.addEventListener('input', renderPurchaseLog); }
  const addBtn = document.getElementById('btn-add-purchase');
  if (addBtn && !addBtn._wired) { addBtn._wired=true; addBtn.addEventListener('click', ()=>openPurchaseForm()); }
}

function openPurchaseForm(p=null) {
  showModal(p?'Edit Purchase':'New Purchase', `
    <div class="field-group"><label class="field-label">Watch / Item</label><input class="field" id="pm-watch" type="text" value="${escHtml(p?.watchDesc||'')}"/></div>
    <div class="field-group"><label class="field-label">Dealer / Supplier</label><input class="field" id="pm-dealer" type="text" value="${escHtml(p?.dealerName||'')}"/></div>
    <div class="field-group"><label class="field-label">Date</label><input class="field" id="pm-date" type="text" value="${escHtml(p?.date||new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))}"/></div>
    <div class="field-group"><label class="field-label">Amount</label><input class="field" id="pm-amount" type="number" step="0.01" value="${p?.amount||''}"/></div>
    <div class="field-group"><label class="field-label">Type</label><select class="field" id="pm-type"><option value="dealer">Dealer</option><option value="private">Private Seller</option><option value="auction">Auction</option><option value="trade">Trade-In</option><option value="other">Other</option></select></div>
    <div class="field-group"><label class="field-label">Payment</label><select class="field" id="pm-payment"><option value="cash">Cash</option><option value="check">Check</option><option value="wire">Wire Transfer</option><option value="card">Card</option><option value="other">Other</option></select></div>
    <div class="field-group"><label class="field-label">Notes</label><textarea class="field" id="pm-notes" rows="2">${escHtml(p?.notes||'')}</textarea></div>
  `, [{ label:'Save Purchase', action:async()=>{
    const g=id=>document.getElementById(id)?.value.trim()||'';
    const data={id:p?.id||genId(),watchDesc:g('pm-watch'),dealerName:g('pm-dealer'),date:g('pm-date'),amount:parseFloat(g('pm-amount'))||null,type:document.getElementById('pm-type').value,paymentMethod:document.getElementById('pm-payment').value,notes:g('pm-notes'),status:'complete',createdAt:p?.createdAt||new Date().toISOString()};
    await POST('/invoices/purchases',data);
    purchases=await GET('/invoices/purchases');
    renderPurchaseLog();
    closeModal();
    showToast('Purchase saved ✓');
  }}]);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPAIR JOBS
// ═══════════════════════════════════════════════════════════════════════════
function renderJobs() {
  const list = document.getElementById('jobs-list');
  if (!list) return;
  if (!jobs.length) { list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">No repair jobs yet.</div>'; return; }
  list.innerHTML = jobs.map(j=>`<div class="hist-card"><div class="hist-card-top"><div><div class="hist-card-name">${escHtml(j.customer||'—')}</div><div class="hist-card-watch">${escHtml(j.brand)} ${escHtml(j.model)} · ${escHtml(j.description||'')}</div></div><div><div class="hist-card-date">${escHtml(j.jobStatus||'')}</div></div></div></div>`).join('');
  const addBtn=document.getElementById('btn-add-job');
  if(addBtn&&!addBtn._wired){addBtn._wired=true;addBtn.addEventListener('click',()=>openJobForm());}
}

function openJobForm(j=null){
  showModal('New Repair Job',`
    <div class="field-group"><label class="field-label">Customer</label><input class="field" id="jm-customer" type="text" value="${escHtml(j?.customer||'')}"/></div>
    <div class="field-group"><label class="field-label">Phone</label><input class="field" id="jm-phone" type="text" value="${escHtml(j?.phone||'')}"/></div>
    <div class="field-group"><label class="field-label">Brand</label><input class="field" id="jm-brand" type="text" value="${escHtml(j?.brand||'')}"/></div>
    <div class="field-group"><label class="field-label">Model</label><input class="field" id="jm-model" type="text" value="${escHtml(j?.model||'')}"/></div>
    <div class="field-group"><label class="field-label">Description</label><textarea class="field" id="jm-desc" rows="3">${escHtml(j?.description||'')}</textarea></div>
  `,[{label:'Save Job',action:async()=>{
    const g=id=>document.getElementById(id)?.value.trim()||'';
    const data={id:j?.id||genId(),date:new Date().toISOString(),customer:g('jm-customer'),phone:g('jm-phone'),brand:g('jm-brand'),model:g('jm-model'),description:g('jm-desc'),jobStatus:'Pending Approval'};
    await POST('/jobs',data);jobs=await GET('/jobs');renderJobs();closeModal();showToast('Job saved ✓');
  }}]);
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTEBOOK
// ═══════════════════════════════════════════════════════════════════════════
function renderNotebook() {
  document.querySelectorAll('.nb-tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.nb-tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('.nb-pane').forEach(p=>p.classList.toggle('hidden',!p.id.includes(t.dataset.tab)));
  }));
  renderNotes(); renderLeads(); renderTasks();
}

function renderNotes(){const el=document.getElementById('nb-notes');if(!el)return;el.innerHTML=(notebook.notes||[]).map(n=>`<div class="nb-item"><div class="nb-item-title">${escHtml(n.title||'Untitled')}</div><div class="nb-item-content">${escHtml(n.content||'').slice(0,200)}</div></div>`).join('')||'<div class="dash-empty">No notes yet.</div>';}
function renderLeads(){const el=document.getElementById('nb-leads');if(!el)return;el.innerHTML=(notebook.leads||[]).map(l=>`<div class="nb-item"><div class="nb-item-title">${escHtml(l.name||'—')}</div><div class="nb-item-content">${escHtml(l.looking||'')}${l.phone?' · '+escHtml(l.phone):''}</div></div>`).join('')||'<div class="dash-empty">No leads yet.</div>';}
function renderTasks(){const el=document.getElementById('nb-tasks');if(!el)return;el.innerHTML=(notebook.tasks||[]).map(t=>`<div class="nb-item" style="display:flex;align-items:center;gap:12px"><span style="font-size:18px">${t.done?'✓':'○'}</span><div class="${t.done?'text-decoration:line-through':''}">${escHtml(t.title||'')}</div></div>`).join('')||'<div class="dash-empty">No tasks yet.</div>';}

// ═══════════════════════════════════════════════════════════════════════════
// OUTGOING INVOICES
// ═══════════════════════════════════════════════════════════════════════════
function renderOutgoingInvoices(){
  const list=document.getElementById('invoices-list');if(!list)return;
  if(!outgoingInvoices.length){list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">No invoices yet.</div>';return;}
  list.innerHTML=outgoingInvoices.map(inv=>`<div class="hist-card"><div class="hist-card-top"><div><div class="hist-card-name">Invoice #${inv.number} — ${escHtml(inv.toName||'—')}</div><div class="hist-card-watch">${escHtml(inv.date||'')}</div></div><div><div class="hist-card-total">${fmt(inv.total)}</div></div></div></div>`).join('');
  const addBtn=document.getElementById('btn-add-invoice');if(addBtn&&!addBtn._wired){addBtn._wired=true;addBtn.addEventListener('click',()=>openInvoiceForm());}
}

function openInvoiceForm(){
  showModal('New Invoice',`
    <div class="field-group"><label class="field-label">Invoice #</label><input class="field" id="im-number" type="text" value="${invoiceNextNumber}"/></div>
    <div class="field-group"><label class="field-label">Date</label><input class="field" id="im-date" type="text" value="${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}"/></div>
    <div class="field-group"><label class="field-label">Bill To — Name</label><input class="field" id="im-to-name" type="text" placeholder="Customer name"/></div>
    <div class="field-group"><label class="field-label">Bill To — Email</label><input class="field" id="im-to-email" type="email"/></div>
    <div class="field-group"><label class="field-label">Notes</label><textarea class="field" id="im-notes" rows="2">Payment due upon receipt. Thank you for your business.</textarea></div>
  `,[{label:'Save Invoice',action:async()=>{
    const g=id=>document.getElementById(id)?.value.trim()||'';
    const data={id:genId(),number:parseInt(g('im-number'))||invoiceNextNumber,date:g('im-date'),toName:g('im-to-name'),toEmail:g('im-to-email'),lines:[],subtotal:0,taxRate:0,taxAmt:0,total:0,notes:g('im-notes'),status:'sent',createdAt:new Date().toISOString(),nextNumber:invoiceNextNumber+1};
    await POST('/invoices/outgoing',data);
    const inv=await GET('/invoices/outgoing');outgoingInvoices=inv.items||[];invoiceNextNumber=inv.nextNumber||invoiceNextNumber+1;
    renderOutgoingInvoices();closeModal();showToast('Invoice saved ✓');
  }}]);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEALERS
// ═══════════════════════════════════════════════════════════════════════════
function renderDealers(){
  const q=(document.getElementById('dealer-search')?.value||'').toLowerCase();
  const list=document.getElementById('dealers-list');if(!list)return;
  const filtered=dealers.filter(d=>!q||[d.name,d.company,d.phone,d.email].join(' ').toLowerCase().includes(q));
  list.innerHTML=filtered.length?filtered.map(d=>`<div class="customer-card" data-id="${d.id}"><div><div class="customer-name">${escHtml(d.name||'—')}</div><div class="customer-meta">${escHtml(d.company||'')}${d.phone?' · '+escHtml(d.phone):''}</div></div></div>`).join(''):'<div style="text-align:center;padding:40px;color:var(--text3)">No contacts yet.</div>';
  const searchEl=document.getElementById('dealer-search');if(searchEl&&!searchEl._wired){searchEl._wired=true;searchEl.addEventListener('input',renderDealers);}
  const addBtn=document.getElementById('btn-add-dealer');if(addBtn&&!addBtn._wired){addBtn._wired=true;addBtn.addEventListener('click',()=>openDealerForm());}
}

function openDealerForm(d=null){
  showModal(d?'Edit Contact':'Add Contact',`
    <div class="field-group"><label class="field-label">Name</label><input class="field" id="dm-name" type="text" value="${escHtml(d?.name||'')}"/></div>
    <div class="field-group"><label class="field-label">Company</label><input class="field" id="dm-company" type="text" value="${escHtml(d?.company||'')}"/></div>
    <div class="field-group"><label class="field-label">Phone</label><input class="field" id="dm-phone" type="text" value="${escHtml(d?.phone||'')}"/></div>
    <div class="field-group"><label class="field-label">Email</label><input class="field" id="dm-email" type="email" value="${escHtml(d?.email||'')}"/></div>
    <div class="field-group"><label class="field-label">Notes</label><textarea class="field" id="dm-notes" rows="2">${escHtml(d?.notes||'')}</textarea></div>
  `,[{label:'Save Contact',action:async()=>{
    const g=id=>document.getElementById(id)?.value.trim()||'';
    const data={id:d?.id||genId(),name:g('dm-name'),company:g('dm-company'),phone:g('dm-phone'),email:g('dm-email'),notes:g('dm-notes'),createdAt:d?.createdAt||new Date().toISOString()};
    await POST('/invoices/dealers',data);dealers=await GET('/invoices/dealers');renderDealers();closeModal();showToast('Contact saved ✓');
  }}]);
}

// ═══════════════════════════════════════════════════════════════════════════
// APPRAISALS
// ═══════════════════════════════════════════════════════════════════════════
function renderAppraisals(){
  const list=document.getElementById('appraisals-list');if(!list)return;
  list.innerHTML=appraisals.length?appraisals.map(a=>`<div class="hist-card"><div class="hist-card-top"><div><div class="hist-card-name">${escHtml(a.ownerName||'—')}</div><div class="hist-card-watch">${escHtml(a.brand||'')} ${escHtml(a.model||'')} · ${escHtml(a.purpose||'')}</div></div><div><div class="hist-card-total">${a.value?fmt(a.value):'—'}</div><div class="hist-card-date">${escHtml(a.date||'')}</div></div></div></div>`).join(''):'<div style="text-align:center;padding:40px;color:var(--text3)">No appraisals yet.</div>';
  const addBtn=document.getElementById('btn-add-appraisal');if(addBtn&&!addBtn._wired){addBtn._wired=true;addBtn.addEventListener('click',()=>openAppraisalForm());}
}

function openAppraisalForm(a=null){
  showModal('New Appraisal',`
    <div class="field-group"><label class="field-label">Date</label><input class="field" id="am-date" type="text" value="${a?.date||new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}"/></div>
    <div class="field-group"><label class="field-label">Owner Name</label><input class="field" id="am-owner" type="text" value="${escHtml(a?.ownerName||'')}"/></div>
    <div class="field-group"><label class="field-label">Purpose</label><select class="field" id="am-purpose"><option value="insurance">Insurance</option><option value="estate">Estate</option><option value="resale">Resale</option><option value="other">Other</option></select></div>
    <div class="field-group"><label class="field-label">Brand</label><input class="field" id="am-brand" type="text" value="${escHtml(a?.brand||'')}"/></div>
    <div class="field-group"><label class="field-label">Model</label><input class="field" id="am-model" type="text" value="${escHtml(a?.model||'')}"/></div>
    <div class="field-group"><label class="field-label">Appraised Value</label><input class="field" id="am-value" type="number" step="0.01" value="${a?.value||''}"/></div>
  `,[{label:'Save Appraisal',action:async()=>{
    const g=id=>document.getElementById(id)?.value.trim()||'';
    const data={id:a?.id||genId(),date:g('am-date'),ownerName:g('am-owner'),purpose:document.getElementById('am-purpose').value,brand:g('am-brand'),model:g('am-model'),value:parseFloat(g('am-value'))||null,createdAt:a?.createdAt||new Date().toISOString()};
    await POST('/invoices/appraisals',data);appraisals=await GET('/invoices/appraisals');renderAppraisals();closeModal();showToast('Appraisal saved ✓');
  }}]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCESSORIES
// ═══════════════════════════════════════════════════════════════════════════
function renderAccessories(){
  const grid=document.getElementById('acc-grid');if(!grid)return;
  grid.innerHTML=accessories.length?accessories.map(a=>`<div class="acc-card" data-id="${a.id}"><div class="acc-card-img">${a.photo?`<img src="${a.photo}" style="width:100%;height:100%;object-fit:cover"/>`:''}</div><div class="acc-card-body"><div class="acc-card-type">${escHtml(a.type||'Accessory')}</div><div class="acc-card-name">${escHtml(a.name||'—')}</div><div style="font-size:12px;color:var(--text3);margin-top:4px">${fmt(a.price)}</div></div></div>`).join(''):'<div style="text-align:center;padding:40px;color:var(--text3)">No accessories yet.</div>';
  grid.querySelectorAll('.acc-card').forEach(c=>c.addEventListener('click',()=>{const a=accessories.find(x=>x.id===c.dataset.id);if(a)openAccForm(a);}));
  const addBtn=document.getElementById('btn-add-acc');if(addBtn&&!addBtn._wired){addBtn._wired=true;addBtn.addEventListener('click',()=>openAccForm());}
}

function openAccForm(a=null){
  showModal(a?'Edit Accessory':'Add Accessory',`
    <div class="field-group"><label class="field-label">Name</label><input class="field" id="af-name" type="text" value="${escHtml(a?.name||'')}"/></div>
    <div class="field-group"><label class="field-label">Type</label><input class="field" id="af-type" type="text" value="${escHtml(a?.type||'')}"/></div>
    <div class="field-group"><label class="field-label">Brand</label><input class="field" id="af-brand" type="text" value="${escHtml(a?.brand||'')}"/></div>
    <div class="field-group"><label class="field-label">Condition</label><input class="field" id="af-condition" type="text" value="${escHtml(a?.condition||'')}"/></div>
    <div class="field-group"><label class="field-label">Cost</label><input class="field" id="af-cost" type="number" step="0.01" value="${a?.cost||''}"/></div>
    <div class="field-group"><label class="field-label">Price</label><input class="field" id="af-price" type="number" step="0.01" value="${a?.price||''}"/></div>
    <div class="field-group"><label class="field-label">Notes</label><textarea class="field" id="af-notes" rows="2">${escHtml(a?.notes||'')}</textarea></div>
  `,[
    {label:'Save',action:async()=>{
      const g=id=>document.getElementById(id)?.value.trim()||'';
      const data={id:a?.id||genId(),name:g('af-name'),type:g('af-type'),brand:g('af-brand'),condition:g('af-condition'),cost:parseFloat(g('af-cost'))||null,price:parseFloat(g('af-price'))||null,notes:g('af-notes'),status:a?.status||'available',dateAdded:a?.dateAdded||new Date().toISOString()};
      await POST('/accessories',data);accessories=await GET('/accessories');renderAccessories();closeModal();showToast('Saved ✓');
    }},
    ...(a?[{label:'Delete',danger:true,action:async()=>{if(confirm('Delete?')){await DEL('/accessories/'+a.id);accessories=await GET('/accessories');renderAccessories();closeModal();showToast('Deleted.');}}}]:[])
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════
function renderReports(){
  const el=document.getElementById('reports-content');if(!el)return;
  const soldWatches=watches.filter(w=>w.soldPrice&&w.cost);
  const totalRevenue=soldWatches.reduce((a,w)=>a+parseFloat(w.soldPrice),0);
  const totalCost=soldWatches.reduce((a,w)=>a+parseFloat(w.cost),0);
  const profit=totalRevenue-totalCost;
  const totalExpenses=expenses.reduce((a,e)=>a+(parseFloat(e.amount)||0),0);
  const netProfit=profit-totalExpenses;
  el.innerHTML=`
    <div class="dash-stats">
      <div class="dash-stat"><div class="dash-stat-label">Total Revenue</div><div class="dash-stat-val">${fmt(totalRevenue)}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Total Cost of Goods</div><div class="dash-stat-val">${fmt(totalCost)}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Gross Profit</div><div class="dash-stat-val" style="color:var(--green)">${fmt(profit)}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Total Expenses</div><div class="dash-stat-val" style="color:var(--red)">${fmt(totalExpenses)}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Net Profit</div><div class="dash-stat-val" style="color:${netProfit>=0?'var(--green)':'var(--red)'}">${fmt(netProfit)}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Watches Sold</div><div class="dash-stat-val">${soldWatches.length}</div></div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function loadSettingsForm(){
  ['s-name','s-email','s-phone','s-address'].forEach(id=>{const el=document.getElementById(id);if(el){const key=id.replace('s-','store').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());el.value=settings[key]||'';}});
  const taxEl=document.getElementById('s-tax-rate');if(taxEl)taxEl.value=settings.taxRate||9;
  document.getElementById('btn-save-settings')?.addEventListener('click',saveSettings);
  const cpBtn=document.getElementById('btn-change-password');
  if(cpBtn&&!cpBtn._wired){cpBtn._wired=true;cpBtn.addEventListener('click',async()=>{
    const pw=document.getElementById('s-new-password')?.value;
    if(!pw){showToast('Enter a new password');return;}
    const res=await fetch('/api/settings/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    const d=await res.json();
    if(d.success){document.getElementById('s-new-password').value='';showToast('Password updated ✓');}
    else showToast('Error: '+d.error);
  });}
}

async function saveSettings(){
  settings.storeName=document.getElementById('s-name')?.value.trim()||settings.storeName;
  settings.storeEmail=document.getElementById('s-email')?.value.trim()||settings.storeEmail;
  settings.storePhone=document.getElementById('s-phone')?.value.trim()||settings.storePhone;
  settings.storeAddress=document.getElementById('s-address')?.value.trim()||settings.storeAddress;
  settings.taxRate=parseFloat(document.getElementById('s-tax-rate')?.value)||9;
  await POST('/settings',settings);
  showToast('Settings saved ✓');
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
let _modalEl = null;
function showModal(title, bodyHtml, actions=[]) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">${escHtml(title)}</span>
        <button class="btn-ghost" id="modal-close-btn" style="padding:4px 10px;font-size:18px">×</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-actions" id="modal-actions-row"></div>
    </div>`;
  document.body.appendChild(overlay);
  _modalEl = overlay;
  overlay.addEventListener('click', e => { if(e.target===overlay) closeModal(); });
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  const actRow = document.getElementById('modal-actions-row');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = a.danger ? 'btn-ghost danger' : (a.label === actions[0].label ? 'btn-action save' : 'btn-ghost');
    btn.textContent = a.label;
    btn.addEventListener('click', a.action);
    actRow.appendChild(btn);
  });
  // Cancel button
  const cancel = document.createElement('button');
  cancel.className = 'btn-ghost';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', closeModal);
  actRow.appendChild(cancel);
}

function closeModal() {
  if (_modalEl) { _modalEl.remove(); _modalEl = null; }
}

// ── Start ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
