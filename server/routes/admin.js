import { Router } from 'express';
import { all, get, run, logActivity } from '../db.js';
import { requireRole, hashPassword, isEmail } from '../auth.js';

const router = Router();
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* ---------------- USERS (admin) ---------------- */

router.get('/users', requireRole('admin'), (req, res) => {
  const { role } = req.query;
  const valid = ['student', 'faculty', 'admin'];
  const rows = valid.includes(role)
    ? all('SELECT id, name, email, role, created_at FROM users WHERE role = ? ORDER BY name', role)
    : all('SELECT id, name, email, role, created_at FROM users ORDER BY role, name');
  res.json({ users: rows });
});

router.post('/users', requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!['student', 'faculty', 'admin'].includes(role)) return bad(res, 'Role must be student, faculty or admin.');
  if (!isEmail(email)) return bad(res, 'Please provide a valid email address.');
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return bad(res, 'Name must be between 2 and 80 characters.');
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) return bad(res, 'Password must be between 6 and 100 characters.');
  if (get('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim())) return bad(res, 'An account with this email already exists.', 409);
  const info = run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    name.trim(), email.toLowerCase().trim(), hashPassword(password), role);
  logActivity(req.user.id, 'user.created', `Created ${role} account for ${name.trim()}`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.delete('/users/:id', requireRole('admin'), (req, res) => {
  const target = get('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!target) return bad(res, 'User not found.', 404);
  if (target.id === req.user.id) return bad(res, 'You cannot delete your own account.', 400);
  if (target.role === 'admin') return bad(res, 'Admin accounts cannot be deleted through the panel.', 400);
  run('DELETE FROM users WHERE id = ?', target.id);
  logActivity(req.user.id, 'user.deleted', `Deleted ${target.role} ${target.name}`);
  res.json({ ok: true });
});

/* ---------------- SUBJECTS (admin) ---------------- */

router.get('/subjects', (req, res) => {
  res.json({ subjects: all('SELECT * FROM subjects ORDER BY code') });
});

router.post('/subjects', requireRole('admin'), (req, res) => {
  const { name, code } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return bad(res, 'Subject name is required.');
  if (typeof code !== 'string' || !code.trim() || code.trim().length > 20) return bad(res, 'Subject code is required (max 20 characters).');
  if (get('SELECT id FROM subjects WHERE code = ?', code.trim().toUpperCase())) return bad(res, 'This subject code already exists.', 409);
  const info = run('INSERT INTO subjects (name, code) VALUES (?,?)', name.trim().slice(0, 100), code.trim().toUpperCase());
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.put('/subjects/:id', requireRole('admin'), (req, res) => {
  const s = get('SELECT * FROM subjects WHERE id = ?', req.params.id);
  if (!s) return bad(res, 'Subject not found.', 404);
  const { name, code } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return bad(res, 'Subject name is required.');
  if (typeof code !== 'string' || !code.trim() || code.trim().length > 20) return bad(res, 'Subject code is required (max 20 characters).');
  const clash = get('SELECT id FROM subjects WHERE code = ? AND id != ?', code.trim().toUpperCase(), s.id);
  if (clash) return bad(res, 'This subject code already exists.', 409);
  run('UPDATE subjects SET name = ?, code = ? WHERE id = ?', name.trim().slice(0, 100), code.trim().toUpperCase(), s.id);
  res.json({ ok: true });
});

router.delete('/subjects/:id', requireRole('admin'), (req, res) => {
  const s = get('SELECT * FROM subjects WHERE id = ?', req.params.id);
  if (!s) return bad(res, 'Subject not found.', 404);
  const used = get('SELECT COUNT(*) n FROM courses WHERE subject_id = ?', s.id).n;
  if (used > 0) return bad(res, `Cannot delete: ${used} course(s) use this subject. Delete those courses first.`, 409);
  run('DELETE FROM subjects WHERE id = ?', s.id);
  res.json({ ok: true });
});

/* ---------------- ACTIVITY (admin) ---------------- */

router.get('/activity', requireRole('admin'), (req, res) => {
  const rows = all(`SELECT a.*, u.name AS user_name, u.role FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 100`);
  res.json({ activity: rows });
});

/* ---------------- ENROLLMENT MANAGEMENT (admin) ---------------- */

router.post('/courses/:id/enroll', requireRole('admin'), (req, res) => {
  const course = get('SELECT * FROM courses WHERE id = ?', req.params.id);
  if (!course) return bad(res, 'Course not found.', 404);
  const { student_id } = req.body || {};
  const student = get("SELECT id FROM users WHERE id = ? AND role = 'student'", +student_id);
  if (!student) return bad(res, 'Please choose a valid student.');
  if (get('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?', course.id, +student_id)) {
    return bad(res, 'This student is already enrolled.', 409);
  }
  run('INSERT INTO enrollments (course_id, student_id) VALUES (?,?)', course.id, +student_id);
  res.status(201).json({ ok: true });
});

router.delete('/enrollments/:id', requireRole('admin'), (req, res) => {
  const e = get('SELECT * FROM enrollments WHERE id = ?', req.params.id);
  if (!e) return bad(res, 'Enrollment not found.', 404);
  run('DELETE FROM enrollments WHERE id = ?', e.id);
  res.json({ ok: true });
});

export default router;
