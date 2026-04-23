const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', async (req, res) => {
  try {
    const rows = await db('notebook_items').where({ user_id: req.session.userId });
    const wl = await db('want_list').where({ user_id: req.session.userId });
    const notes = [], leads = [], tasks = [];
    for (const r of rows) {
      const d = JSON.parse(r.data || '{}'); d.id = r.id;
      if (d.type === 'note') notes.push(d);
      else if (d.type === 'lead') leads.push(d);
      else if (d.type === 'task') tasks.push(d);
    }
    res.json({ notes, leads, tasks, wantList: wl.map(r => { const d = JSON.parse(r.data||'{}'); d.id=r.id; return d; }) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { notes=[], leads=[], tasks=[], wantList=[] } = req.body;
    const all = [...notes.map(n=>({...n,type:'note'})), ...leads.map(l=>({...l,type:'lead'})), ...tasks.map(t=>({...t,type:'task'}))];
    for (const item of all) {
      const { id, ...data } = item;
      await db('notebook_items').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt || new Date().toISOString() }).onConflict('id').merge();
    }
    for (const w of wantList) {
      const { id, ...data } = w;
      await db('want_list').insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.addedAt || new Date().toISOString() }).onConflict('id').merge();
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
