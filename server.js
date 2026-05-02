require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const requestedFile = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(requestedFile + '.html')) {
      return res.sendFile(requestedFile + '.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found.' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function initDatabase() {
  try {
    const schemaFile = process.env.DATABASE_URL ? 'schema.sql' : 'schema.sqlite.sql';
    const schemaPath = path.join(__dirname, 'models', schemaFile);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    if (process.env.DATABASE_URL) {
      await pool.query(schema);
    } else {
      // SQLite: execute statements one by one
      const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        try { await pool.query(stmt); } catch (e) { /* ignore duplicate tables */ }
      }
    }
    console.log(`Database initialized (${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'})`);
  } catch (err) {
    console.error('Database initialization error:', err.message);
    console.log('Continuing without DB init — tables may already exist.');
  }
}

async function start() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
