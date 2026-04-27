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


// ── Theme ─────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  const icons = document.querySelectorAll('#theme-toggle-btn, #mobile-theme-btn');
  icons.forEach(el => { if (el) el.textContent = isDark ? '🌙' : '☀️'; });
  const toggle = document.getElementById('s-light-mode');
  if (toggle) toggle.checked = !isDark;
  localStorage.setItem('tantalum-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  POST('/settings', { theme: document.documentElement.getAttribute('data-theme') });
}

function applyThemeFromToggle() {
  const light = document.getElementById('s-light-mode')?.checked;
  applyTheme(light ? 'light' : 'dark');
  POST('/settings', { theme: light ? 'light' : 'dark' });
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  const me = await GET('/me');
  if (!me) return;
  // Apply saved theme
  const savedTheme = settings.theme || localStorage.getItem('tantalum-theme') || 'dark';
  applyTheme(savedTheme);
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

  const titles = { dashboard:'Dashboard', inventory:'Inventory', estimates:'Estimates & Jobs', customers:'Customers', notebook:'Notebook', purchases:'Purchase Log', invoices:'Invoices', expenses:'Expenses', accessories:'Accessories', reports:'Reports', accessories:'Accessories', appraisals:'Appraisals', dealers:'Dealers & Contacts', settings:'Settings' };
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
  if (view === 'accessories') { loadAccessories().then(renderAccessories); }
  if (view === 'reports')     renderReports();
  if (view === 'appraisals')  { loadAppraisals().then(renderAppraisals); }
  if (view === 'dealers')     { loadDealers().then(renderDealers); }

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
  if (view === 'expenses')   html = `<button class="btn btn-primary btn-sm" onclick="openAddExpense()">+ Add Expense</button>`;
  if (view === 'purchases')  html = `<button class="btn btn-primary btn-sm" onclick="openAddPurchase()">+ Add Purchase</button>`;
  if (view === 'invoices')   html = `<button class="btn btn-primary btn-sm" onclick="openAddInvoice()">+ New Invoice</button>`;
  if (view === 'appraisals')   html = `<button class="btn btn-primary btn-sm" onclick="openAddAppraisal()">+ New Appraisal</button>`;
  if (view === 'accessories') html = `<button class="btn btn-primary btn-sm" onclick="openAddAccessory()">+ Add Accessory</button>`;
  if (view === 'dealers')    html = `<button class="btn btn-primary btn-sm" onclick="openAddDealer()">+ Add Contact</button>`;
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
  grid.innerHTML = list.map(w => {
    const photos = w.photos || {};
    const photoKeys = Object.keys(photos);
    const mainPhoto = photoKeys.length > 0 ? photos[photoKeys[0]] : null;
    return `
    <div class="watch-card" onclick="openWatchDetail('${w.id}')">
      <div class="watch-card-img" style="background:var(--bg3)">
        ${mainPhoto
          ? `<img src="/api/uploads/${mainPhoto}" style="width:100%;height:100%;object-fit:cover"/>`
          : `<span style="font-size:40px;color:var(--text3)">⌚</span>`}
      </div>
      <div class="watch-card-body">
        <div class="watch-card-brand">${escHtml(w.brand||'—')}</div>
        <div class="watch-card-model">${escHtml(w.model||'—')}</div>
        <div style="margin-bottom:8px">${statusBadge(w.status)}</div>
        <div class="watch-card-footer">
          <div class="watch-card-price">${fmt(w.retailPrice||w.cost)}</div>
          <div class="watch-card-stock">${escHtml(w.stockNum||'')}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openWatchDetail(id) {
  const w = watches.find(x => x.id === id);
  if (!w) return;
  const photos = w.photos || {};
  const photoKeys = Object.keys(photos);
  const mainPhoto = photoKeys.length > 0 ? photos[photoKeys[0]] : null;

  document.getElementById('watch-modal-title').textContent = `${w.brand||''} ${w.model||''}`.trim();
  document.getElementById('watch-modal-body').innerHTML = `
    <!-- Photo section -->
    <div style="margin-bottom:16px">
      <div id="watch-photo-display" style="width:100%;height:220px;background:var(--bg3);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:10px;position:relative">
        ${mainPhoto ? `<img src="/api/uploads/${mainPhoto}" style="width:100%;height:100%;object-fit:cover"/>` : `<div style="text-align:center;color:var(--text3)"><div style="font-size:40px">⌚</div><div style="font-size:12px;margin-top:6px">No photo</div></div>`}
      </div>
      ${photoKeys.length > 1 ? `<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">${photoKeys.map(k => `<img src="/api/uploads/${photos[k]}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid transparent" onclick="document.querySelector('#watch-photo-display img, #watch-photo-display div').remove(); document.getElementById('watch-photo-display').innerHTML='<img src=\'/api/uploads/${photos[k]}\' style=\'width:100%;height:100%;object-fit:cover\'/>'"/>`).join('')}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          📷 Add Photo
          <input type="file" accept="image/*" style="display:none" onchange="uploadWatchPhoto('${w.id}', this)"/>
        </label>
        ${photoKeys.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="deleteWatchPhoto('${w.id}', '${photoKeys[0]}')">Remove Photo</button>` : ''}
      </div>
    </div>
    <!-- Details grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      ${detailRow('Brand', w.brand)} ${detailRow('Model', w.model)}
      ${detailRow('Ref #', w.ref)} ${detailRow('Serial', w.serial)}
      ${detailRow('Condition', w.condition)} ${detailRow('Status', w.status)}
      ${detailRow('Dial Color', w.dialColor)} ${detailRow('Bracelet', w.bracelet)}
      ${detailRow('Accessories', w.accessories)} ${detailRow('Source', w.sourceName)}
      ${detailRow('Purchase Date', w.purchaseDate)} ${detailRow('Stock #', w.stockNum)}
      ${detailRow('Cost', fmt(w.cost))} ${detailRow('Retail Price', fmt(w.retailPrice))}
      ${w.wholesalePrice ? detailRow('Wholesale', fmt(w.wholesalePrice)) : ''}
      ${w.soldPrice ? detailRow('Sold Price', fmt(w.soldPrice)) : ''}
    </div>
    ${w.isConsignment ? `
    <div style="margin-bottom:16px;padding:12px;background:var(--amber-dim);border-radius:var(--radius-sm);border-left:3px solid var(--amber)">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--amber);font-weight:700;margin-bottom:8px">Consignment</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        ${detailRow('Consignor', w.consignorName)} ${detailRow('Phone', w.consignorPhone)}
        ${detailRow('Asking Price', fmt(w.consignAskingPrice))} ${detailRow('Min Price', fmt(w.consignMinPrice))}
        ${detailRow('Commission', (w.consignCommission||0)+'%')} ${detailRow('End Date', w.consignEndDate)}
      </div>
    </div>` : ''}
    ${w.notes ? `<div class="card-label" style="margin-bottom:6px">Notes</div><p style="font-size:13.5px;color:var(--text2);margin-bottom:16px;line-height:1.5">${escHtml(w.notes)}</p>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="openEditWatch('${w.id}')">✏️ Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="openServiceLog('${w.id}')">🔧 Service Log</button>
      <button class="btn btn-secondary btn-sm" onclick="openPartsTracker('${w.id}')">🔩 Parts</button>
      <button class="btn btn-secondary btn-sm" onclick="openEbayGenerator('${w.id}')">🛒 eBay</button>
      <button class="btn btn-secondary btn-sm" onclick="openChrono24Generator('${w.id}')">⌚ Chrono24</button>
      <button class="btn btn-danger btn-sm" onclick="deleteWatch('${w.id}')">🗑 Delete</button>
    </div>`;
  openModal('watch-modal-overlay');
}

async function uploadWatchPhoto(watchId, input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);
  showToast('Uploading photo…');
  try {
    const res = await fetch('/api/uploads', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.fileName) {
      const w = watches.find(x => x.id === watchId);
      if (!w) return;
      if (!w.photos) w.photos = {};
      const key = 'photo_' + Date.now();
      w.photos[key] = data.fileName;
      await POST('/watches', w);
      await loadWatches();
      openWatchDetail(watchId);
      showToast('Photo uploaded');
    }
  } catch(e) { showToast('Upload failed'); }
}

async function deleteWatchPhoto(watchId, photoKey) {
  const w = watches.find(x => x.id === watchId);
  if (!w || !w.photos) return;
  const fileName = w.photos[photoKey];
  if (fileName) await DEL('/uploads/' + fileName);
  delete w.photos[photoKey];
  await POST('/watches', w);
  await loadWatches();
  openWatchDetail(watchId);
  showToast('Photo removed');
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
  const csEl = document.getElementById('ew-consignment');
  if (csEl) csEl.checked = !!w.isConsignment;
  const cfEl = document.getElementById('ew-consignment-fields');
  if (cfEl) cfEl.style.display = w.isConsignment ? 'block' : 'none';
  if (w.isConsignment) {
    const fg = id => { const el = document.getElementById(id); if(el) el.value = w[id.replace('ew-consignor-','consignor').replace('ew-consign-','consign').replace(/-([a-z])/g, (m,c)=>c.toUpperCase())]||''; };
    const ef = document.getElementById('ew-consignor-name'); if(ef) ef.value=w.consignorName||'';
    const pf = document.getElementById('ew-consignor-phone'); if(pf) pf.value=w.consignorPhone||'';
    const af = document.getElementById('ew-consign-asking'); if(af) af.value=w.consignAskingPrice||'';
    const mf = document.getElementById('ew-consign-min'); if(mf) mf.value=w.consignMinPrice||'';
    const cf2 = document.getElementById('ew-consign-commission'); if(cf2) cf2.value=w.consignCommission||'';
    const endf = document.getElementById('ew-consign-end'); if(endf) endf.value=w.consignEndDate||'';
  }
  openModal('edit-watch-overlay');
}
function clearWatchForm() {
  ['ew-brand','ew-model','ew-ref','ew-serial','ew-dial','ew-bracelet','ew-cost','ew-price','ew-notes','ew-source','ew-date',
   'ew-consignor-name','ew-consignor-phone','ew-consign-asking','ew-consign-min','ew-consign-commission','ew-consign-end'
  ].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const c = document.getElementById('ew-condition'); if(c) c.value='Excellent';
  const s = document.getElementById('ew-status'); if(s) s.value='In Stock';
  const cs = document.getElementById('ew-consignment'); if(cs) cs.checked=false;
  const cf = document.getElementById('ew-consignment-fields'); if(cf) cf.style.display='none';
}

function toggleConsignmentFields() {
  const on = document.getElementById('ew-consignment')?.checked;
  const fields = document.getElementById('ew-consignment-fields');
  if (fields) fields.style.display = on ? 'block' : 'none';
  const statusEl = document.getElementById('ew-status');
  if (statusEl && on) statusEl.value = 'Consignment';
}

async function saveWatch() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const isConsignment = document.getElementById('ew-consignment')?.checked;
  const watch = {
    id: editingWatchId || genId(),
    brand: g('ew-brand'), model: g('ew-model'), ref: g('ew-ref'), serial: g('ew-serial'),
    condition: g('ew-condition'), status: g('ew-status'),
    dialColor: g('ew-dial'), bracelet: g('ew-bracelet'),
    cost: parseFloat(g('ew-cost'))||0, retailPrice: parseFloat(g('ew-price'))||0,
    notes: g('ew-notes'), sourceName: g('ew-source'), purchaseDate: g('ew-date'),
    stockNum: editingWatchId ? watches.find(w=>w.id===editingWatchId)?.stockNum : nextStockNum(),
    dateAdded: editingWatchId ? watches.find(w=>w.id===editingWatchId)?.dateAdded : new Date().toISOString(),
    isConsignment,
    consignorName: g('ew-consignor-name'), consignorPhone: g('ew-consignor-phone'),
    consignAskingPrice: parseFloat(g('ew-consign-asking'))||0,
    consignMinPrice: parseFloat(g('ew-consign-min'))||0,
    consignCommission: parseFloat(g('ew-consign-commission'))||0,
    consignEndDate: g('ew-consign-end'),
    photos: editingWatchId ? (watches.find(w=>w.id===editingWatchId)?.photos || {}) : {},
    serviceLog: editingWatchId ? (watches.find(w=>w.id===editingWatchId)?.serviceLog || []) : [],
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
    <div class="list-item" style="flex-wrap:wrap;gap:8px">
      <div class="list-item-body" onclick="openEstimateDetail('${e.id}')" style="cursor:pointer">
        <div class="list-item-title">${escHtml(e.customer?.name||'Unknown')}</div>
        <div class="list-item-sub">${escHtml(e.watch?.brand||'')} ${escHtml(e.watch?.model||'')} · ${escHtml(e.date||'')}</div>
      </div>
      <div class="list-item-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="list-item-value">${fmt(e.total)}</div>
        <div>${statusBadgeEst(e.jobStatus)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="printEstimate('${e.id}')">🖨 PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="emailEstimate('${e.id}')">✉️ Email</button>
        </div>
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No estimates yet</div><button class="btn btn-primary" onclick="openAddEstimate()">+ New Estimate</button></div>';
}

function openAddEstimate() {
  editingEstId = null; estLines = [];
  multiWatchMode = false;
  multiWatches = [{ brand: '', model: '', serial: '', lines: [] }];
  ['em-cust-name','em-cust-phone','em-cust-email','em-brand','em-model','em-serial','em-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const singleEl = document.getElementById('em-single-watch');
  const multiEl = document.getElementById('em-multi-watch');
  if (singleEl) singleEl.style.display = 'block';
  if (multiEl) multiEl.style.display = 'none';
  const mBtn = document.getElementById('multi-watch-btn');
  if (mBtn) mBtn.textContent = 'Multi-Watch';
  renderEstLines();
  openModal('est-modal-overlay');
}

function addEstimateLine() {
  estLines.push({ name:'', price:0 });
  renderEstLines();
}

function addServiceChip(name, price) {
  estLines.push({ name, price });
  renderEstLines();
}

function renderEstLines() {
  const el = document.getElementById('em-lines');
  // Service chips from settings
  const chips = (settings.services || []);
  const chipsHtml = chips.length ? `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      ${chips.map(s => `<button class="btn btn-ghost btn-sm" onclick="addServiceChip('${escHtml(s.name||s)}',${s.price||0})" style="font-size:12px">${escHtml(s.name||s)} — $${s.price||0}</button>`).join('')}
    </div>` : '';
  if (!estLines.length) {
    el.innerHTML = chipsHtml + '<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">No services added yet</div>';
    updateEstTotal();
    return;
  }
  el.innerHTML = chipsHtml;
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

function printEstimate(id) {
  window.open('/api/print/estimate/' + id, '_blank');
}

async function emailEstimate(id) {
  // Try SMTP send first if configured
  const data = await api('POST', '/print/estimate/' + id + '/email', {});
  if (!data) return;

  if (!data.to) { showToast('No email address on file'); return; }

  // Check if SMTP is configured
  if (settings.smtpEmail && settings.smtpPassword) {
    showToast('Sending email…');
    const result = await api('POST', '/print/estimate/' + id + '/send', {});
    if (result?.success) {
      showToast('Email sent to ' + data.to);
    } else {
      showToast(result?.error || 'Send failed — opening mail app');
      window.location.href = data.mailto;
    }
  } else {
    // Fall back to mailto
    window.location.href = data.mailto;
    showToast('Mail app opened');
  }
}

function openEstimateDetail(id) {
  const e = estimates.find(x => x.id === id);
  if (!e) return;
  document.getElementById('watch-modal-title').textContent = `Estimate — ${e.customer?.name || 'Unknown'}`;
  const lines = (e.lineItems||[]).map(l => `<tr><td style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13.5px">${escHtml(l.name||'')}</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid var(--border)">${fmt(l.price)}</td></tr>`).join('');
  const optLines = (e.optionalItems||[]).length ? `<tr><td colspan="2" style="padding:8px 0;font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em">Optional</td></tr>` + (e.optionalItems||[]).map(l => `<tr><td style="padding:6px 0;color:var(--text2);font-size:13px;font-style:italic">${escHtml(l.name||'')} (optional)</td><td style="text-align:right;padding:6px 0;color:var(--text2)">${fmt(l.price)}</td></tr>`).join('') : '';
  document.getElementById('watch-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${detailRow('Customer', e.customer?.name)} ${detailRow('Phone', e.customer?.phone)}
      ${detailRow('Email', e.customer?.email)} ${detailRow('Date', e.date)}
      ${detailRow('Watch', (e.watch?.brand||'')+' '+(e.watch?.model||''))} ${detailRow('Serial', e.watch?.serial)}
      ${detailRow('Status', e.jobStatus)}
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      ${lines}${optLines}
      <tr><td style="padding:10px 0;font-weight:700;font-size:15px">Total</td><td style="text-align:right;font-weight:700;font-size:15px;color:var(--gold2)">${fmt(e.total)}</td></tr>
    </table>
    ${e.notes ? `<div class="card-label" style="margin-bottom:4px">Notes</div><p style="font-size:13.5px;color:var(--text2);margin-bottom:16px">${escHtml(e.notes)}</p>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="printEstimate('${e.id}')">🖨 View PDF</button>
      <button class="btn btn-secondary btn-sm" onclick="emailEstimate('${e.id}')">✉️ Email to Customer</button>
      <button class="btn btn-ghost btn-sm" onclick="deleteEstimate('${e.id}')">🗑 Delete</button>
    </div>`;
  openModal('watch-modal-overlay');
}

async function deleteEstimate(id) {
  if (!confirm('Delete this estimate?')) return;
  await DEL('/estimates/' + id);
  await loadEstimates();
  closeModal('watch-modal-overlay');
  renderEstimates();
  renderDashboard();
  showToast('Estimate deleted');
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
    <div class="list-item" onclick="openCustomerDetail('${c.id}')">
      <div class="list-item-icon">👤</div>
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(c.name||'')}</div>
        <div class="list-item-sub">${escHtml(c.phone||'')}${c.email?' · '+escHtml(c.email):''}</div>
      </div>
      <div class="list-item-right">
        ${c.birthday ? `<div class="list-item-tag">🎂 ${escHtml(c.birthday)}</div>` : ''}
        ${c.followupDate ? `<div class="list-item-tag" style="color:var(--blue)">📞 ${escHtml(c.followupDate)}</div>` : ''}
      </div>
    </div>`).join('') || '<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-text">No customers yet</div><button class="btn btn-primary" onclick="openAddCustomer()">+ Add Customer</button></div>';
}

function openAddCustomer() {
  editingCustId = null;
  ['cm-name','cm-phone','cm-email','cm-address','cm-birthday','cm-followup','cm-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  openModal('cust-modal-overlay');
}

function openCustomerDetail(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('watch-modal-title').textContent = c.name||'Customer';
  document.getElementById('watch-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      ${detailRow('Phone', c.phone)} ${detailRow('Email', c.email)}
      ${detailRow('Address', c.address)} ${detailRow('Birthday', c.birthday)}
      ${detailRow('Anniversary', c.anniversary)} ${detailRow('Follow-up', c.followupDate)}
    </div>
    ${c.followupNote ? `<div class="card-label" style="margin-bottom:4px">Follow-up Note</div><p style="font-size:13.5px;color:var(--text2);margin-bottom:12px">${escHtml(c.followupNote)}</p>` : ''}
    ${c.notes ? `<div class="card-label" style="margin-bottom:4px">Notes</div><p style="font-size:13.5px;color:var(--text2);margin-bottom:16px;line-height:1.5">${escHtml(c.notes)}</p>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="openEditCustomer('${c.id}')">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.id}')">🗑 Delete</button>
      ${c.phone ? `<a href="tel:${escHtml(c.phone)}" class="btn btn-ghost btn-sm">📞 Call</a>` : ''}
      ${c.email ? `<a href="mailto:${escHtml(c.email)}" class="btn btn-ghost btn-sm">✉️ Email</a>` : ''}
    </div>`;
  openModal('watch-modal-overlay');
}

function openEditCustomer(id) {
  editingCustId = id;
  const c = customers.find(x => x.id === id);
  if (!c) return;
  closeModal('watch-modal-overlay');
  document.getElementById('cust-modal-title').textContent = 'Edit Customer';
  const f = n => document.getElementById(n);
  f('cm-name').value = c.name||'';
  f('cm-phone').value = c.phone||'';
  f('cm-email').value = c.email||'';
  f('cm-address').value = c.address||'';
  f('cm-birthday').value = c.birthday||'';
  f('cm-followup').value = c.followupDate||'';
  f('cm-notes').value = c.notes||'';
  openModal('cust-modal-overlay');
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  await DEL('/customers/' + id);
  await loadCustomers();
  closeModal('watch-modal-overlay');
  renderCustomers();
  showToast('Customer deleted');
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
  const total = purchases.reduce((s, p) => s + (p.amount||0), 0);
  el.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:var(--text2)">Total: <strong style="color:var(--gold2)">${fmt(total)}</strong></span>
      <button class="btn btn-primary btn-sm" onclick="openAddPurchase()">+ Add Purchase</button>
    </div>` +
    (purchases.length ? purchases.map(p => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(p.watchDesc||'')}</div>
        <div class="list-item-sub">${escHtml(p.dealerName||'')} · ${escHtml(p.date||'')} · ${escHtml(p.paymentMethod||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(p.amount)}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="deletePurchase('${p.id}',event)">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">💰</div><div class="empty-state-text">No purchases yet</div></div>');
}

function openAddPurchase() {
  ['pur-desc','pur-dealer','pur-amount','pur-date','pur-payment','pur-notes'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  const d = document.getElementById('pur-date');
  if (d) d.value = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  openModal('purchase-modal-overlay');
}

async function savePurchase() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const p = {
    id: genId(),
    watchDesc: g('pur-desc'), dealerName: g('pur-dealer'),
    amount: parseFloat(g('pur-amount'))||0, date: g('pur-date'),
    paymentMethod: g('pur-payment'), notes: g('pur-notes'),
    type: 'manual', status: 'complete',
    createdAt: new Date().toISOString(),
  };
  await POST('/invoices/purchases', p);
  await loadInvoiceData();
  closeModal('purchase-modal-overlay');
  renderPurchases();
  showToast('Purchase saved');
}

async function deletePurchase(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this purchase?')) return;
  await DEL('/invoices/purchases/' + id);
  await loadInvoiceData();
  renderPurchases();
  showToast('Purchase deleted');
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
  el.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:var(--text2)">Total: <strong style="color:var(--gold2)">${fmt(total)}</strong></span>
      <button class="btn btn-primary btn-sm" onclick="openAddExpense()">+ Add Expense</button>
    </div>` +
    (expenses.length ? expenses.map(e => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(e.description||'')}</div>
        <div class="list-item-sub">${escHtml(e.vendor||'')} · ${escHtml(e.date||'')} · ${escHtml(e.category||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(e.amount)}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="deleteExpense('${e.id}',event)">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-text">No expenses yet</div></div>');
}

function openAddExpense() {
  ['exp-description','exp-vendor','exp-amount','exp-date','exp-category','exp-payment'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  const d = document.getElementById('exp-date');
  if (d) d.value = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  openModal('expense-modal-overlay');
}

async function saveExpense() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const exp = {
    id: genId(),
    description: g('exp-description'), vendor: g('exp-vendor'),
    amount: parseFloat(g('exp-amount'))||0, date: g('exp-date'),
    category: g('exp-category'), payment: g('exp-payment'),
    createdAt: new Date().toISOString(),
  };
  await POST('/invoices/expenses', exp);
  await loadInvoiceData();
  closeModal('expense-modal-overlay');
  renderExpenses();
  showToast('Expense saved');
}

async function deleteExpense(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this expense?')) return;
  await DEL('/invoices/expenses/' + id);
  await loadInvoiceData();
  renderExpenses();
  showToast('Expense deleted');
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
  if (f('s-smtp-email'))   f('s-smtp-email').value   = s.smtpEmail||'';
  if (f('s-smtp-name'))    f('s-smtp-name').value    = s.smtpName||'';
  // Render all lists
  renderSettingsList('services', 's-services-list', true);
  renderSettingsList('brands', 's-brands-list');
  renderSettingsList('dialColors', 's-dialColors-list');
  renderSettingsList('braceletTypes', 's-braceletTypes-list');
  renderSettingsList('statuses', 's-statuses-list');
}

function renderSettingsList(key, elId, isServices) {
  const el = document.getElementById(elId);
  if (!el) return;
  const items = settings[key] || [];
  if (!items.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0">None added yet</div>';
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">${items.map((item, i) => {
    const label = isServices ? `${item.name||item} — $${item.price||0}` : (item.name||item);
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg4);border:1px solid var(--border2);padding:4px 10px;border-radius:20px;font-size:12px">
      ${escHtml(label)}
      <button onclick="removeListItem('${key}',${i},'${elId}',${isServices})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;line-height:1;padding:0 0 0 4px">×</button>
    </span>`;
  }).join('')}</div>`;
}

function addListItem(key, inputId, elId) {
  const input = document.getElementById(inputId);
  if (!input?.value?.trim()) return;
  if (!settings[key]) settings[key] = [];
  settings[key].push(input.value.trim());
  input.value = '';
  POST('/settings', { [key]: settings[key] });
  populateDataLists();
  renderSettingsList(key, elId);
}

function removeListItem(key, index, elId, isServices) {
  if (!settings[key]) return;
  settings[key].splice(index, 1);
  POST('/settings', { [key]: settings[key] });
  populateDataLists();
  renderSettingsList(key, elId, isServices);
}

function addServicePreset() {
  const name = document.getElementById('s-new-service-name')?.value?.trim();
  const price = parseFloat(document.getElementById('s-new-service-price')?.value)||0;
  if (!name) return;
  if (!settings.services) settings.services = [];
  settings.services.push({ name, price });
  document.getElementById('s-new-service-name').value = '';
  document.getElementById('s-new-service-price').value = '';
  POST('/settings', { services: settings.services });
  renderSettingsList('services', 's-services-list', true);
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
    smtpEmail:    g('s-smtp-email')?.value||'',
    smtpPassword: g('s-smtp-password')?.value||'',
    smtpName:     g('s-smtp-name')?.value||'',
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
  const map = { 'In Stock':'badge-green', 'Listed':'badge-blue', 'Sold':'badge-gray', 'Consignment':'badge-amber', 'Available':'badge-green', 'Paid':'badge-green', 'Sent':'badge-blue', 'Draft':'badge-gray' };
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

// ── Outgoing Invoices ─────────────────────────────────────────────────────
let invLines = [];
let editingInvId = null;

function renderInvoiceList() {
  const el = document.getElementById('invoices-list');
  const total = outgoingInvoices.reduce((s, i) => s + (i.total||0), 0);
  el.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:var(--text2)">Total: <strong style="color:var(--gold2)">${fmt(total)}</strong></span>
      <button class="btn btn-primary btn-sm" onclick="openAddInvoice()">+ New Invoice</button>
    </div>` +
    (outgoingInvoices.length ? outgoingInvoices.map(inv => `
    <div class="list-item" onclick="openEditInvoice('${inv.id||''}')">
      <div class="list-item-body">
        <div class="list-item-title">Invoice #${inv.number||''} · ${escHtml(inv.toName||'')}</div>
        <div class="list-item-sub">${escHtml(inv.date||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(inv.total)}</div>
        <div>${statusBadge(inv.status==='paid'?'Paid':inv.status==='sent'?'Sent':'Draft', inv.status==='paid'?'green':inv.status==='sent'?'blue':'gray')}</div>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-text">No invoices yet</div></div>');
}

function openAddInvoice() {
  editingInvId = null;
  invLines = [];
  const nextNum = (outgoingInvoices.reduce((m, i) => Math.max(m, i.number||0), 1100)) + 1;
  document.getElementById('inv-number').value = nextNum;
  document.getElementById('inv-date').value = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  ['inv-to-name','inv-to-email','inv-to-phone','inv-to-address','inv-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('inv-status').value = 'sent';
  renderInvLines();
  openModal('invoice-modal-overlay');
}

function openEditInvoice(id) {
  const inv = outgoingInvoices.find(x => x.id === id);
  if (!inv) return;
  editingInvId = id;
  invLines = (inv.lines||[]).map(l => ({ desc: l.desc||'', qty: l.qty||1, price: l.price||0 }));
  const g = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  g('inv-number', inv.number); g('inv-date', inv.date);
  g('inv-to-name', inv.toName); g('inv-to-email', inv.toEmail);
  g('inv-to-phone', inv.toPhone); g('inv-to-address', inv.toAddress);
  g('inv-notes', inv.notes); g('inv-status', inv.status||'sent');
  renderInvLines();
  document.getElementById('invoice-modal-title').textContent = `Invoice #${inv.number}`;
  openModal('invoice-modal-overlay');
}

function addInvoiceLine() {
  invLines.push({ desc: '', qty: 1, price: 0 });
  renderInvLines();
}

function renderInvLines() {
  const el = document.getElementById('inv-lines');
  if (!invLines.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px 0">No line items yet</div>';
    updateInvTotal();
    return;
  }
  el.innerHTML = invLines.map((l, i) => `
    <div style="display:grid;grid-template-columns:1fr 60px 90px 32px;gap:8px;margin-bottom:8px;align-items:center">
      <input class="field" placeholder="Description" value="${escHtml(l.desc)}" oninput="invLines[${i}].desc=this.value" style="font-size:13px"/>
      <input class="field" type="number" placeholder="Qty" value="${l.qty}" oninput="invLines[${i}].qty=parseInt(this.value)||1;updateInvTotal()" style="font-size:13px"/>
      <input class="field" type="number" placeholder="Price" value="${l.price||''}" oninput="invLines[${i}].price=parseFloat(this.value)||0;updateInvTotal()" style="font-size:13px"/>
      <button class="btn-icon" onclick="invLines.splice(${i},1);renderInvLines()" style="font-size:16px">×</button>
    </div>`).join('');
  updateInvTotal();
}

function updateInvTotal() {
  const sub = invLines.reduce((s, l) => s + (l.qty||1) * (l.price||0), 0);
  const el = document.getElementById('inv-subtotal');
  const tel = document.getElementById('inv-total');
  if (el) el.textContent = fmt(sub);
  if (tel) tel.textContent = fmt(sub);
}

async function saveInvoice() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const sub = invLines.reduce((s, l) => s + (l.qty||1) * (l.price||0), 0);
  
  // Capture trade-in
  let tradeIn = null;
  if (hasTradeIn) {
    tradeIn = { brand: g('ti-brand'), model: g('ti-model'), ref: g('ti-ref'), value: parseFloat(g('ti-value'))||0, notes: g('ti-notes') };
    // Auto-add to inventory
    if (tradeIn.brand || tradeIn.model) {
      const sn = nextStockNum();
      const tiWatch = { id: genId(), brand: tradeIn.brand, model: tradeIn.model, ref: tradeIn.ref, cost: tradeIn.value, status: 'In Stock', notes: `Trade-in from Invoice #${g('inv-number')}. ${tradeIn.notes}`.trim(), sourceName: g('inv-to-name'), sourceType: 'Trade-in', stockNum: sn, dateAdded: new Date().toISOString() };
      await POST('/watches', tiWatch);
      await loadWatches();
      showToast(`Trade-in added to inventory as ${sn}`);
    }
  }

  const inv = {
    id: editingInvId || genId(),
    number: parseInt(g('inv-number'))||1101,
    date: g('inv-date'), toName: g('inv-to-name'),
    toEmail: g('inv-to-email'), toPhone: g('inv-to-phone'),
    toAddress: g('inv-to-address'),
    lines: invLines.map(l => ({ desc: l.desc, qty: l.qty||1, price: l.price||0 })),
    subtotal: sub, taxRate: 0, taxAmt: 0, total: sub,
    notes: g('inv-notes'), status: g('inv-status'),
    tradeIn, nextNumber: parseInt(g('inv-number')) + 1,
    createdAt: new Date().toISOString(),
  };
  await POST('/invoices/outgoing', inv);
  await loadInvoiceData();
  hasTradeIn = false;
  closeModal('invoice-modal-overlay');
  renderInvoiceList();
  showToast('Invoice saved');
}

// ── Appraisals ────────────────────────────────────────────────────────────
let appraisals = [];

async function loadAppraisals() {
  appraisals = await GET('/invoices/appraisals') || [];
}

function renderAppraisals() {
  const el = document.getElementById('appraisals-list');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:var(--text2)">${appraisals.length} appraisal${appraisals.length!==1?'s':''}</span>
      <button class="btn btn-primary btn-sm" onclick="openAddAppraisal()">+ New Appraisal</button>
    </div>` +
    (appraisals.length ? appraisals.map(a => `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(a.brand||'')} ${escHtml(a.model||'')} — ${escHtml(a.customer||'')}</div>
        <div class="list-item-sub">${escHtml(a.type||'')} · ${escHtml(a.date||'')}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(a.value)}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="deleteAppraisal('${a.id}',event)">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">No appraisals yet</div></div>');
}

function openAddAppraisal() {
  ['apr-customer','apr-brand','apr-model','apr-ref','apr-serial','apr-condition','apr-value','apr-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const d = document.getElementById('apr-date');
  if (d) d.value = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  openModal('appraisal-modal-overlay');
}

async function saveAppraisal() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const a = { id: genId(), customer: g('apr-customer'), date: g('apr-date'), type: g('apr-type'), brand: g('apr-brand'), model: g('apr-model'), ref: g('apr-ref'), serial: g('apr-serial'), condition: g('apr-condition'), value: parseFloat(g('apr-value'))||0, notes: g('apr-notes'), createdAt: new Date().toISOString() };
  await POST('/invoices/appraisals', a);
  await loadAppraisals();
  closeModal('appraisal-modal-overlay');
  renderAppraisals();
  showToast('Appraisal saved');
}

async function deleteAppraisal(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this appraisal?')) return;
  await DEL('/invoices/appraisals/' + id);
  await loadAppraisals();
  renderAppraisals();
  showToast('Appraisal deleted');
}

// ── Dealers & Contacts ────────────────────────────────────────────────────
let dealers = [];
let editingDealerId = null;

async function loadDealers() {
  dealers = await GET('/invoices/dealers') || [];
}

function renderDealers() {
  const el = document.getElementById('dealers-list');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:var(--text2)">${dealers.length} contact${dealers.length!==1?'s':''}</span>
      <button class="btn btn-primary btn-sm" onclick="openAddDealer()">+ Add Contact</button>
    </div>` +
    (dealers.length ? dealers.map(d => `
    <div class="list-item" onclick="openEditDealer('${d.id}')">
      <div class="list-item-icon">🤝</div>
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(d.name||'')}</div>
        <div class="list-item-sub">${escHtml(d.type||'')}${d.location?' · '+escHtml(d.location):''}${d.phone?' · '+escHtml(d.phone):''}</div>
      </div>
      <div class="list-item-right">
        <button class="btn btn-ghost btn-sm" onclick="deleteDealer('${d.id}',event)">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">🤝</div><div class="empty-state-text">No contacts yet</div></div>');
}

function openAddDealer() {
  editingDealerId = null;
  ['dl-name','dl-phone','dl-email','dl-location','dl-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('dealer-modal-title').textContent = 'Add Contact';
  openModal('dealer-modal-overlay');
}

function openEditDealer(id) {
  editingDealerId = id;
  const d = dealers.find(x => x.id === id);
  if (!d) return;
  document.getElementById('dealer-modal-title').textContent = 'Edit Contact';
  const g = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  g('dl-name', d.name); g('dl-phone', d.phone); g('dl-email', d.email);
  g('dl-location', d.location); g('dl-notes', d.notes);
  const t = document.getElementById('dl-type'); if(t) t.value = d.type||'Dealer';
  openModal('dealer-modal-overlay');
}

async function saveDealer() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const d = { id: editingDealerId || genId(), name: g('dl-name'), phone: g('dl-phone'), email: g('dl-email'), type: g('dl-type'), location: g('dl-location'), notes: g('dl-notes'), createdAt: new Date().toISOString() };
  await POST('/invoices/dealers', d);
  await loadDealers();
  closeModal('dealer-modal-overlay');
  renderDealers();
  showToast('Contact saved');
}

async function deleteDealer(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this contact?')) return;
  await DEL('/invoices/dealers/' + id);
  await loadDealers();
  renderDealers();
  showToast('Contact deleted');
}

// ── Service Log ───────────────────────────────────────────────────────────
let currentServiceWatchId = null;

function openServiceLog(watchId) {
  currentServiceWatchId = watchId;
  const w = watches.find(x => x.id === watchId);
  if (!w) return;
  const log = w.serviceLog || [];
  document.getElementById('watch-modal-title').textContent = `${w.brand||''} ${w.model||''} — Service Log`;
  document.getElementById('watch-modal-body').innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn btn-primary btn-sm" onclick="openAddServiceEntry('${watchId}')">+ Add Entry</button>
    </div>
    ${log.length ? log.map((s, i) => `
      <div class="card" style="margin-bottom:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:600;font-size:13.5px">${escHtml(s.type||'')}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${escHtml(s.date||'')} · ${escHtml(s.by||'')}${s.cost?' · '+fmt(s.cost):''}</div>
            ${s.notes ? `<div style="font-size:12.5px;color:var(--text2);margin-top:4px">${escHtml(s.notes)}</div>` : ''}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="deleteServiceEntry('${watchId}',${i})">🗑</button>
        </div>
      </div>`).join('') : '<div class="empty-state" style="padding:24px"><div class="empty-state-text">No service history yet</div></div>'}
    <hr class="divider"/>
    <button class="btn btn-secondary btn-sm" onclick="openWatchDetail('${watchId}')">← Back to Details</button>`;
  openModal('watch-modal-overlay');
}

function openAddServiceEntry(watchId) {
  currentServiceWatchId = watchId;
  ['svc-by','svc-cost','svc-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const d = document.getElementById('svc-date');
  if (d) d.value = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const t = document.getElementById('svc-type'); if(t) t.value = 'Full Service';
  openModal('service-modal-overlay');
}

async function saveServiceEntry() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const entry = { type: g('svc-type'), date: g('svc-date'), by: g('svc-by'), cost: parseFloat(g('svc-cost'))||0, notes: g('svc-notes') };
  const w = watches.find(x => x.id === currentServiceWatchId);
  if (!w) return;
  if (!w.serviceLog) w.serviceLog = [];
  w.serviceLog.unshift(entry);
  await POST('/watches', w);
  await loadWatches();
  closeModal('service-modal-overlay');
  openServiceLog(currentServiceWatchId);
  showToast('Service entry added');
}

async function deleteServiceEntry(watchId, index) {
  if (!confirm('Delete this service entry?')) return;
  const w = watches.find(x => x.id === watchId);
  if (!w || !w.serviceLog) return;
  w.serviceLog.splice(index, 1);
  await POST('/watches', w);
  await loadWatches();
  openServiceLog(watchId);
  showToast('Entry deleted');
}

// ── Reports ───────────────────────────────────────────────────────────────
function renderReports() {
  const period = document.getElementById('report-period')?.value || 'thisMonth';
  const now = new Date();
  let start, end;

  if (period === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === 'thisYear') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (period === 'lastYear') {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31);
  } else {
    start = new Date('2000-01-01');
    end = new Date('2099-12-31');
  }

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    try { const d = new Date(dateStr); return d >= start && d <= end; } catch { return false; }
  };

  // Sold watches in period
  const sold = watches.filter(w => w.status === 'Sold' && w.soldPrice && inRange(w.purchaseDate));
  const totalRevenue = sold.reduce((s, w) => s + (w.soldPrice || 0), 0);
  const totalCost = sold.reduce((s, w) => s + (w.cost || 0), 0);
  const totalProfit = totalRevenue - totalCost;

  // Expenses in period
  const periodExpenses = expenses.filter(e => inRange(e.date));
  const totalExpenses = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalProfit - totalExpenses;

  // Service revenue from estimates
  const completedEsts = estimates.filter(e => e.jobStatus === 'Completed' && inRange(e.date));
  const serviceRevenue = completedEsts.reduce((s, e) => s + (e.total || 0), 0);
  const taxCollected = completedEsts.reduce((s, e) => s + (e.taxAmt || 0), 0);

  // Stats
  document.getElementById('report-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${fmt(totalRevenue + serviceRevenue)}</div><div class="stat-label">Total Revenue</div></div>
    <div class="stat-card"><div class="stat-value">${fmt(netProfit)}</div><div class="stat-label">Net Profit</div><div class="stat-sub" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${netProfit >= 0 ? '▲' : '▼'} ${((netProfit / (totalRevenue + serviceRevenue || 1)) * 100).toFixed(1)}% margin</div></div>
    <div class="stat-card"><div class="stat-value">${sold.length}</div><div class="stat-label">Watches Sold</div></div>
  `;

  // P&L
  document.getElementById('report-pnl').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Watch Sales Revenue</td><td style="text-align:right;color:var(--gold2);font-weight:600">${fmt(totalRevenue)}</td></tr>
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Service Revenue</td><td style="text-align:right;color:var(--gold2);font-weight:600">${fmt(serviceRevenue)}</td></tr>
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Cost of Goods Sold</td><td style="text-align:right;color:var(--red)">-${fmt(totalCost)}</td></tr>
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Gross Profit</td><td style="text-align:right;font-weight:600">${fmt(totalProfit + serviceRevenue)}</td></tr>
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Expenses</td><td style="text-align:right;color:var(--red)">-${fmt(totalExpenses)}</td></tr>
      <tr><td style="padding:12px 0;font-weight:700;font-size:15px">Net Profit</td><td style="text-align:right;font-weight:700;font-size:15px;color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(netProfit)}</td></tr>
    </table>
  `;

  // Tax report
  document.getElementById('report-tax').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13.5px">
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Taxable Service Revenue</td><td style="text-align:right">${fmt(serviceRevenue - taxCollected)}</td></tr>
      <tr style="border-bottom:1px solid var(--border)"><td style="padding:10px 0;color:var(--text2)">Tax Collected</td><td style="text-align:right;color:var(--gold2);font-weight:600">${fmt(taxCollected)}</td></tr>
      <tr><td style="padding:10px 0;color:var(--text2)">Completed Jobs</td><td style="text-align:right">${completedEsts.length}</td></tr>
    </table>
  `;

  // Sales by watch
  const salesEl = document.getElementById('report-sales');
  salesEl.innerHTML = sold.length ? sold.map(w => {
    const profit = (w.soldPrice || 0) - (w.cost || 0);
    return `
    <div class="list-item">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(w.brand||'')} ${escHtml(w.model||'')} — ${escHtml(w.stockNum||'')}</div>
        <div class="list-item-sub">Cost: ${fmt(w.cost)} · Sold: ${fmt(w.soldPrice)}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value" style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</div>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:20px"><div class="empty-state-text">No sales in this period</div></div>';
}

// ── eBay / Chrono24 Listing Generators ────────────────────────────────────
function openEbayGenerator(watchId) {
  const w = watches.find(x => x.id === watchId);
  if (!w) return;
  document.getElementById('listing-modal-title').textContent = 'eBay Listing';

  const title = buildEbayTitle(w);
  const desc = buildEbayDescription(w);
  const specs = buildEbaySpecs(w);

  document.getElementById('listing-title').value = title;
  document.getElementById('listing-desc').value = desc;
  document.getElementById('listing-specs').value = specs;
  closeModal('watch-modal-overlay');
  openModal('listing-modal-overlay');
}

function openChrono24Generator(watchId) {
  const w = watches.find(x => x.id === watchId);
  if (!w) return;
  document.getElementById('listing-modal-title').textContent = 'Chrono24 Listing';

  const title = buildChrono24Title(w);
  const desc = buildChrono24Description(w);
  const specs = buildChrono24Specs(w);

  document.getElementById('listing-title').value = title;
  document.getElementById('listing-desc').value = desc;
  document.getElementById('listing-specs').value = specs;
  closeModal('watch-modal-overlay');
  openModal('listing-modal-overlay');
}

function buildEbayTitle(w) {
  const parts = [w.brand, w.model, w.ref, w.condition ? `(${w.condition})` : ''].filter(Boolean);
  return parts.join(' ').substring(0, 80);
}

function buildChrono24Title(w) {
  return [w.brand, w.model, w.ref, w.dialColor ? w.dialColor + ' Dial' : ''].filter(Boolean).join(' ').substring(0, 60);
}

function buildEbayDescription(w) {
  const acc = w.accessories || 'None';
  return `For sale: ${w.brand || ''} ${w.model || ''} ${w.ref ? 'Reference ' + w.ref : ''}

Condition: ${w.condition || 'Not specified'}
Serial: ${w.serial || 'N/A'}
Dial Color: ${w.dialColor || 'N/A'}
Bracelet/Strap: ${w.bracelet || 'N/A'}
Accessories: ${acc}

${w.notes || ''}

All watches are inspected before listing. Please message with any questions.

Payment: PayPal or bank transfer accepted.
Shipping: Fully insured with tracking.`;
}

function buildChrono24Description(w) {
  return `${w.brand || ''} ${w.model || ''} ${w.ref ? '— Ref. ' + w.ref : ''}

Condition: ${w.condition || 'Not specified'}
Dial: ${w.dialColor || 'N/A'}
Bracelet: ${w.bracelet || 'N/A'}
Accessories: ${w.accessories || 'None'}
Serial: ${w.serial || 'N/A'}

${w.notes || ''}

Priced fairly and honestly. All questions welcome.`;
}

function buildEbaySpecs(w) {
  const lines = [
    ['Brand', w.brand], ['Model', w.model], ['Reference Number', w.ref],
    ['Serial Number', w.serial], ['Dial Color', w.dialColor],
    ['Bracelet Material', w.bracelet], ['Condition', w.condition],
    ['Accessories Included', w.accessories],
  ];
  return lines.filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n');
}

function buildChrono24Specs(w) {
  const lines = [
    ['Manufacturer', w.brand], ['Model', w.model], ['Reference number', w.ref],
    ['Movement', 'Automatic'], ['Case material', 'Stainless steel'],
    ['Dial color', w.dialColor], ['Bracelet material', w.bracelet],
    ['Condition', w.condition], ['Scope of delivery', w.accessories],
    ['Serial number', w.serial],
  ];
  return lines.filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n');
}

function copyListingField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.tagName === 'INPUT' ? el.value : el.value;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
}

// ── Multi-watch estimates ─────────────────────────────────────────────────
let multiWatchMode = false;
let multiWatches = [{ brand: '', model: '', serial: '', lines: [] }];

function toggleMultiWatch() {
  multiWatchMode = !multiWatchMode;
  const btn = document.getElementById('multi-watch-btn');
  const single = document.getElementById('em-single-watch');
  const multi = document.getElementById('em-multi-watch');
  if (btn) btn.textContent = multiWatchMode ? 'Single Watch' : 'Multi-Watch';
  if (single) single.style.display = multiWatchMode ? 'none' : 'block';
  if (multi) multi.style.display = multiWatchMode ? 'block' : 'none';
  if (multiWatchMode && multiWatches.length === 0) {
    multiWatches = [{ brand: '', model: '', serial: '', lines: [] }];
    renderMultiWatches();
  }
}

function renderMultiWatches() {
  const el = document.getElementById('em-multi-watches');
  if (!el) return;
  el.innerHTML = multiWatches.map((w, wi) => `
    <div class="card" style="margin-bottom:10px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:600;font-size:13px">Watch ${wi + 1}</div>
        ${multiWatches.length > 1 ? `<button class="btn btn-ghost btn-sm" onclick="multiWatches.splice(${wi},1);renderMultiWatches()">Remove</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
        <input class="field" style="font-size:13px" placeholder="Brand" value="${escHtml(w.brand)}" oninput="multiWatches[${wi}].brand=this.value"/>
        <input class="field" style="font-size:13px" placeholder="Model" value="${escHtml(w.model)}" oninput="multiWatches[${wi}].model=this.value"/>
        <input class="field" style="font-size:13px" placeholder="Serial" value="${escHtml(w.serial)}" oninput="multiWatches[${wi}].serial=this.value"/>
      </div>
      <div id="em-multi-lines-${wi}">
        ${(w.lines||[]).map((l, li) => `
          <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
            <input class="field" style="flex:1;font-size:12px" placeholder="Service" value="${escHtml(l.name)}" oninput="multiWatches[${wi}].lines[${li}].name=this.value"/>
            <input class="field" style="width:80px;font-size:12px" type="number" placeholder="Price" value="${l.price||''}" oninput="multiWatches[${wi}].lines[${li}].price=parseFloat(this.value)||0;updateEstTotal()"/>
            <button class="btn-icon" onclick="multiWatches[${wi}].lines.splice(${li},1);renderMultiWatches()">×</button>
          </div>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="multiWatches[${wi}].lines.push({name:'',price:0});renderMultiWatches()">+ Add Service</button>
    </div>`).join('');
  multiWatches.push; // no-op to prevent unused warning
}

// ── Trade-in on invoices ──────────────────────────────────────────────────
let hasTradeIn = false;

function toggleTradeIn() {
  hasTradeIn = !hasTradeIn;
  const fields = document.getElementById('inv-tradein-fields');
  const btn = document.getElementById('inv-tradein-btn');
  if (fields) fields.style.display = hasTradeIn ? 'block' : 'none';
  if (btn) btn.textContent = hasTradeIn ? 'Remove Trade-In' : '+ Add Trade-In';
}


// ── Accessories CRUD ──────────────────────────────────────────────────────
let accessories = [];
let editingAccId = null;

async function loadAccessories() {
  accessories = await GET('/accessories') || [];
}

function renderAccessories() {
  const el = document.getElementById('accessories-list');
  if (!el) return;
  const available = accessories.filter(a => a.status !== 'sold');
  const sold = accessories.filter(a => a.status === 'sold');
  el.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;color:var(--text2)">${accessories.length} item${accessories.length!==1?'s':''}</span>
      <button class="btn btn-primary btn-sm" onclick="openAddAccessory()">+ Add Accessory</button>
    </div>` +
    (accessories.length ? accessories.map(a => `
    <div class="list-item" onclick="openEditAccessory('${a.id}')">
      <div class="list-item-body">
        <div class="list-item-title">${escHtml(a.name||'')}</div>
        <div class="list-item-sub">${escHtml(a.brand||'')} ${escHtml(a.type||'')} · ${escHtml(a.condition||'')}${a.notes?' · '+escHtml(a.notes):''}</div>
      </div>
      <div class="list-item-right">
        <div class="list-item-value">${fmt(a.price||a.cost)}</div>
        <div>${statusBadge(a.status==='available'?'Available':'Sold', a.status==='available'?'green':'gray')}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:4px" onclick="deleteAccessory('${a.id}',event)">🗑</button>
      </div>
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">📿</div><div class="empty-state-text">No accessories yet</div></div>');
}

function openAddAccessory() {
  editingAccId = null;
  ['acc-name','acc-brand','acc-cost','acc-price','acc-notes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('accessory-modal-title').textContent = 'Add Accessory';
  const t = document.getElementById('acc-type'); if(t) t.value = 'Bracelet';
  const c = document.getElementById('acc-condition'); if(c) c.value = 'Excellent';
  const s = document.getElementById('acc-status'); if(s) s.value = 'available';
  openModal('accessory-modal-overlay');
}

function openEditAccessory(id) {
  editingAccId = id;
  const a = accessories.find(x => x.id === id);
  if (!a) return;
  document.getElementById('accessory-modal-title').textContent = 'Edit Accessory';
  const g = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  g('acc-name', a.name); g('acc-brand', a.brand);
  g('acc-cost', a.cost); g('acc-price', a.price); g('acc-notes', a.notes);
  const t = document.getElementById('acc-type'); if(t) t.value = a.type||'Bracelet';
  const c = document.getElementById('acc-condition'); if(c) c.value = a.condition||'Excellent';
  const s = document.getElementById('acc-status'); if(s) s.value = a.status||'available';
  openModal('accessory-modal-overlay');
}

async function saveAccessory() {
  const g = id => document.getElementById(id)?.value?.trim()||'';
  const acc = {
    id: editingAccId || genId(),
    name: g('acc-name'), type: g('acc-type'), brand: g('acc-brand'),
    condition: g('acc-condition'), notes: g('acc-notes'),
    cost: parseFloat(g('acc-cost'))||0, price: parseFloat(g('acc-price'))||0,
    status: g('acc-status'), dateAdded: new Date().toISOString(),
  };
  await POST('/accessories', acc);
  await loadAccessories();
  closeModal('accessory-modal-overlay');
  renderAccessories();
  showToast(editingAccId ? 'Accessory updated' : 'Accessory added');
}

async function deleteAccessory(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this accessory?')) return;
  await DEL('/accessories/' + id);
  await loadAccessories();
  renderAccessories();
  showToast('Accessory deleted');
}

// ── Parts tracker on watch detail ─────────────────────────────────────────
function openPartsTracker(watchId) {
  const w = watches.find(x => x.id === watchId);
  if (!w) return;
  const parts = w.parts || [];
  document.getElementById('watch-modal-title').textContent = `${w.brand||''} ${w.model||''} — Parts`;
  document.getElementById('watch-modal-body').innerHTML = `
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" onclick="openAddPart('${watchId}')">+ Add Part</button>
    </div>
    ${parts.length ? parts.map((p, i) => `
      <div class="card" style="margin-bottom:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:600;font-size:13.5px">${escHtml(p.name||'')}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${escHtml(p.supplier||'')}${p.partNum?' · Part #'+escHtml(p.partNum):''}${p.cost?' · '+fmt(p.cost):''}</div>
            <div style="margin-top:4px"><span class="badge ${p.status==='ordered'?'badge-blue':p.status==='received'?'badge-green':'badge-amber'}">${escHtml(p.status||'needed')}</span></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="deletePart('${watchId}',${i})">🗑</button>
        </div>
      </div>`).join('') : '<div class="empty-state" style="padding:24px"><div class="empty-state-text">No parts tracked</div></div>'}
    <hr class="divider"/>
    <button class="btn btn-secondary btn-sm" onclick="openWatchDetail('${watchId}')">← Back to Details</button>`;
  openModal('watch-modal-overlay');
}

function openAddPart(watchId) {
  currentServiceWatchId = watchId;
  const part = prompt('Part name:');
  if (!part) return;
  const supplier = prompt('Supplier (optional):') || '';
  const cost = parseFloat(prompt('Cost (optional):') || '0') || 0;
  addPart(watchId, { name: part, supplier, cost, status: 'needed', addedAt: new Date().toISOString() });
}

async function addPart(watchId, part) {
  const w = watches.find(x => x.id === watchId);
  if (!w) return;
  if (!w.parts) w.parts = [];
  w.parts.push(part);
  await POST('/watches', w);
  await loadWatches();
  openPartsTracker(watchId);
  showToast('Part added');
}

async function deletePart(watchId, index) {
  if (!confirm('Remove this part?')) return;
  const w = watches.find(x => x.id === watchId);
  if (!w || !w.parts) return;
  w.parts.splice(index, 1);
  await POST('/watches', w);
  await loadWatches();
  openPartsTracker(watchId);
  showToast('Part removed');
}

// ── Data Migration Tool ───────────────────────────────────────────────────
async function runMigration() {
  const statusEl = document.getElementById('migration-status');
  statusEl.style.display = 'block';
  statusEl.style.background = 'var(--blue-dim)';
  statusEl.style.color = 'var(--blue)';
  statusEl.textContent = 'Importing...';

  const results = [];
  let hasAny = false;

  async function importFile(inputId, endpoint, transform) {
    const input = document.getElementById(inputId);
    if (!input?.files?.length) return;
    hasAny = true;
    try {
      const text = await input.files[0].text();
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : (data.items || Object.values(data));
      let count = 0;
      for (const item of items) {
        const transformed = transform ? transform(item) : item;
        if (transformed) {
          await POST(endpoint, transformed);
          count++;
        }
      }
      results.push(`✓ ${inputId.replace('migrate-','')}: ${count} items`);
    } catch(e) {
      results.push(`✗ ${inputId.replace('migrate-','')}: ${e.message}`);
    }
  }

  // Import watches
  await importFile('migrate-watches', '/watches', w => ({
    id: w.id || genId(), brand: w.brand, model: w.model, ref: w.ref, serial: w.serial,
    condition: w.condition, status: w.status || 'In Stock', dialColor: w.dialColor,
    bracelet: w.bracelet, accessories: w.accessories, cost: w.cost,
    retailPrice: w.retailPrice, wholesalePrice: w.wholesalePrice,
    soldPrice: w.soldPrice, paymentMethod: w.paymentMethod,
    notes: w.notes, sourceName: w.sourceName, sourceType: w.sourceType,
    purchaseDate: w.purchaseDate, stockNum: w.stockNum,
    isConsignment: w.isConsignment, consignorName: w.consignorName,
    photos: {}, serviceLog: w.serviceLog || [], parts: w.parts || [],
    dateAdded: w.dateAdded || new Date().toISOString(),
  }));

  // Import estimates
  await importFile('migrate-estimates', '/estimates', e => ({
    id: e.id || genId(), date: e.date,
    customer: e.customer || { name: e.jobNumber },
    watch: e.watch || { brand: e.brand, model: e.model },
    lineItems: e.lineItems || [],
    optionalItems: e.optionalItems || [],
    subtotal: e.subtotal || 0, taxRate: e.taxRate || 0,
    taxAmt: e.taxAmt || 0, total: e.total || 0,
    notes: e.notes, jobStatus: e.jobStatus || 'Pending Approval',
  }));

  // Import customers
  await importFile('migrate-customers', '/customers', c => ({
    id: c.id || genId(), name: c.name, phone: c.phone, email: c.email,
    address: c.address, birthday: c.birthday, anniversary: c.anniversary,
    notes: c.notes, followupDate: c.followupDate, followupNote: c.followupNote,
    addedAt: c.addedAt || new Date().toISOString(),
  }));

  // Import notebook
  await importFile('migrate-notebook', '/notebook', n => {
    // notebook.json has { notes:[], leads:[], tasks:[], wantList:[] }
    return n; // POST the whole notebook object
  });

  // Import invoices
  const invInput = document.getElementById('migrate-invoices');
  if (invInput?.files?.length) {
    hasAny = true;
    try {
      const text = await invInput.files[0].text();
      const data = JSON.parse(text);
      let count = 0;
      for (const p of (data.purchases || [])) {
        await POST('/invoices/purchases', { id: p.id||genId(), ...p });
        count++;
      }
      for (const inv of (data.outgoing || [])) {
        await POST('/invoices/outgoing', { id: inv.id||genId(), ...inv });
        count++;
      }
      for (const e of (data.expenses || [])) {
        await POST('/invoices/expenses', { id: e.id||genId(), ...e });
        count++;
      }
      results.push(`✓ invoices: ${count} items`);
    } catch(e) {
      results.push(`✗ invoices: ${e.message}`);
    }
  }

  if (!hasAny) {
    statusEl.textContent = 'Please select at least one file to import.';
    statusEl.style.background = 'var(--amber-dim)';
    statusEl.style.color = 'var(--amber)';
    return;
  }

  // Reload all data
  await Promise.all([loadWatches(), loadEstimates(), loadCustomers(), loadNotebook(), loadInvoiceData(), loadAccessories()]);
  renderDashboard();

  statusEl.style.background = 'var(--green-dim)';
  statusEl.style.color = 'var(--green)';
  statusEl.innerHTML = '<strong>Import complete!</strong><br/>' + results.join('<br/>');
}

