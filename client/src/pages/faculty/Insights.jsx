import { useEffect, useState, useCallback } from 'react';
import { BarChart3, BookOpen, Users, ClipboardList, GraduationCap, KeyRound, Save } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import {
  Card, Stat, Badge, Empty, Spinner, Field, Modal, useToast,
  fmtDate, fmtDateTime,
} from '../../ui.jsx';

/* ---------------- Analytics ---------------- */

export function FacultyAnalytics() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/analytics').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Empty title="Could not load analytics" text={err} />;
  if (!data) return <Spinner label="Crunching your class numbers…" />;

  const { perCourse, perAssignment, distribution } = data;
  const totalGraded = distribution.reduce((s, d) => s + d.count, 0);
  const maxBand = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="page-sub">Real numbers from your courses — submissions, grades and averages. Computed live from the demo database.</p>
        </div>
      </div>

      {perCourse.length === 0 ? (
        <Empty title="No courses to analyze" text="Once you teach a course with enrolled students, analytics appear here." />
      ) : (
        <>
          <Card title="Course performance" sub="Average score per course (percentage of max marks)" pad={false}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Course</th><th>Students</th><th>Assignments</th><th>Submitted</th><th>Graded</th><th>Class average</th></tr>
                </thead>
                <tbody>
                  {perCourse.map((c) => (
                    <tr key={c.id}>
                      <td><span className="mono small">{c.code}</span> {c.name}</td>
                      <td>{c.students}</td>
                      <td>{c.assignments}</td>
                      <td>{c.submitted}</td>
                      <td>{c.graded}</td>
                      <td>
                        {c.avg_pct != null ? (
                          <Badge tone={c.avg_pct >= 75 ? 'green' : c.avg_pct >= 50 ? 'amber' : 'red'}>{c.avg_pct}%</Badge>
                        ) : <span className="muted small">no grades yet</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid-2">
            <Card title="Grade distribution" sub={totalGraded ? `${totalGraded} graded submissions` : 'No grades yet'}>
              {totalGraded === 0 ? (
                <Empty title="Nothing graded yet" text="Grade submissions to see the distribution." />
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {['90-100%', '75-89%', '60-74%', '40-59%', 'Below 40%'].map((band) => {
                    const row = distribution.find((d) => d.band === band);
                    const count = row?.count || 0;
                    const tone = band === 'Below 40%' ? 'var(--red-500, #ef4444)' : band === '40-59%' ? '#f59e0b' : 'var(--blue-600)';
                    return (
                      <div key={band} style={{ display: 'grid', gridTemplateColumns: '86px 1fr 34px', alignItems: 'center', gap: 10 }}>
                        <span className="small muted">{band}</span>
                        <div style={{ height: 10, borderRadius: 5, background: '#eef2f7' }}>
                          <div style={{ width: `${Math.round((count / maxBand) * 100)}%`, height: '100%', borderRadius: 5, background: tone }} />
                        </div>
                        <span className="small" style={{ textAlign: 'right', fontWeight: 600 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Assignment breakdown" sub="Submissions and averages per assignment" pad={false}>
              {perAssignment.length === 0 ? (
                <div className="card-body"><Empty title="No assignments yet" /></div>
              ) : (
                <div className="table-wrap" style={{ maxHeight: 340, overflow: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>Assignment</th><th>Submitted</th><th>Average</th></tr></thead>
                    <tbody>
                      {perAssignment.map((a, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{a.title}</div>
                            <div className="small muted">{a.course_code} · {a.max_marks} marks · due {fmtDate(a.deadline)}</div>
                          </td>
                          <td>{a.submitted} <span className="muted small">(graded {a.graded})</span></td>
                          <td>{a.avg_marks != null ? `${a.avg_marks}/${a.max_marks}` : <span className="muted small">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- My Courses ---------------- */

export function FacultyCourses() {
  const [courses, setCourses] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api('/courses').then((d) => setCourses(d.courses)).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Empty title="Could not load courses" text={err} />;
  if (!courses) return <Spinner label="Loading your courses…" />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>My Courses</h1>
          <p className="page-sub">Courses assigned to you with enrolled students and workload.</p>
        </div>
      </div>

      {courses.length === 0 ? (
        <Empty title="No courses assigned yet" text="The admin assigns courses to faculty members." />
      ) : (
        <div className="grid-2">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course: c, open, onToggle }) {
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || detail) return;
    api(`/courses/${c.id}`).then(setDetail).catch((e) => setErr(e.message));
  }, [open, detail, c.id]);

  return (
    <Card
      title={c.name}
      sub={<><span className="mono">{c.code}</span> · {c.subject_name}{c.description ? ` — ${c.description}` : ''}</>}
      actions={<button className="btn btn-ghost btn-sm" onClick={onToggle}>{open ? 'Hide details' : 'View details'}</button>}
    >
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <span className="small"><Users size={13} style={{ verticalAlign: '-2px' }} /> {c.student_count} students</span>
        <span className="small"><ClipboardList size={13} style={{ verticalAlign: '-2px' }} /> {c.assignment_count} assignments</span>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {err && <p className="field-error">{err}</p>}
          {!detail ? <Spinner label="Loading roster…" /> : (
            <div className="stack" style={{ gap: 8 }}>
              <div className="small" style={{ fontWeight: 700 }}>Enrolled students ({detail.students.length})</div>
              {detail.students.length === 0 ? (
                <p className="small muted">No students enrolled yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {detail.students.map((s) => (
                    <span key={s.enrollment_id} className="badge b-gray">{s.name}</span>
                  ))}
                </div>
              )}
              <div className="small" style={{ fontWeight: 700, marginTop: 6 }}>Assignments in this course ({detail.assignments.length})</div>
              {detail.assignments.length === 0 ? (
                <p className="small muted">None yet — create one from the Assignments page.</p>
              ) : (
                detail.assignments.map((a) => (
                  <div key={a.id} className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{a.title}</span>
                    <span className="muted">{a.max_marks} marks · due {fmtDate(a.deadline)}</span>
                  </div>
                ))
              )}
              <div className="small" style={{ fontWeight: 700, marginTop: 6 }}>Notes published ({detail.notes.length})</div>
              {detail.notes.length === 0 ? (
                <p className="small muted">No notes yet.</p>
              ) : (
                detail.notes.map((n) => (
                  <div key={n.id} className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{n.title}</span>
                    <span className="muted">{fmtDate(n.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---------------- Profile ---------------- */

export function FacultyProfile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error('Name must be at least 2 characters.');
    setSavingName(true);
    try {
      await api('/auth/profile', { method: 'PATCH', body: { name: name.trim() } });
      await refresh();
      toast.success('Profile updated.');
    } catch (err2) {
      toast.error(err2.message);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <p className="page-sub">Your faculty account details.</p>
        </div>
      </div>

      <div className="grid-2">
        <Card title="Account">
          <div className="stack" style={{ gap: 8 }}>
            <div className="list-row" style={{ padding: '8px 0' }}><span className="small muted" style={{ width: 90 }}>Name</span><strong>{user.name}</strong></div>
            <div className="list-row" style={{ padding: '8px 0' }}><span className="small muted" style={{ width: 90 }}>Email</span><span>{user.email}</span></div>
            <div className="list-row" style={{ padding: '8px 0' }}><span className="small muted" style={{ width: 90 }}>Role</span><Badge tone="violet">{user.role}</Badge></div>
            <div className="list-row" style={{ padding: '8px 0' }}><span className="small muted" style={{ width: 90 }}>Member since</span><span>{fmtDate(user.created_at)}</span></div>
          </div>
        </Card>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Edit name">
            <form onSubmit={saveName}>
              <Field label="Display name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </Field>
              <button className="btn btn-primary btn-sm" disabled={savingName}><Save size={14} /> {savingName ? 'Saving…' : 'Save name'}</button>
            </form>
          </Card>

          <Card title="Password" sub="Passwords are stored as salted scrypt hashes — never in plain text.">
            <button className="btn btn-ghost btn-sm" onClick={() => setPwOpen(true)}><KeyRound size={14} /> Change password</button>
          </Card>
        </div>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} onSaved={() => { setPwOpen(false); toast.success('Password changed.'); }} />}
    </div>
  );
}

function PasswordModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.new_password.length < 6) return setError('New password must be at least 6 characters.');
    if (form.new_password !== form.confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      await api('/auth/profile', {
        method: 'PATCH',
        body: { current_password: form.current_password, new_password: form.new_password },
      });
      onSaved();
    } catch (err2) {
      setBusy(false);
      setError(err2.message);
      toast.error(err2.message);
    }
  };

  return (
    <Modal open onClose={onClose} title="Change password">
      <form onSubmit={submit}>
        <Field label="Current password">
          <input className="input" type="password" value={form.current_password} onChange={set('current_password')} autoFocus />
        </Field>
        <Field label="New password" hint="Minimum 6 characters.">
          <input className="input" type="password" value={form.new_password} onChange={set('new_password')} />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type="password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        {error && <p className="field-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </div>
      </form>
    </Modal>
  );
}
