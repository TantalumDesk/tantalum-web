const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, init, ensureAdminUser } = require('./db');
const { ensureDemoUser } = require('./seed-demo');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File uploads to /tmp (works on Railway)
const UPLOADS_DIR = '/tmp/tantalum-uploads';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Simple memory session store (works without extra packages)
app.use(session({
  secret: process.env.SESSION_SECRET || 'tantalum-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// Auth
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db('users').where({ username }).first();
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true });
  } catch(e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.session.userId, username: req.session.username });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch(e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

app.use(requireAuth);

app.use('/api/settings',    require('./routes/settings'));
app.use('/api/watches',     require('./routes/watches'));
app.use('/api/accessories', require('./routes/accessories'));
app.use('/api/estimates',   require('./routes/estimates'));
app.use('/api/customers',   require('./routes/customers'));
app.use('/api/jobs',        require('./routes/jobs'));
app.use('/api/notebook',    require('./routes/notebook'));
app.use('/api/invoices',    require('./routes/invoices'));
app.use('/api/uploads',     require('./routes/uploads')(upload, UPLOADS_DIR));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'tantalum2024';

init()
  .then(() => ensureAdminUser(ADMIN_USER, ADMIN_PASS))
  .then(() => ensureDemoUser())
  .then(() => {
    app.listen(PORT, () => console.log(`Tantalum running on port ${PORT}`));
  })
  .catch(e => {
    console.error('Startup error:', e.message);
    process.exit(1);
  });
