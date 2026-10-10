// End-to-end smoke test against a running server (default http://localhost:4000).
// Usage: node smoke-test.mjs   — exits non-zero on first failure.
const BASE = process.env.BASE_URL || 'http://localhost:4000';
let passed = 0, failed = 0;

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${extra}`); }
}

const facultyTok = (await api('POST', '/api/auth/demo', { role: 'faculty' })).data?.token;
const faculty2Tok = (await api('POST', '/api/auth/login', { email: 'priya.nair@educonnect.demo', password: 'faculty123' })).data?.token;
const studentTok = (await api('POST', '/api/auth/demo', { role: 'student' })).data?.token;
const adminTok = (await api('POST', '/api/auth/demo', { role: 'admin' })).data?.token;
check('logins for all roles', !!(facultyTok && faculty2Tok && studentTok && adminTok));

// Health + bad auth
check('health endpoint public', (await api('GET', '/api/health')).data?.ok === true);
check('rejects missing token', (await api('GET', '/api/dashboard')).status === 401);
check('rejects bad credentials', (await api('POST', '/api/auth/login', { email: 'ram.sharma@educonnect.demo', password: 'wrong' })).status === 401);

// Faculty creates an assignment in own course (course 1 = CS201-A, faculty 2)
const dl = new Date(Date.now() + 5 * 86400000).toISOString();
const created = await api('POST', '/api/assignments', { course_id: 1, title: 'Smoke Test Assignment', description: 'Created by automated smoke test.', deadline: dl, max_marks: 50 }, facultyTok);
check('faculty creates assignment', created.status === 201, JSON.stringify(created.data));
const aid = created.data?.id;

// Faculty cannot create in someone else's course (course 3 belongs to faculty 3)
check('faculty blocked from others course', (await api('POST', '/api/assignments', { course_id: 3, title: 'X', description: 'X desc here.', deadline: dl, max_marks: 10 }, facultyTok)).status === 403);

// Validation checks
check('rejects past deadline', (await api('POST', '/api/assignments', { course_id: 1, title: 'X', description: 'X desc here.', deadline: new Date(Date.now() - 10000).toISOString(), max_marks: 10 }, facultyTok)).status === 400);
check('rejects marks over limit', (await api('POST', '/api/assignments', { course_id: 1, title: 'X', description: 'X desc here.', deadline: dl, max_marks: 5000 }, facultyTok)).status === 400);

// Student (Aarav, id 4) sees the new assignment
const list = await api('GET', '/api/assignments', null, studentTok);
const mine = list.data?.assignments?.find((a) => a.id === aid);
check('student sees new assignment', !!mine && mine.status === 'pending');

// Student submits
const sub = await api('POST', `/api/assignments/${aid}/submit`, { answer: 'This is my smoke-test answer describing the work I did.' }, studentTok);
check('student submits answer', sub.status === 201, JSON.stringify(sub.data));
const detail = await api('GET', `/api/assignments/${aid}`, null, facultyTok);
const subId = detail.data?.submissions?.[0]?.id;
check('faculty sees submission', !!subId);

// Wrong faculty cannot grade
check('wrong faculty blocked from grading', (await api('POST', `/api/submissions/${subId}/grade`, { marks: 40, feedback: 'ok' }, faculty2Tok)).status === 403);

// Owner faculty grades; invalid marks rejected
check('marks above max rejected', (await api('POST', `/api/submissions/${subId}/grade`, { marks: 99, feedback: 'too much' }, facultyTok)).status === 400);
const grade = await api('POST', `/api/submissions/${subId}/grade`, { marks: 42, feedback: 'Great smoke test work.' }, facultyTok);
check('faculty grades submission', grade.status === 200, JSON.stringify(grade.data));

// Student sees marks + feedback
const after = await api('GET', `/api/assignments/${aid}`, null, studentTok);
check('student sees marks', after.data?.submission?.marks === 42);
check('student sees feedback', after.data?.submission?.feedback === 'Great smoke test work.');

// Graded submission locked
check('graded submission locked', (await api('POST', `/api/assignments/${aid}/submit`, { answer: 'Trying to change after grading.' }, studentTok)).status === 409);

// Student blocked from faculty actions
check('student blocked from grading', (await api('POST', `/api/submissions/${subId}/grade`, { marks: 1 }, studentTok)).status === 403);
check('student blocked from admin users', (await api('GET', '/api/users', null, studentTok)).status === 403);

// Notes flow: faculty publishes, student sees, unauthorized edit blocked
const note = await api('POST', '/api/notes', { course_id: 1, title: 'Smoke Test Note', description: 'd', content: 'Smoke test note content with enough characters.' }, facultyTok);
check('faculty publishes note', note.status === 201);
const notes = await api('GET', '/api/notes', null, studentTok);
check('student sees published note', notes.data?.notes?.some((n) => n.id === note.data?.id));

// Doubts flow
const q = await api('POST', '/api/questions', { course_id: 1, title: 'Smoke test question?', body: 'This is a smoke test question body.' }, studentTok);
check('student asks question', q.status === 201);
const reply = await api('POST', `/api/questions/${q.data?.id}/replies`, { body: 'Smoke test reply from faculty.' }, facultyTok);
check('faculty replies', reply.status === 201);

// Announcement + notifications
await api('POST', '/api/announcements', { title: 'Smoke announcement', body: 'Smoke body' }, facultyTok);
const notifs = await api('GET', '/api/notifications', null, studentTok);
check('student got grade notification', notifs.data?.notifications?.some((n) => n.type === 'grade' && n.body?.includes('42')));

// Assistant fallback
const ai = await api('POST', '/api/assistant', { action: 'chat', message: 'What is a stack?' }, studentTok);
check('assistant answers with demo notice', typeof ai.data?.reply === 'string' && ai.data?.notice?.includes('DEMO'));
const summ = await api('POST', '/api/assistant', { action: 'summarize', text: 'Databases store structured data. SQL queries data with joins. Normalization removes redundancy from tables. Transactions keep data safe with ACID properties.' }, studentTok);
check('assistant summarizes', summ.status === 200 && summ.data?.reply?.length > 10);

// Admin flows
const stats = await api('GET', '/api/dashboard', null, adminTok);
check('admin dashboard stats', stats.data?.stats?.students === 5 && stats.data?.stats?.faculty === 2);
const newUser = await api('POST', '/api/users', { name: 'Smoke Student', email: 'smoke@educonnect.demo', password: 'pass123', role: 'student' }, adminTok);
check('admin creates user', newUser.status === 201);
const subj = await api('POST', '/api/subjects', { name: 'Smoke Subject', code: 'SMK101' }, adminTok);
check('admin creates subject', subj.status === 201);
const newCourse = await api('POST', '/api/courses', { name: 'Smoke Course', code: 'SMK101-A', subject_id: subj.data?.id, faculty_id: 2, description: 'x' }, adminTok);
check('admin creates course', newCourse.status === 201);
await api('DELETE', `/api/users/${newUser.data?.id}`, null, adminTok);
await api('DELETE', `/api/courses/${newCourse.data?.id}`, null, adminTok);
await api('DELETE', `/api/subjects/${subj.data?.id}`, null, adminTok);

// Registration flow
const reg = await api('POST', '/api/auth/register', { name: 'Reg Tester', email: 'reg.tester@example.com', password: 'secret1', role: 'student' }, null);
check('register works', reg.status === 201 && !!reg.data?.token);
check('duplicate email rejected', (await api('POST', '/api/auth/register', { name: 'Reg Tester', email: 'reg.tester@example.com', password: 'secret1', role: 'student' })).status === 409);

// Analytics
const an = await api('GET', '/api/analytics', null, facultyTok);
check('faculty analytics', Array.isArray(an.data?.perCourse) && an.data.perCourse.length >= 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
