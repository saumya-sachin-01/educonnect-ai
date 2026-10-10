import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initSchema, isSeeded } from './db.js';
import { seed } from './seed.js';
import { authRequired } from './auth.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import academicRoutes from './routes/academic.js';
import contentRoutes from './routes/content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

initSchema();
if (!isSeeded()) {
  console.log('[demo] Empty database detected — seeding fictional demo data...');
  seed();
  console.log('[demo] Seed complete. Demo credentials: admin@educonnect.demo/admin123, ram.sharma@educonnect.demo/faculty123, priya.nair@educonnect.demo/faculty123, <name>@educonnect.demo/student123');
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, demoMode: true, time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api', authRequired, adminRoutes);
app.use('/api', authRequired, academicRoutes);
app.use('/api', authRequired, contentRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// Serve the built React client (production / demo mode)
const distDir = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
} else {
  app.get('*', (req, res) => res.status(503).send('Client not built yet. Run: npm run build (or use the Vite dev server on port 5173 with the API on port 4000).'));
}

// Central error handler — errors are surfaced, never silently swallowed
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server error]', err.message);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request body.' });
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`EduConnect AI running at http://localhost:${PORT}  (DEMO MODE)`);
});
