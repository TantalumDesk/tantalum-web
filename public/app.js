// ── State ─────────────────────────────────────────────────────────────────
let watches = [], estimates = [], customers = [], settings = {};
let notebook = { notes:[], leads:[], tasks:[], wantList:[] };
let purchases = [], outgoingInvoices = [], expenses = [];
let currentView = 'dashboard';
let editingWatchId = null, editingEstId = null, editingCustId = null;
let notebookTab = 'notes';
let estLines = [];

// ── API ───────────────────────────────────────────────────────────────────
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

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  const me = await GET('/me');
  if (!me) return;
  document.getElementById('sidebar-user').textContent = me.username;

  await Promise.all([
    loadSettings(), loadWatches(), loadEstimates(),
    loadCustomers(), loadNotebook(), loadInvoiceData()
  ]);

  renderDashboard();
  setupNavigation();
  setupSearch();
}

async function loadSettings() {
  settings = await GET('/settings') || {};
  populateSettingsForm();
  populateDataLists();
}
async function loadWatches()   { watches   = await GET('/watches')  || []; }
async function loadEstimates() { estimates = await GET('/estimates') || []; }
async function loadCustomers() { customers = await GET('/customers') || []; }
async function loadNotebook()  { notebook  = await GET('/notebook')  || { notes:[], leads:[], tasks:[], wantList:[] }; }
async function loadInvoiceData() {
  const [p, o, e] = await Promise.all([
    GET('/invoices/purchases'),
    GET('/invoices/outgoing'),
    GET('/invoices/expenses'),
  ]);
  purchases = p || [];
  const od = o || {};
  outgoingInvoices = od.items || [];
  expenses = e || [];
}

// ── Navigation ────────────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');

  const titles = { dashboard:'Dashboard', inventory:'Inventory', estimates:'Estimates & Jobs', customers:'Customers', notebook:'Notebook', purchases:'Purchase Log', invoices:'Invoices', expenses:'Expenses', accessories:'Accessories', settings:'Settings' };
  document.getElementById('header-title').textContent = titles[view] || view;

  // Render the view
  if (view === 'dashboard')   renderDashboard();
  if (view === 'inventory')   renderInventory();
  if (view === 'estimates')   renderEstimates();
  if (view === 'customers')   renderCustomers();
  if (view === 'notebook')    renderNotebook();
  if (view === 'purchases')   renderPurchases();
  if (view === 'invoices')    renderInvoiceList();
  if (view === 'expenses')    renderExpenses();
  if (view === 'accessories') renderAccessories();

  // Header actions
  updateHeaderActions(view);
}

