const express = require('express');
const path = require('path');
const fs = require('fs');

module.exports = function(upload, UPLOADS_DIR) {
  const router = express.Router();

  // Upload any file (photo or PDF)
  router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      url: `/api/uploads/${req.file.filename}`
    });
  });

  // Serve uploaded files
  router.get('/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });

  // Delete a file
  router.delete('/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  });

  return router;
};
