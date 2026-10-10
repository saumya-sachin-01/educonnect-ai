import { Router } from 'express';
import { get, run } from '../db.js';
import { hashPassword, verifyPassword, signToken, authRequired, isEmail } from '../auth.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at });

function validateNamePassword(name, password, res) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    return false;
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    res.status(400).json({ error: 'Password must be between 6 and 100 characters.' });
    return false;
  }
  return true;
}

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });
  if (role !== 'student' && role !== 'faculty') {
    return res.status(400).json({ error: 'Registration is available for Student or Faculty accounts only. Admin accounts are created by the administrator.' });
  }
  if (!validateNamePassword(name, password, res)) return;
  const exists = get('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });
  const info = run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    name.trim(), email.toLowerCase().trim(), hashPassword(password), role);
  const user = get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', Number(info.lastInsertRowid));
  res.status(201).json({ token: signToken(user), user: publicUser(user), demo: false });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = get('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ token: signToken(user), user: publicUser(user), demo: false });
});

// DEMO MODE: one-click login for the presentation. Clearly flagged in responses + UI.
router.post('/demo', (req, res) => {
  const role = (req.body || {}).role;
  const demoEmails = {
    admin: 'admin@educonnect.demo',
    faculty: 'ram.sharma@educonnect.demo',
    student: 'aarav.patel@educonnect.demo',
  };
  const email = demoEmails[role];
  if (!email) return res.status(400).json({ error: 'Unknown demo role.' });
  const user = get('SELECT id, name, email, role, created_at FROM users WHERE email = ?', email);
  if (!user) return res.status(503).json({ error: 'Demo data not initialized. Run: npm run seed' });
  res.json({ token: signToken(user), user: publicUser(user), demo: true });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/profile', authRequired, (req, res) => {
  const { name, password, current_password, new_password } = req.body || {};
  const nextPassword = new_password !== undefined ? new_password : password;
  const verifyCurrent = current_password !== undefined;
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    }
    run('UPDATE users SET name = ? WHERE id = ?', name.trim(), req.user.id);
  }
  if (nextPassword) {
    if (verifyCurrent) {
      const row = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
      if (!verifyPassword(String(current_password), row.password_hash)) {
        return res.status(403).json({ error: 'Your current password is incorrect.' });
      }
    }
    if (typeof nextPassword !== 'string' || nextPassword.length < 6 || nextPassword.length > 100) {
      return res.status(400).json({ error: 'New password must be between 6 and 100 characters.' });
    }
    run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(nextPassword), req.user.id);
  }
  const user = get('SELECT id, name, email, role, created_at FROM users WHERE id = ?', req.user.id);
  res.json({ user: publicUser(user) });
});

export default router;
