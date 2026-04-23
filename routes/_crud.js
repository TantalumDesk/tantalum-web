const express = require('express');
const { db } = require('../db');

module.exports = function(table, sortField = 'created_at') {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const rows = await db(table).where({ user_id: req.session.userId }).orderBy(sortField, 'desc');
      res.json(rows.map(r => { const d = JSON.parse(r.data || '{}'); d.id = r.id; return d; }));
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/', async (req, res) => {
    try {
      const item = req.body;
      const { id, ...data } = item;
      await db(table).insert({ id, user_id: req.session.userId, data: JSON.stringify(data), created_at: data.createdAt || data.dateAdded || new Date().toISOString() })
        .onConflict('id').merge();
      res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await db(table).where({ id: req.params.id, user_id: req.session.userId }).delete();
      res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};
