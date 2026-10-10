import { Router } from 'express';
import { all, get, run, notify, notifyMany, logActivity } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* ---------------- COURSES ---------------- */

// Role-aware listing: student -> enrolled, faculty -> assigned, admin -> all
router.get('/courses', (req, res) => {
  const base = `
    SELECT c.*, s.name AS subject_name, s.code AS subject_code, u.name AS faculty_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count,
      (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS assignment_count
    FROM courses c
    JOIN subjects s ON s.id = c.subject_id
    JOIN users u ON u.id = c.faculty_id`;
  let rows;
  if (req.user.role === 'student') {
    rows = all(`${base} JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? ORDER BY c.code`, req.user.id);
  } else if (req.user.role === 'faculty') {
    rows = all(`${base} WHERE c.faculty_id = ? ORDER BY c.code`, req.user.id);
  } else {
    rows = all(`${base} ORDER BY c.code`);
  }
  res.json({ courses: rows });
});

router.get('/courses/:id', (req, res) => {
  const c = get(`
    SELECT c.*, s.name AS subject_name, s.code AS subject_code, u.name AS faculty_name
    FROM courses c JOIN subjects s ON s.id = c.subject_id JOIN users u ON u.id = c.faculty_id
    WHERE c.id = ?`, req.params.id);
  if (!c) return bad(res, 'Course not found.', 404);
  const allowed =
    req.user.role === 'admin' ||
    (req.user.role === 'faculty' && c.faculty_id === req.user.id) ||
    (req.user.role === 'student' && !!get('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?', c.id, req.user.id));
  if (!allowed) return bad(res, 'You do not have access to this course.', 403);

  const students = all(`SELECT e.id AS enrollment_id, u.id, u.name, u.email FROM enrollments e JOIN users u ON u.id = e.student_id WHERE e.course_id = ? ORDER BY u.name`, c.id);
  const assignments = all(`SELECT id, title, deadline, max_marks FROM assignments WHERE course_id = ? ORDER BY deadline DESC`, c.id);
  const notes = all(`SELECT id, title, created_at FROM notes WHERE course_id = ? ORDER BY created_at DESC`, c.id);
  res.json({ course: c, students, assignments, notes });
});

