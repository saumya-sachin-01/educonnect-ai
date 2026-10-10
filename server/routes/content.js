import { Router } from 'express';
import { all, get, run, notify, notifyMany, logActivity } from '../db.js';
import { requireRole } from '../auth.js';
import { assistantReply } from '../assistant.js';

const router = Router();
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

const enrolledIds = (studentId) => all('SELECT course_id FROM enrollments WHERE student_id = ?', studentId).map((r) => r.course_id);
const ownedCourseIds = (facultyId) => all('SELECT id FROM courses WHERE faculty_id = ?', facultyId).map((r) => r.id);

/* ---------------- NOTES ---------------- */

router.get('/notes', (req, res) => {
  const { course_id, q } = req.query;
  const courseFilter = Number(course_id) || null;
  const search = typeof q === 'string' && q.trim() ? `%${q.trim().slice(0, 60)}%` : null;
  const base = `SELECT n.*, c.name AS course_name, c.code AS course_code, u.name AS faculty_name
    FROM notes n JOIN courses c ON c.id = n.course_id JOIN users u ON u.id = n.created_by`;
  let rows;
  if (req.user.role === 'student') {
    const ids = enrolledIds(req.user.id);
    if (!ids.length) return res.json({ notes: [] });
    rows = all(`${base} WHERE n.course_id IN (${ids.map(() => '?').join(',')})
      ${courseFilter ? 'AND n.course_id = ?' : ''} ${search ? 'AND (n.title LIKE ? OR n.description LIKE ?)' : ''}
      ORDER BY n.created_at DESC`, ...ids, ...(courseFilter ? [courseFilter] : []), ...(search ? [search, search] : []));
  } else if (req.user.role === 'faculty') {
    rows = all(`${base} WHERE n.created_by = ?
      ${courseFilter ? 'AND n.course_id = ?' : ''} ${search ? 'AND (n.title LIKE ? OR n.description LIKE ?)' : ''}
      ORDER BY n.created_at DESC`, req.user.id, ...(courseFilter ? [courseFilter] : []), ...(search ? [search, search] : []));
  } else {
    rows = all(`${base} ${courseFilter ? 'WHERE n.course_id = ?' : ''} ${search ? (courseFilter ? 'AND' : 'WHERE') + ' (n.title LIKE ? OR n.description LIKE ?)' : ''}
      ORDER BY n.created_at DESC`, ...(courseFilter ? [courseFilter] : []), ...(search ? [search, search] : []));
  }
  res.json({ notes: rows });
});

router.get('/notes/:id', (req, res) => {
  const n = get(`SELECT n.*, c.name AS course_name, c.code AS course_code, u.name AS faculty_name
    FROM notes n JOIN courses c ON c.id = n.course_id JOIN users u ON u.id = n.created_by WHERE n.id = ?`, req.params.id);
  if (!n) return bad(res, 'Note not found.', 404);
  const allowed =
    req.user.role === 'admin' || n.created_by === req.user.id ||
    (req.user.role === 'student' && !!get('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?', n.course_id, req.user.id));
  if (!allowed) return bad(res, 'You do not have access to this note.', 403);
  res.json({ note: n });
});

