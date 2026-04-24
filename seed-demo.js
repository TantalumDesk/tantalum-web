// Demo data seeder — runs on startup if demo user has no data
const { db } = require('./db');
const bcrypt = require('bcryptjs');

function gid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function dateStr(n) {
  return new Date(Date.now() - n * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysFwd(n) {
  return new Date(Date.now() + n * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function seedDemoData(userId) {
  const save = (table, id, data) =>
    db(table).insert({ id, user_id: userId, data: JSON.stringify(data), created_at: new Date().toISOString() })
      .onConflict('id').merge();

  // ── Watches ───────────────────────────────────────────────────────────────
  const w1 = gid(), w2 = gid(), w3 = gid(), w4 = gid(), w5 = gid();
  const watches = [
    { id: w1, brand: 'Rolex', model: 'GMT-Master II', ref: '116710LN', serial: '7K123456', condition: 'Excellent', dialColor: 'Black', bracelet: 'Oyster', accessories: 'Box & Papers', cost: 8500, retailPrice: 12500, wholesalePrice: 10500, status: 'In Stock', notes: 'Full set. Purchased from private collector. No signs of polishing.', sourceType: 'Private Sale', sourceName: 'James Whitfield', purchaseDate: dateStr(45), stockNum: 'TW2001', dateAdded: daysAgo(45) },
    { id: w2, brand: 'Omega', model: 'Speedmaster', ref: '311.30.42.30.01.005', serial: '82345678', condition: 'Very Good', dialColor: 'Black', bracelet: 'Bracelet', accessories: 'Box Only', cost: 3200, retailPrice: 4800, wholesalePrice: 4000, status: 'Listed', notes: 'Moonwatch professional. Hesalite crystal.', sourceType: 'Dealer', sourceName: 'Atlantic Watch Dealers', purchaseDate: dateStr(60), stockNum: 'TW2002', dateAdded: daysAgo(60) },
    { id: w3, brand: 'Tudor', model: 'Black Bay', ref: '79230B', serial: 'T94512', condition: 'Mint', dialColor: 'Black', bracelet: 'Leather', accessories: 'Box & Papers', cost: 2100, retailPrice: 3200, wholesalePrice: 2800, status: 'In Stock', notes: 'Unworn. Still has stickers.', sourceType: 'Dealer', sourceName: 'Crown Jewelers', purchaseDate: dateStr(15), stockNum: 'TW2003', dateAdded: daysAgo(15) },
    { id: w4, brand: 'Rolex', model: 'Datejust', ref: '126234', serial: '3T456789', condition: 'Good', dialColor: 'Silver', bracelet: 'Jubilee', accessories: 'Papers Only', cost: 6200, retailPrice: 8900, soldPrice: 8750, paymentMethod: 'wire', status: 'Sold', notes: '36mm stainless. Fluted bezel. Sold to repeat customer.', sourceType: 'Private Sale', sourceName: 'Estate of R. Moore', purchaseDate: dateStr(90), stockNum: 'TW2004', dateAdded: daysAgo(90) },
    { id: w5, brand: 'Breitling', model: 'Navitimer', ref: 'AB0127211B1A1', serial: 'BT12345', condition: 'Very Good', dialColor: 'Black', bracelet: 'Bracelet', accessories: 'Box & Papers', cost: 4500, retailPrice: 6500, wholesalePrice: 5800, status: 'In Stock', notes: 'B01 Chronograph. 43mm. Full set.', sourceType: 'Watch Show', sourceName: 'Nashville Watch Show', purchaseDate: dateStr(30), stockNum: 'TW2005', dateAdded: daysAgo(30) },
  ];
  for (const w of watches) { const { id, ...d } = w; await save('watches', id, d); }

  // ── Customers ─────────────────────────────────────────────────────────────
  const c1 = gid(), c2 = gid(), c3 = gid(), c4 = gid(), c5 = gid();
  const customers = [
    { id: c1, name: 'Michael Chen', phone: '(555) 234-5678', email: 'michael.chen@email.com', address: '445 King St, Charleston, SC', birthday: 'March 15', notes: 'Rolex collector. Prefers wire transfer. Has 3 Rolex pieces.', followupDate: daysFwd(5), followupNote: 'Follow up on Submariner service quote', addedAt: daysAgo(120) },
    { id: c2, name: 'Sarah Johnson', phone: '(555) 345-6789', email: 'sarah.johnson@email.com', address: '789 Meeting St, Charleston, SC', birthday: 'June 22', notes: 'Inherited watch collection from father. Looking to sell several pieces.', addedAt: daysAgo(60) },
    { id: c3, name: 'Robert Kim', phone: '(555) 456-7890', email: 'robert.kim@email.com', address: '12 Broad St, Charleston, SC', birthday: 'November 8', notes: 'Repeat customer. Brings in 2-3 watches per year for service.', addedAt: daysAgo(200) },
    { id: c4, name: 'Patricia Wells', phone: '(555) 567-8901', email: 'patricia.wells@email.com', address: '56 Calhoun St, Charleston, SC', birthday: 'September 3', notes: 'Interested in estate watch appraisals.', addedAt: daysAgo(30) },
    { id: c5, name: 'David Thornton', phone: '(555) 678-9012', email: 'david.thornton@email.com', address: '234 East Bay St, Charleston, SC', birthday: 'January 19', notes: 'Watch dealer. Good source for estate pieces.', addedAt: daysAgo(365) },
  ];
  for (const c of customers) { const { id, ...d } = c; await save('customers', id, d); }

  // ── Estimates ─────────────────────────────────────────────────────────────
  const estimates = [
    { id: gid(), date: dateStr(3), customer: { name: 'Michael Chen', phone: '(555) 234-5678', email: 'michael.chen@email.com' }, watch: { brand: 'Rolex', model: 'Submariner', serial: 'A123456' }, lineItems: [{ name: 'Complete Service & Overhaul', price: 450 }, { name: 'Crystal Replacement', price: 85 }, { name: 'Pressure Test', price: 35 }], optionalItems: [{ name: 'Case & Bracelet Polish', price: 95 }], subtotal: 570, shipping: 0, taxRate: 9, taxAmt: 51.30, total: 621.30, notes: 'Customer reports watch running slow. Crystal has hairline crack.', jobStatus: 'Pending Approval' },
    { id: gid(), date: dateStr(8), customer: { name: 'Sarah Johnson', phone: '(555) 345-6789', email: 'sarah.johnson@email.com' }, watch: { brand: 'Breitling', model: 'Super Ocean Heritage', serial: 'BT98765' }, lineItems: [{ name: 'Complete Service & Overhaul', price: 550 }, { name: 'Crown & Stem Replacement', price: 120 }, { name: 'Pressure Test', price: 35 }], optionalItems: [], subtotal: 705, shipping: 75, taxRate: 9, taxAmt: 63.45, total: 843.45, notes: 'Watch stopped running intermittently. Crown feels loose.', jobStatus: 'Approved', approved: true, approvedDate: dateStr(5) },
    { id: gid(), date: dateStr(25), customer: { name: 'Robert Kim', phone: '(555) 456-7890', email: 'robert.kim@email.com' }, watch: { brand: 'Tissot', model: 'PR516', serial: 'T12345' }, lineItems: [{ name: 'Battery Replacement', price: 25 }, { name: 'Pressure Test', price: 35 }], optionalItems: [], subtotal: 60, shipping: 0, taxRate: 9, taxAmt: 5.40, total: 65.40, notes: 'Quartz movement. Just needs battery and pressure check.', jobStatus: 'Completed', approved: true },
    { id: gid(), date: dateStr(28), customer: { name: 'Patricia Wells', phone: '(555) 567-8901', email: 'patricia.wells@email.com' }, watch: { brand: 'Omega', model: 'Constellation', serial: '52987654' }, lineItems: [{ name: 'Complete Service & Overhaul', price: 380 }, { name: 'Mainspring Replacement', price: 95 }], optionalItems: [{ name: 'Case & Bracelet Polish', price: 95 }], subtotal: 475, shipping: 0, taxRate: 9, taxAmt: 42.75, total: 517.75, notes: 'Ladies Constellation. Full service recommended.', jobStatus: 'Pending Approval' },
  ];
  for (const e of estimates) { const { id, ...d } = e; await save('estimates', id, d); }

  // ── Notebook ──────────────────────────────────────────────────────────────
  const notebookItems = [
    { id: gid(), type: 'note', title: 'Rolex Market Update', content: 'GMT-Master II prices holding steady. Submariner demand up slightly heading into summer. Black dials commanding premium over other variants.', createdAt: daysAgo(5) },
    { id: gid(), type: 'note', title: 'Service Pricing Notes', content: 'Rolex factory service now running $1,200-$1,800. Our in-house service is a compelling alternative at $450-$600 with comparable quality. Emphasize 1-year warranty.', createdAt: daysAgo(14) },
    { id: gid(), type: 'lead', name: 'Tom Bradford', phone: '(555) 789-0123', looking: 'Rolex Submariner 116610LN, budget $10k-$12k', source: 'Referral', notes: 'Serious buyer. Called twice this month.', createdAt: daysAgo(7) },
    { id: gid(), type: 'lead', name: 'Angela Torres', phone: '(555) 890-1234', looking: 'Omega Speedmaster for husband\'s birthday', source: 'Instagram', notes: 'Birthday is in 3 weeks. Has $4,500 budget.', createdAt: daysAgo(2) },
    { id: gid(), type: 'task', title: 'Order mainspring for Breitling job', done: false, createdAt: daysAgo(3) },
    { id: gid(), type: 'task', title: 'Call Michael Chen re: Rolex estimate approval', done: false, createdAt: daysAgo(1) },
    { id: gid(), type: 'task', title: 'Update eBay listings with new photos', done: true, createdAt: daysAgo(10) },
  ];
  for (const n of notebookItems) { const { id, ...d } = n; await save('notebook_items', id, d); }

  // Want list
  const wl = [{ id: gid(), brand: 'Rolex', model: 'Daytona', ref: '116500LN', maxBudget: 18000, notes: 'White or black dial. Full set preferred.', addedAt: daysAgo(20) }];
  for (const w of wl) { const { id, ...d } = w; await save('want_list', id, d); }

  // ── Purchases ─────────────────────────────────────────────────────────────
  const purchases = [
    { id: gid(), watchDesc: 'Rolex GMT-Master II 116710LN — TW2001', dealerName: 'James Whitfield', date: dateStr(45), amount: 8500, type: 'private', paymentMethod: 'wire', status: 'complete', linkedWatchId: w1, autoCreated: true, createdAt: daysAgo(45) },
    { id: gid(), watchDesc: 'Omega Speedmaster 311.30.42.30 — TW2002', dealerName: 'Atlantic Watch Dealers', date: dateStr(60), amount: 3200, type: 'dealer', paymentMethod: 'check', status: 'complete', linkedWatchId: w2, autoCreated: true, createdAt: daysAgo(60) },
    { id: gid(), watchDesc: 'Tudor Black Bay 79230B — TW2003', dealerName: 'Crown Jewelers', date: dateStr(15), amount: 2100, type: 'dealer', paymentMethod: 'wire', status: 'complete', linkedWatchId: w3, autoCreated: true, createdAt: daysAgo(15) },
  ];
  for (const p of purchases) { const { id, ...d } = p; await save('purchases', id, d); }

  // ── Outgoing Invoice ──────────────────────────────────────────────────────
  const inv = { id: gid(), number: 1101, date: dateStr(30), toName: 'Robert Kim', toEmail: 'robert.kim@email.com', toPhone: '(555) 456-7890', toAddress: '12 Broad St, Charleston, SC', lines: [{ desc: 'Rolex Datejust 126234 — TW2004', qty: 1, price: 8750 }], subtotal: 8750, taxRate: 0, taxAmt: 0, total: 8750, notes: 'Payment due upon receipt. Thank you for your business.', status: 'paid', createdAt: daysAgo(30) };
  await save('outgoing_invoices', inv.id, inv);
  await db('invoice_counter').insert({ user_id: userId, next_number: 1102 }).onConflict('user_id').merge();

  // ── Expenses ──────────────────────────────────────────────────────────────
  const expenses = [
    { id: gid(), date: dateStr(5), amount: 124.50, category: 'supplies', payment: 'card', description: 'Watch cleaning solutions and oils', vendor: 'Cousins UK', createdAt: daysAgo(5) },
    { id: gid(), date: dateStr(12), amount: 45.00, category: 'shipping', payment: 'card', description: 'FedEx overnight — estimate return shipments', vendor: 'FedEx', createdAt: daysAgo(12) },
    { id: gid(), date: dateStr(20), amount: 299.00, category: 'fees', payment: 'card', description: 'eBay selling fees — March', vendor: 'eBay', createdAt: daysAgo(20) },
  ];
  for (const e of expenses) { const { id, ...d } = e; await save('expenses', id, d); }

  // ── Settings ──────────────────────────────────────────────────────────────
  const demoSettings = {
    storeName: 'Demo Watch Co', storePhone: '(555) 867-5309',
    storeEmail: 'service@demowatchco.com', storeAddress: '123 Main Street, Charleston, SC 29401',
    taxRate: 9, lastStockNum: 2005, theme: 'dark',
    estimateExpiryDays: 30, expiryAlertsEnabled: true,
    followupRemindersEnabled: true, birthdayRemindersEnabled: true,
    brands: ['Rolex','Tudor','Omega','Breitling','TAG Heuer','IWC','Panerai','Cartier','Patek Philippe','Audemars Piguet','Seiko','Grand Seiko'],
    models: ['Submariner','Datejust','Day-Date','GMT-Master II','Explorer','Daytona','Black Bay','Speedmaster','Seamaster','Navitimer'],
    conditions: ['Mint','Excellent','Very Good','Good','Fair','Parts/Repair'],
    services: [
      { name: 'Complete Service & Overhaul', price: 450 },
      { name: 'Battery Replacement', price: 25 },
      { name: 'Crystal Replacement', price: 85 },
      { name: 'Crown & Stem Replacement', price: 120 },
      { name: 'Pressure Test', price: 35 },
      { name: 'Bracelet Service & Polish', price: 65 },
    ],
    statuses: ['In Stock','Listed','Sold'],
    dialColors: ['Black','White','Silver','Blue','Green','Grey','Champagne'],
    braceletTypes: ['Oyster','Jubilee','President','Leather','Rubber','NATO'],
  };
  for (const [key, value] of Object.entries(demoSettings)) {
    await db('settings').insert({ user_id: userId, key, value: JSON.stringify(value) })
      .onConflict(['user_id','key']).merge();
  }

  console.log('Demo data seeded successfully');
}

async function ensureDemoUser() {
  const DEMO_USER = process.env.DEMO_USERNAME || 'demo';
  const DEMO_PASS = process.env.DEMO_PASSWORD || 'tantalum-demo';

  let user = await db('users').where({ username: DEMO_USER }).first();
  if (!user) {
    const hash = bcrypt.hashSync(DEMO_PASS, 10);
    const [id] = await db('users').insert({ username: DEMO_USER, password_hash: hash }).returning('id');
    user = { id: id.id || id };
    console.log('Created demo user:', DEMO_USER);
  }

  // Check if demo user already has data
  const existing = await db('watches').where({ user_id: user.id }).first();
  if (!existing) {
    console.log('Seeding demo data...');
    await seedDemoData(user.id);
  } else {
    console.log('Demo data already exists, skipping seed');
  }
}

module.exports = { ensureDemoUser };