router.post('/courses', requireRole('admin'), (req, res) => {
  const { name, code, subject_id, faculty_id, description = '' } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return bad(res, 'Course name is required.');
  if (typeof code !== 'string' || !code.trim()) return bad(res, 'Course code is required.');
  if (!Number.isInteger(+subject_id) || !get('SELECT id FROM subjects WHERE id = ?', +subject_id)) return bad(res, 'Please choose a valid subject.');
  const faculty = get("SELECT id FROM users WHERE id = ? AND role = 'faculty'", +faculty_id);
  if (!faculty) return bad(res, 'Please choose a valid faculty member.');
  if (get('SELECT id FROM courses WHERE code = ?', code.trim())) return bad(res, 'A course with this code already exists.', 409);
  const info = run('INSERT INTO courses (name, code, subject_id, faculty_id, description) VALUES (?,?,?,?,?)',
    name.trim(), code.trim().toUpperCase(), +subject_id, +faculty_id, String(description).slice(0, 500));
  logActivity(req.user.id, 'course.created', `Created course ${code.trim().toUpperCase()} — ${name.trim()}`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.put('/courses/:id', requireRole('admin'), (req, res) => {
  const c = get('SELECT * FROM courses WHERE id = ?', req.params.id);
  if (!c) return bad(res, 'Course not found.', 404);
  const { name, code, subject_id, faculty_id, description = '' } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return bad(res, 'Course name is required.');
  if (typeof code !== 'string' || !code.trim()) return bad(res, 'Course code is required.');
  if (!get('SELECT id FROM subjects WHERE id = ?', +subject_id)) return bad(res, 'Please choose a valid subject.');
  if (!get("SELECT id FROM users WHERE id = ? AND role = 'faculty'", +faculty_id)) return bad(res, 'Please choose a valid faculty member.');
  const clash = get('SELECT id FROM courses WHERE code = ? AND id != ?', code.trim(), c.id);
  if (clash) return bad(res, 'Another course already uses this code.', 409);
  run('UPDATE courses SET name=?, code=?, subject_id=?, faculty_id=?, description=?, updated_at=datetime(\'now\') WHERE id=?',
    name.trim(), code.trim().toUpperCase(), +subject_id, +faculty_id, String(description).slice(0, 500), c.id);
  res.json({ ok: true });
});

router.delete('/courses/:id', requireRole('admin'), (req, res) => {
  const c = get('SELECT id, code FROM courses WHERE id = ?', req.params.id);
  if (!c) return bad(res, 'Course not found.', 404);
  run('DELETE FROM courses WHERE id = ?', c.id);
  logActivity(req.user.id, 'course.deleted', `Deleted course ${c.code}`);
  res.json({ ok: true });
});

/* ---------------- ASSIGNMENTS ---------------- */

const statusSqlStudent = `
  CASE WHEN g.id IS NOT NULL THEN 'graded'
       WHEN s.id IS NOT NULL THEN 'submitted'
       WHEN a.deadline < datetime('now') THEN 'overdue'
       ELSE 'pending' END`;

router.get('/assignments', (req, res) => {
  if (req.user.role === 'student') {
    const rows = all(`
      SELECT a.id, a.title, a.description, a.max_marks, a.deadline, a.created_at,
        c.name AS course_name, c.code AS course_code,
        s.id AS submission_id, s.submitted_at, g.marks, g.feedback, g.graded_at,
        ${statusSqlStudent} AS status
      FROM assignments a
      JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
      LEFT JOIN grades g ON g.submission_id = s.id
      ORDER BY CASE WHEN ${statusSqlStudent} IN ('pending','overdue') THEN 0 ELSE 1 END, a.deadline ASC`,
      req.user.id, req.user.id);
    return res.json({ assignments: rows });
  }
  const where = req.user.role === 'faculty' ? 'WHERE c.faculty_id = ?' : '';
  const param = req.user.role === 'faculty' ? [req.user.id] : [];
  const rows = all(`
    SELECT a.*, c.name AS course_name, c.code AS course_code, u.name AS faculty_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = a.course_id) AS student_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submitted_count,
      (SELECT COUNT(*) FROM grades g JOIN submissions s ON s.id = g.submission_id WHERE s.assignment_id = a.id) AS graded_count,
      ROUND((SELECT AVG(g.marks) FROM grades g JOIN submissions s ON s.id = g.submission_id WHERE s.assignment_id = a.id), 1) AS avg_marks
    FROM assignments a
    JOIN courses c ON c.id = a.course_id
    JOIN users u ON u.id = a.created_by
    ${where}
    ORDER BY a.deadline ASC`, ...param);
  res.json({ assignments: rows });
});

function ownCourse(facultyId, courseId) {
  return get('SELECT id FROM courses WHERE id = ? AND faculty_id = ?', courseId, facultyId);
}

router.post('/assignments', requireRole('faculty'), (req, res) => {
  const { course_id, title, description = '', deadline, max_marks } = req.body || {};
  if (!ownCourse(req.user.id, +course_id)) return bad(res, 'You can only create assignments for your own courses.', 403);
  if (typeof title !== 'string' || !title.trim()) return bad(res, 'Assignment title is required.');
  if (typeof description !== 'string' || !description.trim()) return bad(res, 'Assignment description is required.');
  const marks = Number(max_marks);
  if (!Number.isInteger(marks) || marks < 1 || marks > 1000) return bad(res, 'Maximum marks must be a whole number between 1 and 1000.');
  if (!deadline || Number.isNaN(Date.parse(deadline))) return bad(res, 'Please provide a valid deadline date.');
  if (Date.parse(deadline) < Date.now() - 1000) return bad(res, 'Deadline cannot be in the past.');
  const dl = new Date(deadline).toISOString().replace('T', ' ').slice(0, 19);
  const info = run('INSERT INTO assignments (course_id, title, description, max_marks, deadline, created_by) VALUES (?,?,?,?,?,?)',
    +course_id, title.trim().slice(0, 200), description.trim().slice(0, 5000), marks, dl, req.user.id);
  const course = get('SELECT name FROM courses WHERE id = ?', +course_id);
  const students = all('SELECT student_id FROM enrollments WHERE course_id = ?', +course_id).map((r) => r.student_id);
  notifyMany(students, 'assignment', `New assignment: ${title.trim()}`,
    `Posted in ${course.name}. Due ${dl.slice(0, 10)} — ${marks} marks.`, '/student/assignments');
  logActivity(req.user.id, 'assignment.created', `Created "${title.trim()}" (${course.name})`);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

function loadAssignment(id) {
  return get(`SELECT a.*, c.name AS course_name, c.code AS course_code, c.faculty_id,
    u.name AS faculty_name FROM assignments a
    JOIN courses c ON c.id = a.course_id JOIN users u ON u.id = a.created_by WHERE a.id = ?`, id);
}

router.get('/assignments/:id', (req, res) => {
  const a = loadAssignment(req.params.id);
  if (!a) return bad(res, 'Assignment not found.', 404);
  const isOwnerFaculty = req.user.role === 'faculty' && a.faculty_id === req.user.id;
  const isEnrolled = req.user.role === 'student' && !!get('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?', a.course_id, req.user.id);
  if (!(req.user.role === 'admin' || isOwnerFaculty || isEnrolled)) return bad(res, 'You do not have access to this assignment.', 403);

  const result = { assignment: a };
  if (req.user.role === 'student') {
    result.submission = get(`SELECT s.*, g.marks, g.feedback, g.graded_at FROM submissions s
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.assignment_id = ? AND s.student_id = ?`, a.id, req.user.id) || null;
  } else if (isOwnerFaculty || req.user.role === 'admin') {
    result.submissions = all(`SELECT s.*, u.name AS student_name, u.email AS student_email, g.marks, g.feedback, g.graded_at
      FROM submissions s JOIN users u ON u.id = s.student_id
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE s.assignment_id = ? ORDER BY g.graded_at IS NOT NULL, s.submitted_at ASC`, a.id);
    result.roster = all(`SELECT u.id, u.name FROM enrollments e JOIN users u ON u.id = e.student_id
      WHERE e.course_id = ? AND u.id NOT IN (SELECT student_id FROM submissions WHERE assignment_id = ?)`, a.course_id, a.id);
  }
  res.json(result);
});

router.put('/assignments/:id', requireRole('faculty'), (req, res) => {
  const a = loadAssignment(req.params.id);
  if (!a) return bad(res, 'Assignment not found.', 404);
  if (a.faculty_id !== req.user.id) return bad(res, 'You can only edit your own assignments.', 403);
  const { title, description, deadline, max_marks } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) return bad(res, 'Assignment title is required.');
  if (typeof description !== 'string' || !description.trim()) return bad(res, 'Assignment description is required.');
  const marks = Number(max_marks);
  if (!Number.isInteger(marks) || marks < 1 || marks > 1000) return bad(res, 'Maximum marks must be a whole number between 1 and 1000.');
  if (!deadline || Number.isNaN(Date.parse(deadline))) return bad(res, 'Please provide a valid deadline date.');
  const graded = get('SELECT COUNT(*) n FROM grades g JOIN submissions s ON s.id = g.submission_id WHERE s.assignment_id = ?', a.id).n;
  if (graded > 0 && marks < get('SELECT MAX(g.marks) m FROM grades g JOIN submissions s ON s.id = g.submission_id WHERE s.assignment_id = ?', a.id).m) {
    return bad(res, 'Maximum marks cannot be lower than marks already awarded.');
  }
  run('UPDATE assignments SET title=?, description=?, max_marks=?, deadline=?, updated_at=datetime(\'now\') WHERE id=?',
    title.trim().slice(0, 200), description.trim().slice(0, 5000), marks, new Date(deadline).toISOString().replace('T', ' ').slice(0, 19), a.id);
  res.json({ ok: true });
});

router.delete('/assignments/:id', requireRole('faculty', 'admin'), (req, res) => {
  const a = loadAssignment(req.params.id);
  if (!a) return bad(res, 'Assignment not found.', 404);
  if (req.user.role === 'faculty' && a.faculty_id !== req.user.id) return bad(res, 'You can only delete your own assignments.', 403);
  run('DELETE FROM assignments WHERE id = ?', a.id);
  logActivity(req.user.id, 'assignment.deleted', `Deleted "${a.title}"`);
  res.json({ ok: true });
});

/* ---------------- SUBMISSIONS & GRADING ---------------- */

router.post('/assignments/:id/submit', requireRole('student'), (req, res) => {
  const a = loadAssignment(req.params.id);
  if (!a) return bad(res, 'Assignment not found.', 404);
  if (!get('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?', a.course_id, req.user.id)) {
    return bad(res, 'You are not enrolled in this course.', 403);
  }
  const { answer } = req.body || {};
  if (typeof answer !== 'string' || answer.trim().length < 10) {
    return bad(res, 'Your answer must be at least 10 characters. Describe your work clearly.');
  }
  if (answer.length > 20000) return bad(res, 'Answer is too long (maximum 20,000 characters). Text submissions only — file upload is not available in this demo.');
  const existing = get('SELECT s.*, g.id AS grade_id FROM submissions s LEFT JOIN grades g ON g.submission_id = s.id WHERE s.assignment_id = ? AND s.student_id = ?', a.id, req.user.id);
  if (existing && existing.grade_id) return bad(res, 'This submission has already been graded and can no longer be changed.', 409);
  if (!existing && a.deadline < new Date().toISOString().replace('T', ' ').slice(0, 19)) {
    return bad(res, 'The deadline for this assignment has passed.', 409);
  }
  if (existing) {
    run('UPDATE submissions SET answer = ?, submitted_at = datetime(\'now\') WHERE id = ?', answer.trim(), existing.id);
  } else {
    run('INSERT INTO submissions (assignment_id, student_id, answer) VALUES (?,?,?)', a.id, req.user.id, answer.trim());
  }
  notify(a.faculty_id, 'submission', `New submission: ${a.title}`, `${req.user.name} submitted an answer.`, '/faculty/assignments');
  logActivity(req.user.id, 'submission.created', `Submitted "${a.title}"`);
  res.status(existing ? 200 : 201).json({ ok: true, updated: !!existing });
});

router.post('/submissions/:id/grade', requireRole('faculty'), (req, res) => {
  const sub = get(`SELECT s.*, a.title AS assignment_title, a.max_marks, a.course_id, c.faculty_id
    FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
    WHERE s.id = ?`, req.params.id);
  if (!sub) return bad(res, 'Submission not found.', 404);
  if (sub.faculty_id !== req.user.id) return bad(res, 'Only the course faculty can grade this submission.', 403);
  const { marks, feedback = '' } = req.body || {};
  const m = Number(marks);
  if (!Number.isInteger(m) || m < 0 || m > sub.max_marks) {
    return bad(res, `Marks must be a whole number between 0 and ${sub.max_marks} (the maximum for this assignment).`);
  }
  if (typeof feedback !== 'string' || feedback.length > 3000) return bad(res, 'Feedback must be under 3,000 characters.');
  const existing = get('SELECT id FROM grades WHERE submission_id = ?', sub.id);
  if (existing) {
    run('UPDATE grades SET marks = ?, feedback = ?, graded_by = ?, graded_at = datetime(\'now\') WHERE id = ?', m, feedback.trim(), req.user.id, existing.id);
  } else {
    run('INSERT INTO grades (submission_id, marks, feedback, graded_by) VALUES (?,?,?,?)', sub.id, m, feedback.trim(), req.user.id);
  }
  notify(sub.student_id, 'grade', `Assignment graded: ${sub.assignment_title}`,
    `${req.user.name} awarded ${m}/${sub.max_marks}. View feedback in Assignments.`, '/student/assignments');
  logActivity(req.user.id, 'grade.posted', `Graded ${get('SELECT name FROM users WHERE id = ?', sub.student_id).name} — ${sub.assignment_title} (${m}/${sub.max_marks})`);
  res.json({ ok: true });
});

/* ---------------- DASHBOARD (role-aware) ---------------- */

router.get('/dashboard', (req, res) => {
  const u = req.user;
  if (u.role === 'student') {
    const stats = get(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ${statusSqlStudent} = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN ${statusSqlStudent} = 'submitted' THEN 1 ELSE 0 END) AS submitted,
      SUM(CASE WHEN ${statusSqlStudent} = 'graded' THEN 1 ELSE 0 END) AS graded,
      SUM(CASE WHEN ${statusSqlStudent} = 'overdue' THEN 1 ELSE 0 END) AS overdue
      FROM assignments a
      JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
      LEFT JOIN grades g ON g.submission_id = s.id`, u.id, u.id);
    const upcoming = all(`SELECT a.id, a.title, a.deadline, a.max_marks, c.code AS course_code, ${statusSqlStudent} AS status
      FROM assignments a JOIN courses c ON c.id = a.course_id
      JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
      LEFT JOIN grades g ON g.submission_id = s.id
      WHERE ${statusSqlStudent} IN ('pending','overdue')
      ORDER BY a.deadline ASC LIMIT 5`, u.id, u.id);
    const performance = all(`SELECT c.name AS course, ROUND(AVG(g.marks * 100.0 / a.max_marks), 1) AS avg_pct
      FROM grades g JOIN submissions s ON s.id = g.submission_id
      JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
      WHERE s.student_id = ? GROUP BY c.id ORDER BY c.name`, u.id);
    const announcements = all(`SELECT id, title, body, created_at FROM announcements
      WHERE course_id IS NULL OR course_id IN (SELECT course_id FROM enrollments WHERE student_id = ?)
      ORDER BY created_at DESC LIMIT 4`, u.id);
    const notes = all(`SELECT n.id, n.title, n.created_at, c.code AS course_code FROM notes n
      JOIN courses c ON c.id = n.course_id
      WHERE n.course_id IN (SELECT course_id FROM enrollments WHERE student_id = ?)
      ORDER BY n.created_at DESC LIMIT 4`, u.id);
    const unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', u.id).n;
    return res.json({ stats, upcoming, performance, announcements, notes, unread });
  }

  if (u.role === 'faculty') {
    const stats = {
      total_students: get(`SELECT COUNT(DISTINCT e.student_id) n FROM enrollments e
        JOIN courses c ON c.id = e.course_id WHERE c.faculty_id = ?`, u.id).n,
      courses: get('SELECT COUNT(*) n FROM courses WHERE faculty_id = ?', u.id).n,
      assignments: get(`SELECT COUNT(*) n FROM assignments a JOIN courses c ON c.id = a.course_id WHERE c.faculty_id = ?`, u.id).n,
      pending_submissions: get(`SELECT COUNT(*) n FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
        WHERE c.faculty_id = ? AND s.id NOT IN (SELECT submission_id FROM grades)`, u.id).n,
      graded_submissions: get(`SELECT COUNT(*) n FROM grades g
        JOIN submissions s ON s.id = g.submission_id JOIN assignments a ON a.id = s.assignment_id
        JOIN courses c ON c.id = a.course_id WHERE c.faculty_id = ?`, u.id).n,
      open_questions: get(`SELECT COUNT(*) n FROM questions q JOIN courses c ON c.id = q.course_id
        WHERE c.faculty_id = ? AND q.status = 'open'`, u.id).n,
    };
    const perCourse = all(`SELECT c.id, c.name, c.code,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS students,
      (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS assignments,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id) AS submissions,
      (SELECT COUNT(*) FROM grades g JOIN submissions s ON s.id = g.submission_id JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id) AS graded
      FROM courses c WHERE c.faculty_id = ? ORDER BY c.code`, u.id);
    const recent_submissions = all(`SELECT s.id, s.submitted_at, u.name AS student_name, a.title AS assignment_title, a.id AS assignment_id,
        CASE WHEN g.id IS NOT NULL THEN 'graded' ELSE 'submitted' END AS status
      FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
      JOIN users u ON u.id = s.student_id LEFT JOIN grades g ON g.submission_id = s.id
      WHERE c.faculty_id = ? ORDER BY s.submitted_at DESC LIMIT 5`, u.id);
    const recent_questions = all(`SELECT q.id, q.title, q.status, q.created_at, c.code AS course_code, u.name AS student_name
      FROM questions q JOIN courses c ON c.id = q.course_id JOIN users u ON u.id = q.student_id
      WHERE c.faculty_id = ? ORDER BY q.created_at DESC LIMIT 5`, u.id);
    const recent_activity = all(`SELECT action, detail, created_at FROM activity_log
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`, u.id);
    const unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', u.id).n;
    return res.json({ stats, perCourse, recent_submissions, recent_questions, recent_activity, unread });
  }

  // admin
  const stats = {
    students: get("SELECT COUNT(*) n FROM users WHERE role = 'student'").n,
    faculty: get("SELECT COUNT(*) n FROM users WHERE role = 'faculty'").n,
    courses: get('SELECT COUNT(*) n FROM courses').n,
    subjects: get('SELECT COUNT(*) n FROM subjects').n,
    assignments: get('SELECT COUNT(*) n FROM assignments').n,
    submissions: get('SELECT COUNT(*) n FROM submissions').n,
    graded: get('SELECT COUNT(*) n FROM grades').n,
    notes: get('SELECT COUNT(*) n FROM notes').n,
    questions: get('SELECT COUNT(*) n FROM questions').n,
  };
  const recent_activity = all(`SELECT a.action, a.detail, a.created_at, u.name AS user_name, u.role
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 10`);
  const unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', u.id).n;
  res.json({ stats, recent_activity, unread });
});

/* ---------------- ANALYTICS (faculty/admin) ---------------- */

router.get('/analytics', requireRole('faculty', 'admin'), (req, res) => {
  const scope = req.user.role === 'faculty' ? 'WHERE c.faculty_id = ' + Number(req.user.id) : '';
  const perCourse = all(`SELECT c.id, c.name, c.code,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS students,
    (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS assignments,
    (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id) AS submitted,
    (SELECT COUNT(*) FROM grades g JOIN submissions s ON s.id = g.submission_id JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id) AS graded,
    ROUND((SELECT AVG(g.marks * 100.0 / a.max_marks) FROM grades g JOIN submissions s ON s.id = g.submission_id JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id), 1) AS avg_pct
    FROM courses c ${scope} ORDER BY c.code`);

  const perAssignment = all(`SELECT a.title, a.max_marks, a.deadline, c.code AS course_code,
    (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submitted,
    (SELECT COUNT(*) FROM grades g JOIN submissions s ON s.id = g.submission_id WHERE s.assignment_id = a.id) AS graded,
    ROUND((SELECT AVG(g.marks) FROM grades g JOIN submissions s ON s.id = g.submission_id WHERE s.assignment_id = a.id), 1) AS avg_marks
    FROM assignments a JOIN courses c ON c.id = a.course_id ${req.user.role === 'faculty' ? 'WHERE c.faculty_id = ' + Number(req.user.id) : ''}
    ORDER BY a.deadline ASC`);

  const distribution = all(`SELECT CASE
      WHEN g.marks * 100.0 / a.max_marks >= 90 THEN '90-100%'
      WHEN g.marks * 100.0 / a.max_marks >= 75 THEN '75-89%'
      WHEN g.marks * 100.0 / a.max_marks >= 60 THEN '60-74%'
      WHEN g.marks * 100.0 / a.max_marks >= 40 THEN '40-59%'
      ELSE 'Below 40%' END AS band, COUNT(*) AS count
    FROM grades g JOIN submissions s ON s.id = g.submission_id JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    ${req.user.role === 'faculty' ? 'WHERE c.faculty_id = ' + Number(req.user.id) : ''}
    GROUP BY band`);

  res.json({ perCourse, perAssignment, distribution });
});

export default router;