router.post('/notes', requireRole('faculty'), (req, res) => {
  const { course_id, title, description = '', content } = req.body || {};
  if (!get('SELECT id FROM courses WHERE id = ? AND faculty_id = ?', +course_id, req.user.id)) {
    return bad(res, 'You can only publish notes for your own courses.', 403);
  }
  if (typeof title !== 'string' || !title.trim()) return bad(res, 'Note title is required.');
  if (typeof content !== 'string' || content.trim().length < 10) return bad(res, 'Note content is required (at least 10 characters). Text notes only — PDF upload is not available in this demo.');
  const info = run('INSERT INTO notes (course_id, title, description, content, created_by) VALUES (?,?,?,?,?)',
    +course_id, title.trim().slice(0, 200), String(description).slice(0, 300), content.trim().slice(0, 20000), req.user.id);
  const course = get('SELECT name FROM courses WHERE id = ?', +course_id);
  const students = all('SELECT student_id FROM enrollments WHERE course_id = ?', +course_id).map((r) => r.student_id);
  notifyMany(students, 'note', `New study notes: ${title.trim()}`, `Published in ${course.name}.`, '/student/notes');
  logActivity(req.user.id, 'note.published', `Published notes "${title.trim()}" (${course.name})`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.put('/notes/:id', requireRole('faculty'), (req, res) => {
  const n = get('SELECT * FROM notes WHERE id = ?', req.params.id);
  if (!n) return bad(res, 'Note not found.', 404);
  if (n.created_by !== req.user.id) return bad(res, 'You can only edit your own notes.', 403);
  const { title, description = '', content } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) return bad(res, 'Note title is required.');
  if (typeof content !== 'string' || content.trim().length < 10) return bad(res, 'Note content is required.');
  run('UPDATE notes SET title=?, description=?, content=?, updated_at=datetime(\'now\') WHERE id=?',
    title.trim().slice(0, 200), String(description).slice(0, 300), content.trim().slice(0, 20000), n.id);
  res.json({ ok: true });
});

router.delete('/notes/:id', requireRole('faculty', 'admin'), (req, res) => {
  const n = get('SELECT * FROM notes WHERE id = ?', req.params.id);
  if (!n) return bad(res, 'Note not found.', 404);
  if (req.user.role === 'faculty' && n.created_by !== req.user.id) return bad(res, 'You can only delete your own notes.', 403);
  run('DELETE FROM notes WHERE id = ?', n.id);
  res.json({ ok: true });
});

/* ---------------- DOUBT DISCUSSION ---------------- */

router.get('/questions', (req, res) => {
  const { course_id, q } = req.query;
  const courseFilter = Number(course_id) || null;
  const search = typeof q === 'string' && q.trim() ? `%${q.trim().slice(0, 60)}%` : null;
  const repliesSql = `(SELECT json_group_array(json_object('id', r.id, 'body', r.body, 'created_at', r.created_at, 'author', u.name, 'role', u.role))
    FROM question_replies r JOIN users u ON u.id = r.user_id WHERE r.question_id = q.id) AS replies`;
  const base = `SELECT q.*, c.name AS course_name, c.code AS course_code, u.name AS student_name, ${repliesSql}
    FROM questions q JOIN courses c ON c.id = q.course_id JOIN users u ON u.id = q.student_id`;
  let rows;
  if (req.user.role === 'student') {
    rows = all(`${base} WHERE q.student_id = ?
      ${courseFilter ? 'AND q.course_id = ?' : ''} ${search ? 'AND (q.title LIKE ? OR q.body LIKE ?)' : ''}
      ORDER BY q.created_at DESC`, req.user.id, ...(courseFilter ? [courseFilter] : []), ...(search ? [search, search] : []));
  } else if (req.user.role === 'faculty') {
    const ids = ownedCourseIds(req.user.id);
    if (!ids.length) return res.json({ questions: [] });
    rows = all(`${base} WHERE q.course_id IN (${ids.map(() => '?').join(',')})
      ${courseFilter ? 'AND q.course_id = ?' : ''} ${search ? 'AND (q.title LIKE ? OR q.body LIKE ?)' : ''}
      ORDER BY CASE q.status WHEN 'open' THEN 0 ELSE 1 END, q.created_at DESC`, ...ids, ...(courseFilter ? [courseFilter] : []), ...(search ? [search, search] : []));
  } else {
    rows = all(`${base} ${search ? 'WHERE (q.title LIKE ? OR q.body LIKE ?)' : ''} ORDER BY q.created_at DESC`, ...(search ? [search, search] : []));
  }
  rows = rows.map((r) => ({ ...r, replies: JSON.parse(r.replies || '[]') }));
  res.json({ questions: rows });
});

router.post('/questions', requireRole('student'), (req, res) => {
  const { course_id, title, body } = req.body || {};
  if (!get('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?', +course_id, req.user.id)) {
    return bad(res, 'You can only ask questions in courses you are enrolled in.', 403);
  }
  if (typeof title !== 'string' || !title.trim()) return bad(res, 'Question title is required.');
  if (typeof body !== 'string' || body.trim().length < 10) return bad(res, 'Please describe your question (at least 10 characters).');
  const info = run('INSERT INTO questions (course_id, student_id, title, body) VALUES (?,?,?,?)',
    +course_id, req.user.id, title.trim().slice(0, 200), body.trim().slice(0, 3000));
  const course = get('SELECT c.name, c.faculty_id FROM courses c WHERE c.id = ?', +course_id);
  notify(course.faculty_id, 'question', `New student question in ${course.name}`, `${req.user.name}: "${title.trim()}"`, '/faculty/doubts');
  logActivity(req.user.id, 'question.created', `Asked "${title.trim()}"`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.post('/questions/:id/replies', requireRole('faculty'), (req, res) => {
  const q = get(`SELECT q.*, c.faculty_id, c.name AS course_name FROM questions q
    JOIN courses c ON c.id = q.course_id WHERE q.id = ?`, req.params.id);
  if (!q) return bad(res, 'Question not found.', 404);
  if (q.faculty_id !== req.user.id) return bad(res, 'Only the course faculty can reply to this question.', 403);
  const { body } = req.body || {};
  if (typeof body !== 'string' || body.trim().length < 2) return bad(res, 'Reply cannot be empty.');
  const info = run('INSERT INTO question_replies (question_id, user_id, body) VALUES (?,?,?)', q.id, req.user.id, body.trim().slice(0, 3000));
  if (q.status === 'open') run("UPDATE questions SET status = 'answered' WHERE id = ?", q.id);
  notify(q.student_id, 'reply', 'Your question received a reply', `${req.user.name} replied to "${q.title}".`, '/student/doubts');
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.patch('/questions/:id', requireRole('faculty'), (req, res) => {
  const q = get(`SELECT q.*, c.faculty_id FROM questions q JOIN courses c ON c.id = q.course_id WHERE q.id = ?`, req.params.id);
  if (!q) return bad(res, 'Question not found.', 404);
  if (q.faculty_id !== req.user.id) return bad(res, 'Only the course faculty can update this question.', 403);
  const { status } = req.body || {};
  if (status !== 'open' && status !== 'answered') return bad(res, 'Status must be "open" or "answered".');
  run('UPDATE questions SET status = ? WHERE id = ?', status, q.id);
  res.json({ ok: true });
});

/* ---------------- ANNOUNCEMENTS ---------------- */

router.get('/announcements', (req, res) => {
  const rows = all(`SELECT an.*, c.code AS course_code, u.name AS author_name
    FROM announcements an LEFT JOIN courses c ON c.id = an.course_id
    JOIN users u ON u.id = an.created_by
    WHERE an.course_id IS NULL OR an.created_by = ? OR ? = 'admin'
      OR an.course_id IN (SELECT course_id FROM enrollments WHERE student_id = ?)
      OR an.course_id IN (SELECT id FROM courses WHERE faculty_id = ?)
    ORDER BY an.created_at DESC LIMIT 50`,
    req.user.id, req.user.role, req.user.id, req.user.id);
  res.json({ announcements: rows });
});

router.post('/announcements', requireRole('faculty'), (req, res) => {
  const { title, body, course_id } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) return bad(res, 'Announcement title is required.');
  if (typeof body !== 'string' || !body.trim()) return bad(res, 'Announcement body is required.');
  let cid = null;
  if (course_id) {
    if (!get('SELECT id FROM courses WHERE id = ? AND faculty_id = ?', +course_id, req.user.id)) {
      return bad(res, 'You can only announce to your own courses.', 403);
    }
    cid = +course_id;
  }
  const info = run('INSERT INTO announcements (title, body, course_id, created_by) VALUES (?,?,?,?)',
    title.trim().slice(0, 200), body.trim().slice(0, 3000), cid, req.user.id);
  const targets = cid
    ? all('SELECT student_id FROM enrollments WHERE course_id = ?', cid).map((r) => r.student_id)
    : all("SELECT id FROM users WHERE role = 'student'").map((r) => r.id);
  notifyMany(targets, 'announcement', `Announcement: ${title.trim()}`, body.trim().slice(0, 120), '/student/dashboard');
  logActivity(req.user.id, 'announcement.created', `Posted "${title.trim()}"${cid ? '' : ' (all courses)'}`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.delete('/announcements/:id', requireRole('faculty', 'admin'), (req, res) => {
  const a = get('SELECT * FROM announcements WHERE id = ?', req.params.id);
  if (!a) return bad(res, 'Announcement not found.', 404);
  if (req.user.role === 'faculty' && a.created_by !== req.user.id) return bad(res, 'You can only delete your own announcements.', 403);
  run('DELETE FROM announcements WHERE id = ?', a.id);
  res.json({ ok: true });
});

/* ---------------- NOTIFICATIONS ---------------- */

router.get('/notifications', (req, res) => {
  const rows = all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', req.user.id);
  const unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', req.user.id).n;
  res.json({ notifications: rows, unread });
});

router.post('/notifications/:id/read', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/notifications/read-all', (req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
});

/* ---------------- STUDY ASSISTANT (fallback, local) ---------------- */

router.post('/assistant', (req, res) => {
  const { action, message, text, course_id } = req.body || {};
  if (!['chat', 'summarize', 'questions', 'topics'].includes(action)) {
    return bad(res, 'Unknown assistant action.');
  }
  if ((action === 'summarize' || action === 'questions') && (typeof text !== 'string' || text.trim().length < 20)) {
    return bad(res, 'Please paste at least a few sentences of study material.');
  }
  if (action === 'chat' && (typeof message !== 'string' || !message.trim())) {
    return bad(res, 'Please type a question first.');
  }
  let topics = null;
  if (action === 'topics') {
    // Suggest revision topics from the user's real grades (weakest courses first).
    if (req.user.role === 'student') {
      topics = all(`SELECT c.name AS label,
        'Your average here is ' || COALESCE(ROUND(AVG(g.marks * 100.0 / a.max_marks), 1), 0) || '% — revise the lowest-scoring topics first.' AS why,
        COALESCE(ROUND(AVG(g.marks * 100.0 / a.max_marks), 1), 0) AS pct
        FROM courses c JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
        LEFT JOIN assignments a ON a.course_id = c.id
        LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
        LEFT JOIN grades g ON g.submission_id = s.id
        GROUP BY c.id ORDER BY pct ASC`, req.user.id, req.user.id);
    } else {
      topics = all(`SELECT c.name AS label,
        'Class average is ' || COALESCE(ROUND(AVG(g.marks * 100.0 / a.max_marks), 1), 0) || '% — consider a recap session on the weakest units.' AS why,
        COALESCE(ROUND(AVG(g.marks * 100.0 / a.max_marks), 1), 0) AS pct
        FROM courses c ${course_id ? 'WHERE c.id = ' + Number(course_id) : req.user.role === 'faculty' ? 'WHERE c.faculty_id = ' + Number(req.user.id) : ''}
        LEFT JOIN assignments a ON a.course_id = c.id
        LEFT JOIN submissions s ON s.assignment_id = a.id
        LEFT JOIN grades g ON g.submission_id = s.id
        GROUP BY c.id ORDER BY pct ASC LIMIT 5`);
    }
  }
  res.json(assistantReply({ action, message, text, topics }));
});

export default router;
