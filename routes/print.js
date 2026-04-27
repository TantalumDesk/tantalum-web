const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Get user settings helper
function getSettings(userId) {
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId);
  const s = {};
  for (const row of rows) {
    try { s[row.key] = JSON.parse(row.value); } catch { s[row.key] = row.value; }
  }
  return s;
}

// Print-ready estimate page
router.get('/estimate/:id', (req, res) => {
  const userId = req.session.userId;
  const row = db.prepare('SELECT * FROM estimates WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!row) return res.status(404).send('Estimate not found');

  const est = JSON.parse(row.data || '{}');
  est.id = row.id;
  const s = getSettings(userId);

  const lineItems = (est.lineItems || []).map(l =>
    `<tr><td class="desc">${l.name || ''}</td><td class="amount">$${(parseFloat(l.price)||0).toFixed(2)}</td></tr>`
  ).join('');

  const optItems = (est.optionalItems || []).length > 0 ? `
    <tr class="section-header"><td colspan="2">Optional Services</td></tr>
    ${(est.optionalItems||[]).map(l => `<tr class="optional"><td class="desc">${l.name||''} <em>(optional)</em></td><td class="amount">$${(parseFloat(l.price)||0).toFixed(2)}</td></tr>`).join('')}
  ` : '';

  const taxRow = est.taxAmt > 0 ? `<tr class="subtotal-row"><td>Tax (${est.taxRate || 0}%)</td><td class="amount">$${(est.taxAmt||0).toFixed(2)}</td></tr>` : '';
  const shippingRow = est.shipping > 0 ? `<tr class="subtotal-row"><td>Shipping & Handling</td><td class="amount">$${(est.shipping||0).toFixed(2)}</td></tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Estimate — ${est.customer?.name || 'Customer'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; color: #1a1814; background: #fff; padding: 48px; max-width: 680px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #c9a84c; }
    .store-name { font-size: 22px; font-weight: bold; color: #1a1814; letter-spacing: 0.02em; }
    .store-info { font-size: 12px; color: #5a5652; margin-top: 6px; line-height: 1.6; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 28px; font-weight: 300; color: #c9a84c; letter-spacing: 0.06em; text-transform: uppercase; }
    .doc-title .doc-meta { font-size: 12px; color: #5a5652; margin-top: 6px; line-height: 1.6; }
    .section { margin-bottom: 28px; }
    .section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #9a9690; font-weight: bold; margin-bottom: 8px; }
    .customer-name { font-size: 16px; font-weight: bold; }
    .customer-info { font-size: 13px; color: #5a5652; line-height: 1.6; margin-top: 4px; }
    .watch-box { background: #f8f6f2; border-left: 3px solid #c9a84c; padding: 12px 16px; border-radius: 0 4px 4px 0; }
    .watch-brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a9690; font-weight: bold; }
    .watch-model { font-size: 16px; font-weight: bold; margin-top: 2px; }
    .watch-details { font-size: 12px; color: #5a5652; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a9690; padding: 0 0 10px; text-align: left; border-bottom: 1px solid #e8e5e0; }
    th.amount, td.amount { text-align: right; }
    td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f0ede8; vertical-align: top; }
    td.desc { padding-right: 20px; }
    tr.optional td { color: #9a9690; font-style: italic; }
    tr.section-header td { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #c9a84c; padding-top: 16px; border-bottom: none; font-style: normal; }
    tr.subtotal-row td { border-bottom: none; color: #5a5652; font-size: 13px; padding: 6px 0; }
    .total-row td { border-top: 2px solid #c9a84c; border-bottom: none; font-weight: bold; font-size: 18px; padding-top: 12px; color: #1a1814; }
    .notes { font-size: 13px; color: #5a5652; line-height: 1.6; padding: 16px; background: #f8f6f2; border-radius: 4px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e8e5e0; font-size: 11px; color: #9a9690; text-align: center; line-height: 1.6; }
    .expiry { font-size: 12px; color: #9a9690; margin-top: 8px; }
    @media print {
      body { padding: 20px; }
      @page { margin: 0.75in; }
    }
    .print-btn { position: fixed; top: 16px; right: 16px; background: #c9a84c; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; cursor: pointer; font-family: sans-serif; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>

  <div class="header">
    <div>
      <div class="store-name">${escHtml(s.storeName || 'Your Store Name')}</div>
      <div class="store-info">
        ${s.storeAddress ? escHtml(s.storeAddress) + '<br/>' : ''}
        ${s.storePhone ? escHtml(s.storePhone) : ''}${s.storeEmail ? ' &nbsp;·&nbsp; ' + escHtml(s.storeEmail) : ''}
      </div>
    </div>
    <div class="doc-title">
      <h1>Estimate</h1>
      <div class="doc-meta">
        Date: ${escHtml(est.date || '')}<br/>
        ${est.expiryDate ? 'Expires: ' + escHtml(est.expiryDate) + '<br/>' : ''}
        Job Status: ${escHtml(est.jobStatus || 'Pending Approval')}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px">
    <div class="section">
      <div class="section-label">Prepared For</div>
      <div class="customer-name">${escHtml(est.customer?.name || '')}</div>
      <div class="customer-info">
        ${est.customer?.phone ? escHtml(est.customer.phone) + '<br/>' : ''}
        ${est.customer?.email ? escHtml(est.customer.email) : ''}
      </div>
    </div>
    <div class="section">
      <div class="section-label">Watch</div>
      <div class="watch-box">
        <div class="watch-brand">${escHtml(est.watch?.brand || '')}</div>
        <div class="watch-model">${escHtml(est.watch?.model || '')}</div>
        <div class="watch-details">${est.watch?.serial ? 'Serial: ' + escHtml(est.watch.serial) : ''}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <table>
      <thead><tr><th>Service</th><th class="amount">Price</th></tr></thead>
      <tbody>
        ${lineItems}
        ${optItems}
        ${shippingRow}
        ${taxRow}
        <tr class="total-row"><td>Total</td><td class="amount">$${(est.total||0).toFixed(2)}</td></tr>
      </tbody>
    </table>
  </div>

  ${est.notes ? `<div class="section"><div class="section-label">Notes</div><div class="notes">${escHtml(est.notes)}</div></div>` : ''}

  <div class="footer">
    ${s.storeName ? escHtml(s.storeName) + ' &nbsp;·&nbsp; ' : ''}
    This estimate is valid for ${s.estimateExpiryDays || 30} days from the date above.<br/>
    Thank you for your business.
  </div>
</body>
</html>`;

  res.send(html);
});

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Send estimate email
router.post('/estimate/:id/email', async (req, res) => {
  const userId = req.session.userId;
  const row = db.prepare('SELECT * FROM estimates WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!row) return res.status(404).json({ error: 'Estimate not found' });

  const est = JSON.parse(row.data || '{}');
  est.id = row.id;
  const s = getSettings(userId);

  // Build mailto link data
  const subject = `Estimate from ${s.storeName || 'Your Store'} — ${est.watch?.brand || ''} ${est.watch?.model || ''}`.trim();
  const lineList = (est.lineItems||[]).map(l => `  • ${l.name}: $${(parseFloat(l.price)||0).toFixed(2)}`).join('\n');
  const optList = (est.optionalItems||[]).length > 0 ? `\nOptional Services:\n${(est.optionalItems||[]).map(l => `  • ${l.name}: $${(parseFloat(l.price)||0).toFixed(2)}`).join('\n')}` : '';

  const body = `Dear ${est.customer?.name || 'Valued Customer'},

Thank you for bringing in your ${est.watch?.brand || ''} ${est.watch?.model || ''} for service.

Please find your estimate below:

${lineList}${optList}

Total: $${(est.total||0).toFixed(2)}

${est.notes ? 'Notes: ' + est.notes + '\n\n' : ''}This estimate is valid for ${s.estimateExpiryDays || 30} days.

To view and print a full PDF version of your estimate, please visit:
${req.protocol}://${req.get('host')}/api/print/estimate/${est.id}

Please reply to this email or call us to approve the work.

Best regards,
${s.storeName || 'Your Store'}
${s.storePhone || ''}
${s.storeEmail || ''}`.trim();

  res.json({
    success: true,
    mailto: `mailto:${encodeURIComponent(est.customer?.email||'')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    subject,
    to: est.customer?.email || '',
    printUrl: `/api/print/estimate/${est.id}`
  });
});

module.exports = router;

// SMTP email sending
router.post('/estimate/:id/send', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const userId = req.session.userId;
    const row = db.prepare('SELECT * FROM estimates WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!row) return res.status(404).json({ error: 'Estimate not found' });

    const est = JSON.parse(row.data || '{}');
    est.id = row.id;
    const s = getSettings(userId);

    if (!s.smtpEmail || !s.smtpPassword) {
      return res.status(400).json({ error: 'Email not configured. Please add your Gmail credentials in Settings.' });
    }
    if (!est.customer?.email) {
      return res.status(400).json({ error: 'No email address on file for this customer.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: s.smtpEmail, pass: s.smtpPassword }
    });

    const subject = `Estimate from ${s.storeName || 'Your Store'} — ${est.watch?.brand || ''} ${est.watch?.model || ''}`.trim();
    const lineList = (est.lineItems||[]).map(l => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escHtml(l.name||'')}</td><td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">$${(parseFloat(l.price)||0).toFixed(2)}</td></tr>`).join('');
    const printUrl = `${req.protocol}://${req.get('host')}/api/print/estimate/${est.id}`;

    const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1814">
      <div style="border-bottom:2px solid #c9a84c;padding-bottom:20px;margin-bottom:24px">
        <h2 style="font-size:24px;font-weight:300;color:#c9a84c;margin:0 0 4px">Estimate</h2>
        <div style="font-size:18px;font-weight:bold">${escHtml(s.storeName||'')}</div>
        <div style="font-size:13px;color:#5a5652">${s.storePhone||''} ${s.storeEmail ? '· ' + s.storeEmail : ''}</div>
      </div>
      <p>Dear ${escHtml(est.customer?.name || 'Valued Customer')},</p>
      <p style="margin-top:12px">Thank you for bringing in your <strong>${escHtml(est.watch?.brand||'')} ${escHtml(est.watch?.model||'')}</strong> for service.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <thead><tr><th style="text-align:left;padding:0 0 8px;border-bottom:1px solid #c9a84c;font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Service</th><th style="text-align:right;padding:0 0 8px;border-bottom:1px solid #c9a84c;font-size:11px;text-transform:uppercase;letter-spacing:0.08em">Price</th></tr></thead>
        <tbody>${lineList}<tr><td style="padding:12px 0;font-weight:bold;font-size:16px">Total</td><td style="text-align:right;padding:12px 0;font-weight:bold;font-size:16px;color:#c9a84c">$${(est.total||0).toFixed(2)}</td></tr></tbody>
      </table>
      ${est.notes ? `<p style="background:#f8f6f2;padding:12px;border-radius:4px;font-size:13px;color:#5a5652">${escHtml(est.notes)}</p>` : ''}
      <p style="margin-top:20px"><a href="${printUrl}" style="background:#c9a84c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-family:sans-serif;font-size:14px">View Full PDF Estimate</a></p>
      <p style="margin-top:24px;font-size:13px;color:#9a9690">This estimate is valid for ${s.estimateExpiryDays||30} days. Please reply to approve the work.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#9a9690">${escHtml(s.storeName||'')} · ${escHtml(s.storePhone||'')} · ${escHtml(s.storeEmail||'')}</p>
    </div>`;

    await transporter.sendMail({
      from: `"${s.smtpName || s.storeName || 'Watch Service'}" <${s.smtpEmail}>`,
      to: est.customer.email,
      subject,
      html,
    });

    res.json({ success: true, message: `Email sent to ${est.customer.email}` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