function updateHeaderActions(view) {
  const acts = document.getElementById('header-actions');
  const mActs = document.getElementById('mobile-header-actions');
  let html = '';
  if (view === 'inventory') html = `<button class="btn btn-primary btn-sm" onclick="openAddWatch()">+ Add Watch</button>`;
  if (view === 'estimates') html = `<button class="btn btn-primary btn-sm" onclick="openAddEstimate()">+ New Estimate</button>`;
  if (view === 'customers') html = `<button class="btn btn-primary btn-sm" onclick="openAddCustomer()">+ Add Customer</button>`;
  acts.innerHTML = html;
  mActs.innerHTML = html;
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const inStock = watches.filter(w => w.status === 'In Stock' || !w.status);
  const stockVal = inStock.reduce((s, w) => s + (w.retailPrice || 0), 0);
  const pending = estimates.filter(e => e.jobStatus === 'Pending Approval');
  const active  = estimates.filter(e => ['Approved','In Progress'].includes(e.jobStatus));

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${inStock.length}</div><div class="stat-label">In Stock</div><div class="stat-sub">${fmt(stockVal)} retail</div></div>
    <div class="stat-card"><div class="stat-value">${pending.length}</div><div class="stat-label">Pending Approval</div></div>
    <div class="stat-card"><div class="stat-value">${active.length}</div><div class="stat-label">Active Jobs</div></div>
    <div class="stat-card"><div class="stat-value">${customers.length}</div><div class="stat-label">Customers</div></div>
  `;

  // Alerts
  const today = new Date();
  const alerts = [];
  const expiryDays = settings.estimateExpiryDays || 30;

  if (settings.expiryAlertsEnabled !== false) {
    estimates.filter(e => ['Pending Approval','Approved'].includes(e.jobStatus)).forEach(e => {
      const d = new Date(e.date);
      const expires = new Date(d.getTime() + expiryDays * 86400000);
      const daysLeft = Math.ceil((expires - today) / 86400000);
      if (daysLeft <= 5) alerts.push({ type:'expiry', color:'var(--gold)', title:`Estimate expiring${daysLeft<=0?' — EXPIRED':' in '+daysLeft+' day'+(daysLeft!==1?'s':'')}`, sub:`${e.customer?.name||'Unknown'} · ${e.watch?.brand||''} ${e.watch?.model||''}`.trim() });
    });
  }
  if (settings.followupRemindersEnabled !== false) {
    customers.forEach(c => {
      if (!c.followupDate) return;
      const days = Math.ceil((new Date(c.followupDate) - today) / 86400000);
      if (days >= -1 && days <= 14) alerts.push({ type:'followup', color:'var(--blue)', title:`Follow-up: ${c.name}`, sub:`${c.followupDate}${c.followupNote?' · '+c.followupNote:''}` });
    });
  }
  if (settings.birthdayRemindersEnabled !== false) {
    customers.forEach(c => {
      if (!c.birthday) return;
      try {
        const b = new Date(c.birthday.replace(/(\d+)\/(\d+)/, '$1/$2/'+today.getFullYear()));
        if (isNaN(b)) return;
        b.setFullYear(today.getFullYear());
        if (b < today) b.setFullYear(today.getFullYear()+1);
        const days = Math.ceil((b - today) / 86400000);
        if (days >= 0 && days <= 14) alerts.push({ type:'birthday', color:'var(--green)', title:`🎂 Birthday: ${c.name}`, sub:`${b.toLocaleDateString('en-US',{month:'long',day:'numeric'})}${days===0?' — Today!':' — in '+days+' day'+(days!==1?'s':'')}` });
      } catch(e) {}
    });
  }

  const alertEl = document.getElementById('dash-alerts');
  alertEl.innerHTML = alerts.length ? alerts.map(a => `
    <div class="alert-item">
      <div class="alert-dot" style="background:${a.color}"></div>
      <div class="alert-body"><div class="alert-title">${escHtml(a.title)}</div><div class="alert-sub">${escHtml(a.sub)}</div></div>
    </div>`).join('') : '<div class="empty-state" style="padding:20px"><div class="empty-state-text">No alerts</div></div>';

  // Pending estimates
  const estEl = document.getElementById('dash-estimates');
  estEl.innerHTML = pending.slice(0,5).map(e => `
    <div class="list-item" onclick="switchView('estimates')">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(e.customer?.name||'Unknown')}</div>
        <div class="list-item-sub">${escHtml(e.watch?.brand||'')} ${escHtml(e.watch?.model||'')} · ${escHtml(e.date||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(e.total)}</div>
        <div class="list-item-tag">Pending</div>
      </div>
    </div>`).join('') || '<div class="empty-state" style="padding:20px"><div class="empty-state-text">No pending estimates</div></div>';

  // Leads
  const leadsEl = document.getElementById('dash-leads');
  const leads = (notebook.leads||[]).slice(0,5);
  leadsEl.innerHTML = leads.map(l => `
    <div class="list-item" onclick="switchView('notebook')">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(l.name||'')}</div>
        <div class="list-item-sub">${escHtml(l.looking||'')}</div>
      </div>
    </div>`).join('') || '<div class="empty-state" style="padding:20px"><div class="empty-state-text">No open leads</div></div>';
}

// ── Inventory ─────────────────────────────────────────────────────────────
function renderInventory(filter) {
  const search = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const status = document.getElementById('inv-filter')?.value||'';
  let list = watches;
  if (search) list = list.filter(w => [w.brand,w.model,w.ref,w.serial,w.stockNum].join(' ').toLowerCase().includes(search));
  if (status) list = list.filter(w => w.status === status);

  const grid = document.getElementById('inv-grid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">⌚</div><div class="empty-state-text">No watches found</div><button class="btn btn-primary" onclick="openAddWatch()">+ Add Watch</button></div>`;
    return;
  }
  grid.innerHTML = list.map(w => `
    <div class="watch-card" onclick="openWatchDetail('${w.id}')">
      <div class="watch-card-img">⌚</div>
      <div class="watch-card-body">
        <div class="watch-card-brand">${escHtml(w.brand||'—')}</div>
        <div class="watch-card-model">${escHtml(w.model||'—')}</div>
        <div style="margin-bottom:8px">${statusBadge(w.status)}</div>
        <div class="watch-card-footer">
          <div class="watch-card-price">${fmt(w.retailPrice||w.cost)}</div>
          <div class="watch-card-stock">${escHtml(w.stockNum||'')}</div>
        </div>
      </div>
    </div>`).join('');
}

