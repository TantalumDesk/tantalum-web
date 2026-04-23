const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Purchases
router.get('/purchases', async (req, res) => {
  try {
    const rows = await db('purchases').where({ user_id: req.session.userId }).orderBy('created_at','desc');
    res.json(rows.map(r => { const d = JSON.parse(r.data||'{}'); d.id=r.id; return d; }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/purchases', async (req, res) => {
  try {
    const { id, ...data } = req.body;
    await db('purchases').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt||new Date().toISOString() }).onConflict('id').merge();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/purchases/:id', async (req, res) => {
  try { await db('purchases').where({ id: req.params.id, user_id: req.session.userId }).delete(); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// Outgoing invoices
router.get('/outgoing', async (req, res) => {
  try {
    const rows = await db('outgoing_invoices').where({ user_id: req.session.userId }).orderBy('created_at','desc');
    const counter = await db('invoice_counter').where({ user_id: req.session.userId }).first();
    res.json({ items: rows.map(r => { const d = JSON.parse(r.data||'{}'); d.id=r.id; return d; }), nextNumber: counter?.next_number || 1101 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/outgoing', async (req, res) => {
  try {
    const { id, nextNumber, ...data } = req.body;
    await db('outgoing_invoices').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt||new Date().toISOString() }).onConflict('id').merge();
    await db('invoice_counter').insert({ user_id: req.session.userId, next_number: nextNumber||1101 }).onConflict('user_id').merge();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Expenses
router.get('/expenses', async (req, res) => {
  try {
    const rows = await db('expenses').where({ user_id: req.session.userId }).orderBy('created_at','desc');
    res.json(rows.map(r => { const d = JSON.parse(r.data||'{}'); d.id=r.id; return d; }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/expenses', async (req, res) => {
  try {
    const { id, ...data } = req.body;
    await db('expenses').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt||new Date().toISOString() }).onConflict('id').merge();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/expenses/:id', async (req, res) => {
  try { await db('expenses').where({ id: req.params.id, user_id: req.session.userId }).delete(); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// Appraisals
router.get('/appraisals', async (req, res) => {
  try {
    const rows = await db('appraisals').where({ user_id: req.session.userId }).orderBy('created_at','desc');
    res.json(rows.map(r => { const d = JSON.parse(r.data||'{}'); d.id=r.id; return d; }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/appraisals', async (req, res) => {
  try {
    const { id, ...data } = req.body;
    await db('appraisals').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt||new Date().toISOString() }).onConflict('id').merge();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Dealers
router.get('/dealers', async (req, res) => {
  try {
    const rows = await db('dealers').where({ user_id: req.session.userId }).orderBy('created_at','desc');
    res.json(rows.map(r => { const d = JSON.parse(r.data||'{}'); d.id=r.id; return d; }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.post('/dealers', async (req, res) => {
  try {
    const { id, ...data } = req.body;
    await db('dealers').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt||new Date().toISOString() }).onConflict('id').merge();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
router.delete('/dealers/:id', async (req, res) => {
  try { await db('dealers').where({ id: req.params.id, user_id: req.session.userId }).delete(); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