function openWatchDetail(id) {
  const w = watches.find(x => x.id === id);
  if (!w) return;
  document.getElementById('watch-modal-title').textContent = `${w.brand||''} ${w.model||''}`.trim();
  document.getElementById('watch-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      ${detailRow('Brand', w.brand)} ${detailRow('Model', w.model)}
      ${detailRow('Ref #', w.ref)} ${detailRow('Serial', w.serial)}
      ${detailRow('Condition', w.condition)} ${detailRow('Status', w.status)}
      ${detailRow('Dial Color', w.dialColor)} ${detailRow('Bracelet', w.bracelet)}
      ${detailRow('Cost', fmt(w.cost))} ${detailRow('Retail', fmt(w.retailPrice))}
      ${detailRow('Stock #', w.stockNum)} ${detailRow('Source', w.sourceName)}
    </div>
    ${w.notes ? `<div class="card-label">Notes</div><p style="font-size:13.5px;color:var(--text2);margin-bottom:16px">${escHtml(w.notes)}</p>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="openEditWatch('${w.id}')">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteWatch('${w.id}')">🗑 Delete</button>
    </div>`;
  openModal('watch-modal-overlay');
}

function openAddWatch()     { editingWatchId = null; clearWatchForm(); document.getElementById('edit-watch-title').textContent = 'Add Watch'; openModal('edit-watch-overlay'); }
function openEditWatch(id)  {
  editingWatchId = id;
  const w = watches.find(x => x.id === id);
  if (!w) return;
  closeModal('watch-modal-overlay');
  document.getElementById('edit-watch-title').textContent = 'Edit Watch';
  const f = n => document.getElementById(n);
  f('ew-brand').value   = w.brand||'';
  f('ew-model').value   = w.model||'';
  f('ew-ref').value     = w.ref||'';
  f('ew-serial').value  = w.serial||'';
  f('ew-condition').value = w.condition||'Excellent';
  f('ew-status').value  = w.status||'In Stock';
  f('ew-dial').value    = w.dialColor||'';
  f('ew-bracelet').value= w.bracelet||'';
  f('ew-cost').value    = w.cost||'';
  f('ew-price').value   = w.retailPrice||'';
  f('ew-notes').value   = w.notes||'';
  f('ew-source').value  = w.sourceName||'';
  f('ew-date').value    = w.purchaseDate||'';
  openModal('edit-watch-overlay');
}
function clearWatchForm() {
  ['ew-brand','ew-model','ew-ref','ew-serial','ew-dial','ew-bracelet','ew-cost','ew-price','ew-notes','ew-source','ew-date'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const c = document.getElementById('ew-condition'); if(c) c.value='Excellent';
  const s = document.getElementById('ew-status'); if(s) s.value='In Stock';
}

async function saveWatch() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const watch = {
    id: editingWatchId || genId(),
    brand: g('ew-brand'), model: g('ew-model'), ref: g('ew-ref'), serial: g('ew-serial'),
    condition: g('ew-condition'), status: g('ew-status'),
    dialColor: g('ew-dial'), bracelet: g('ew-bracelet'),
    cost: parseFloat(g('ew-cost'))||0, retailPrice: parseFloat(g('ew-price'))||0,
    notes: g('ew-notes'), sourceName: g('ew-source'), purchaseDate: g('ew-date'),
    stockNum: editingWatchId ? watches.find(w=>w.id===editingWatchId)?.stockNum : nextStockNum(),
    dateAdded: editingWatchId ? watches.find(w=>w.id===editingWatchId)?.dateAdded : new Date().toISOString(),
  };
  await POST('/watches', watch);
  await loadWatches();
  closeModal('edit-watch-overlay');
  renderInventory();
  showToast(editingWatchId ? 'Watch updated' : 'Watch added');
}

async function deleteWatch(id) {
  if (!confirm('Delete this watch?')) return;
  await DEL('/watches/' + id);
  await loadWatches();
  closeModal('watch-modal-overlay');
  renderInventory();
  showToast('Watch deleted');
}

// ── Estimates ─────────────────────────────────────────────────────────────
function renderEstimates() {
  const search = (document.getElementById('est-search')?.value||'').toLowerCase();
  const status = document.getElementById('est-filter')?.value||'';
  let list = [...estimates];
  if (search) list = list.filter(e => [e.customer?.name, e.watch?.brand, e.watch?.model].join(' ').toLowerCase().includes(search));
  if (status) list = list.filter(e => e.jobStatus === status);

  const el = document.getElementById('est-list');
  el.innerHTML = list.map(e => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(e.customer?.name||'Unknown')}</div>
        <div class="list-item-sub">${escHtml(e.watch?.brand||'')} ${escHtml(e.watch?.model||'')} · ${escHtml(e.date||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(e.total)}</div>
        <div>${statusBadgeEst(e.jobStatus)}</div>
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No estimates yet</div><button class="btn btn-primary" onclick="openAddEstimate()">+ New Estimate</button></div>';
}

function openAddEstimate() {
  editingEstId = null; estLines = [];
  ['em-cust-name','em-cust-phone','em-cust-email','em-brand','em-model','em-serial','em-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  renderEstLines();
  openModal('est-modal-overlay');
}

function addEstimateLine() {
  estLines.push({ name:'', price:0 });
  renderEstLines();
}

function renderEstLines() {
  const el = document.getElementById('em-lines');
  if (!estLines.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">No services added yet</div>';
    updateEstTotal();
    return;
  }
  el.innerHTML = estLines.map((l, i) => `
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <input class="field" style="flex:1" placeholder="Service description" value="${escHtml(l.name)}" oninput="estLines[${i}].name=this.value"/>
      <input class="field" style="width:90px" type="number" placeholder="Price" value="${l.price||''}" oninput="estLines[${i}].price=parseFloat(this.value)||0;updateEstTotal()"/>
      <button class="btn-icon" onclick="estLines.splice(${i},1);renderEstLines()">×</button>
    </div>`).join('');
  updateEstTotal();
}

function updateEstTotal() {
  const total = estLines.reduce((s, l) => s + (l.price||0), 0);
  const el = document.getElementById('em-total-display');
  if (el) el.textContent = 'Total: ' + fmt(total);
}

async function saveEstimate() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const total = estLines.reduce((s, l) => s + (l.price||0), 0);
  const est = {
    id: editingEstId || genId(),
    date: new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),
    customer: { name: g('em-cust-name'), phone: g('em-cust-phone'), email: g('em-cust-email') },
    watch: { brand: g('em-brand'), model: g('em-model'), serial: g('em-serial') },
    lineItems: estLines,
    subtotal: total, taxRate: settings.taxRate||0, taxAmt: 0, total,
    notes: g('em-notes'),
    jobStatus: 'Pending Approval',
  };
  await POST('/estimates', est);
  await loadEstimates();
  closeModal('est-modal-overlay');
  renderEstimates();
  renderDashboard();
  showToast('Estimate saved');
}

// ── Customers ─────────────────────────────────────────────────────────────
function renderCustomers() {
  const search = (document.getElementById('cust-search')?.value||'').toLowerCase();
  let list = [...customers];
  if (search) list = list.filter(c => [c.name,c.phone,c.email].join(' ').toLowerCase().includes(search));

  const el = document.getElementById('cust-list');
  el.innerHTML = list.map(c => `
    <div class="list-item">
      <div class="list-item-icon">👤</div>
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(c.name||'')}</div>
        <div class="list-item-sub">${escHtml(c.phone||'')}${c.email?' · '+escHtml(c.email):''}</div>
      </div>
      ${c.birthday ? `<div class="list-item-right"><div class="list-item-tag">🎂 ${escHtml(c.birthday)}</div></div>` : ''}
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">No customers yet</div><button class="btn btn-primary" onclick="openAddCustomer()">+ Add Customer</button></div>';
}

function openAddCustomer() {
  editingCustId = null;
  ['cm-name','cm-phone','cm-email','cm-address','cm-birthday','cm-followup','cm-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  openModal('cust-modal-overlay');
}

async function saveCustomer() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const cust = {
    id: editingCustId || genId(),
    name: g('cm-name'), phone: g('cm-phone'), email: g('cm-email'),
    address: g('cm-address'), birthday: g('cm-birthday'),
    followupDate: g('cm-followup'), notes: g('cm-notes'),
    addedAt: new Date().toISOString(),
  };
  await POST('/customers', cust);
  await loadCustomers();
  closeModal('cust-modal-overlay');
  renderCustomers();
  showToast('Customer saved');
}

// ── Notebook ──────────────────────────────────────────────────────────────
function switchNotebookTab(tab) {
  notebookTab = tab;
  ['notes','leads','tasks','wantList'].forEach(t => {
    const el = document.getElementById('nb-tab-'+t);
    if (el) { el.className = t === tab ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'; }
  });
  renderNotebook();
}

function renderNotebook() {
  const el = document.getElementById('nb-content');
  const items = notebook[notebookTab] || [];
  if (notebookTab === 'notes') {
    el.innerHTML = `<button class="btn btn-primary btn-sm" style="margin-bottom:12px" onclick="addNote()">+ New Note</button>` +
      (items.length ? items.map(n => `<div class="card" style="margin-bottom:10px"><div style="font-weight:600;margin-bottom:6px">${escHtml(n.title||'Untitled')}</div><div style="font-size:13.5px;color:var(--text2)">${escHtml(n.content||'')}</div></div>`).join('') : '<div class="empty-state"><div class="empty-state-text">No notes yet</div></div>');
  } else if (notebookTab === 'leads') {
    el.innerHTML = items.map(l => `
      <div class="list-item card" style="padding:12px;margin-bottom:8px;border-radius:var(--radius)">
        <div class="list-item-body">
          <div class="list-item-title">${escHtml(l.name||'')}</div>
          <div class="list-item-sub">${escHtml(l.looking||'')}</div>
          ${l.phone ? `<div style="font-size:12px;color:var(--text3);margin-top:3px">${escHtml(l.phone)}</div>` : ''}
        </div>
      </div>`).join('') || '<div class="empty-state"><div class="empty-state-text">No leads</div></div>';
  } else if (notebookTab === 'tasks') {
    el.innerHTML = items.map(t => `
      <div class="list-item" style="padding:10px 14px">
        <span style="font-size:16px">${t.done ? '✅' : '⬜'}</span>
        <div class="list-item-body">
          <div class="list-item-title" style="${t.done?'text-decoration:line-through;color:var(--text3)':''}">${escHtml(t.title||'')}</div>
        </div>
      </div>`).join('') || '<div class="empty-state"><div class="empty-state-text">No tasks</div></div>';
  } else if (notebookTab === 'wantList') {
    el.innerHTML = items.map(w => `
      <div class="card" style="margin-bottom:8px">
        <div style="font-weight:600">${escHtml(w.brand||'')} ${escHtml(w.model||'')}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">${w.maxBudget ? 'Budget: '+fmt(w.maxBudget) : ''}${w.notes?' · '+escHtml(w.notes):''}</div>
      </div>`).join('') || '<div class="empty-state"><div class="empty-state-text">No want list items</div></div>';
  }
}

function addNote() {
  const title = prompt('Note title:');
  if (!title) return;
  const content = prompt('Note content:');
  const note = { id: genId(), title, content: content||'', type:'note', createdAt: new Date().toISOString() };
  notebook.notes.unshift(note);
  POST('/notebook', notebook);
  renderNotebook();
}

// ── Purchases ─────────────────────────────────────────────────────────────
function renderPurchases() {
  const el = document.getElementById('purchases-list');
  el.innerHTML = purchases.map(p => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(p.watchDesc||'')}</div>
        <div class="list-item-sub">${escHtml(p.dealerName||'')} · ${escHtml(p.date||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(p.amount)}</div>
        <div class="list-item-tag">${escHtml(p.paymentMethod||'')}</div>
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-text">No purchases yet</div></div>';
}

function renderInvoiceList() {
  const el = document.getElementById('invoices-list');
  el.innerHTML = outgoingInvoices.map(inv => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">Invoice #${inv.number} · ${escHtml(inv.toName||'')}</div>
        <div class="list-item-sub">${escHtml(inv.date||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(inv.total)}</div>
        <div>${statusBadge(inv.status==='paid'?'Paid':inv.status==='sent'?'Sent':'Draft','green')}</div>
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-text">No invoices yet</div></div>';
}

function renderExpenses() {
  const el = document.getElementById('expenses-list');
  const total = expenses.reduce((s, e) => s + (e.amount||0), 0);
  el.innerHTML = `<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)">Total: <strong style="color:var(--gold2)">${fmt(total)}</strong></div>` +
    expenses.map(e => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(e.description||'')}</div>
        <div class="list-item-sub">${escHtml(e.vendor||'')} · ${escHtml(e.date||'')} · ${escHtml(e.category||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(e.amount)}</div>
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-text">No expenses yet</div></div>';
}

function renderAccessories() {
  document.getElementById('accessories-list').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📿</div><div class="empty-state-text">No accessories yet</div></div>';
}

// ── Settings ──────────────────────────────────────────────────────────────
function populateSettingsForm() {
  const s = settings;
  const f = id => document.getElementById(id);
  if (f('s-store-name'))   f('s-store-name').value   = s.storeName||'';
  if (f('s-store-phone'))  f('s-store-phone').value  = s.storePhone||'';
  if (f('s-store-email'))  f('s-store-email').value  = s.storeEmail||'';
  if (f('s-store-address'))f('s-store-address').value= s.storeAddress||'';
  if (f('s-tax-rate'))     f('s-tax-rate').value     = s.taxRate||9;
  if (f('s-expiry-days'))  f('s-expiry-days').value  = s.estimateExpiryDays||30;
  if (f('s-expiry-alerts'))f('s-expiry-alerts').checked = s.expiryAlertsEnabled!==false;
  if (f('s-followup'))     f('s-followup').checked   = s.followupRemindersEnabled!==false;
  if (f('s-birthday'))     f('s-birthday').checked   = s.birthdayRemindersEnabled!==false;
}

function populateDataLists() {
  const bl = document.getElementById('brand-list');
  const ml = document.getElementById('model-list');
  if (bl) bl.innerHTML = (settings.brands||[]).map(b => `<option value="${escHtml(b)}">`).join('');
  if (ml) ml.innerHTML = (settings.models||[]).map(m => `<option value="${escHtml(m)}">`).join('');
}

async function saveSettings() {
  const g = id => document.getElementById(id);
  const s = {
    storeName:   g('s-store-name')?.value||'',
    storePhone:  g('s-store-phone')?.value||'',
    storeEmail:  g('s-store-email')?.value||'',
    storeAddress:g('s-store-address')?.value||'',
    taxRate:     parseFloat(g('s-tax-rate')?.value)||9,
    estimateExpiryDays: parseInt(g('s-expiry-days')?.value)||30,
    expiryAlertsEnabled:   g('s-expiry-alerts')?.checked,
    followupRemindersEnabled: g('s-followup')?.checked,
    birthdayRemindersEnabled: g('s-birthday')?.checked,
  };
  await POST('/settings', s);
  Object.assign(settings, s);
  showToast('Settings saved');
}

// ── Search wiring ─────────────────────────────────────────────────────────
function setupSearch() {
  document.getElementById('inv-search')?.addEventListener('input', () => renderInventory());
  document.getElementById('inv-filter')?.addEventListener('change', () => renderInventory());
  document.getElementById('est-search')?.addEventListener('input', () => renderEstimates());
  document.getElementById('est-filter')?.addEventListener('change', () => renderEstimates());
  document.getElementById('cust-search')?.addEventListener('input', () => renderCustomers());
}

// ── Modals ────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
});

// ── Utilities ─────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return '$' + (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function nextStockNum() {
  const last = settings.lastStockNum || 2000;
  settings.lastStockNum = last + 1;
  POST('/settings', { lastStockNum: settings.lastStockNum });
  return 'TW' + String(last + 1).padStart(4, '0');
}

function statusBadge(status, force) {
  const map = { 'In Stock':'badge-green', 'Listed':'badge-blue', 'Sold':'badge-gray', 'Consignment':'badge-amber', 'Paid':'badge-green', 'Sent':'badge-blue', 'Draft':'badge-gray' };
  const cls = force ? 'badge-'+force : (map[status]||'badge-gray');
  return `<span class="badge ${cls}">${escHtml(status||'')}</span>`;
}
function statusBadgeEst(status) {
  const map = { 'Pending Approval':'badge-amber', 'Approved':'badge-blue', 'In Progress':'badge-blue', 'Ready for Pickup':'badge-green', 'Completed':'badge-gray' };
  return `<span class="badge ${map[status]||'badge-gray'}">${escHtml(status||'')}</span>`;
}

function detailRow(label, value) {
  return `<div><div class="card-label">${label}</div><div style="font-size:13.5px">${escHtml(value||'—')}</div></div>`;
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

async function signOut() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ── Start ─────────────────────────────────────────────────────────────────
init();
