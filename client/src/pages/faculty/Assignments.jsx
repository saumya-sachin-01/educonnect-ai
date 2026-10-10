import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, GraduationCap, Clock, Users } from 'lucide-react';
import { api } from '../../api.js';
import {
  Card, Badge, Empty, Spinner, Modal, Field, useToast,
  fmtDateTime, deadlineInfo,
} from '../../ui.jsx';

/* ---------------- List + create ---------------- */

export function FacultyAssignments() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    api('/assignments').then((d) => setItems(d.assignments)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <Empty title="Could not load assignments" text={err} />;
  if (!items) return <Spinner label="Loading assignments…" />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Assignments</h1>
          <p className="page-sub">Create assignments for your courses and track submission progress.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New assignment</button>
      </div>

      {items.length === 0 ? (
        <Empty
          title="No assignments yet"
          text="Create your first assignment — students in the course are notified instantly."
          action={<button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New assignment</button>}
        />
      ) : (
        <div className="grid-2">
          {items.map((a) => {
            const dl = deadlineInfo(a.deadline);
            const pct = a.student_count ? Math.round((a.submitted_count / a.student_count) * 100) : 0;
            return (
              <Card key={a.id} pad={false}>
                <div style={{ padding: '16px 16px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <Link to={`/faculty/assignments/${a.id}`} style={{ fontWeight: 700, color: 'inherit', fontSize: 15 }}>
                      {a.title}
                    </Link>
                    <Badge tone={dl.tone}>{dl.label}</Badge>
                  </div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    <span className="mono">{a.course_code}</span> · {a.max_marks} marks · due {fmtDateTime(a.deadline)}
                  </div>
                  <div className="small muted" style={{ marginTop: 8 }}>
                    <Users size={12} style={{ verticalAlign: '-2px' }} /> {a.submitted_count}/{a.student_count} submitted
                    {'  ·  '}
                    <GraduationCap size={12} style={{ verticalAlign: '-2px' }} /> {a.graded_count} graded
                    {a.avg_marks != null && ` · avg ${a.avg_marks}`}
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: '#e2e8f0', marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--blue-600), var(--violet-600))' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px 12px' }}>
                  <Link className="btn btn-subtle btn-sm" to={`/faculty/assignments/${a.id}`}>Open & grade</Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast.success('Assignment created — enrolled students notified.'); }} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ course_id: '', title: '', description: '', max_marks: 20, deadline: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/courses').then((d) => {
      setCourses(d.courses);
      if (d.courses.length) setForm((f) => ({ ...f, course_id: String(d.courses[0].id) }));
    }).catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.course_id) return setError('Choose a course first.');
    if (!form.title.trim()) return setError('Title is required.');
    if (!form.description.trim()) return setError('Description is required.');
    const marks = Number(form.max_marks);
    if (!Number.isInteger(marks) || marks < 1 || marks > 1000) return setError('Max marks must be a whole number between 1 and 1000.');
    if (!form.deadline) return setError('Pick a deadline.');
    setBusy(true);
    try {
      await api('/assignments', {
        method: 'POST',
        body: {
          course_id: Number(form.course_id),
          title: form.title.trim(),
          description: form.description.trim(),
          max_marks: marks,
          deadline: new Date(form.deadline).toISOString(),
        },
      });
      onCreated();
    } catch (err2) {
      setBusy(false);
      setError(err2.message);
      toast.error(err2.message);
    }
  };

  return (
    <Modal open onClose={onClose} title="Create assignment">
      <form onSubmit={submit}>
        {courses.length === 0 ? (
          <p className="small muted">You have no courses assigned yet — ask the admin to create a course with you as faculty.</p>
        ) : (
          <>
            <Field label="Course">
              <select className="input" value={form.course_id} onChange={set('course_id')}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </Field>
            <Field label="Title">
              <input className="input" value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. ER Diagram for College DB" />
            </Field>
            <Field label="Description">
              <textarea className="input" rows={4} value={form.description} onChange={set('description')} maxLength={5000} placeholder="What should students do? Any resources to refer?" />
            </Field>
            <div className="form-row">
              <Field label="Max marks" hint="1–1000">
                <input className="input" type="number" min={1} max={1000} value={form.max_marks} onChange={set('max_marks')} />
              </Field>
              <Field label="Deadline">
                <input className="input" type="datetime-local" value={form.deadline} onChange={set('deadline')} />
              </Field>
            </div>
          </>
        )}
        {error && <p className="field-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || courses.length === 0}>
            {busy ? 'Creating…' : 'Create & notify students'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Detail + grading ---------------- */

export function FacultyAssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [grading, setGrading] = useState(null); // submission being graded
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/assignments/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <Empty title="Could not load this assignment" text={err} action={<Link className="btn btn-ghost btn-sm" to="/faculty/assignments">Back to assignments</Link>} />;
  if (!data) return <Spinner label="Loading assignment…" />;

  const { assignment: a, submissions = [], roster = [] } = data;
  const dl = deadlineInfo(a.deadline);

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/assignments/${a.id}`, { method: 'DELETE' });
      toast.success('Assignment deleted.');
      navigate('/faculty/assignments');
    } catch (e2) {
      setBusy(false);
      setConfirmDel(false);
      toast.error(e2.message);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/faculty/assignments')} style={{ marginBottom: 8 }}>← All assignments</button>
          <h1>{a.title}</h1>
          <p className="page-sub">
            <span className="mono">{a.course_code}</span> — {a.course_name} · {a.max_marks} marks · <Badge tone={dl.tone}>{dl.label}</Badge> · due {fmtDateTime(a.deadline)}
          </p>
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(true)}><Trash2 size={14} /> Delete</button>
      </div>

      <Card title="Instructions" pad>
        <p style={{ whiteSpace: 'pre-wrap' }}>{a.description}</p>
      </Card>

      <Card
        title={`Submissions (${submissions.length})`}
        sub="Grade each answer with marks and written feedback — students see both instantly."
        pad={false}
      >
        {submissions.length === 0 ? (
          <div className="card-body"><Empty title="No submissions yet" text="Once students submit their answers, grade them here." /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Student</th><th>Submitted</th><th>Answer</th><th>Grade</th><th></th></tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.student_name}</div>
                      <div className="small muted">{s.student_email}</div>
                    </td>
                    <td className="small muted">{fmtDateTime(s.submitted_at)}</td>
                    <td style={{ maxWidth: 340 }}>
                      <div className="small" style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>{s.answer}</div>
                    </td>
                    <td>
                      {s.marks != null ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{s.marks}/{a.max_marks}</div>
                          {s.feedback && <div className="small muted" style={{ maxWidth: 240, whiteSpace: 'pre-wrap' }}>{s.feedback}</div>}
                        </>
                      ) : (
                        <Badge tone="amber">pending</Badge>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-subtle btn-sm" onClick={() => setGrading(s)}>
                        <GraduationCap size={14} /> {s.marks != null ? 'Re-grade' : 'Grade'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {roster.length > 0 && (
        <Card title={`Not submitted yet (${roster.length})`} sub="Enrolled students who have not submitted.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {roster.map((r) => (
              <span key={r.id} className="badge b-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={12} /> {r.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {grading && (
        <GradeModal
          submission={grading}
          maxMarks={a.max_marks}
          onClose={() => setGrading(null)}
          onSaved={() => { setGrading(null); load(); toast.success('Grade saved — student notified.'); }}
        />
      )}

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this assignment?">
        <p style={{ marginBottom: 14 }}>
          This permanently removes <strong>{a.title}</strong> along with its submissions and grades. This cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
        </div>
      </Modal>
    </div>
  );
}

function GradeModal({ submission, maxMarks, onClose, onSaved }) {
  const toast = useToast();
  const [marks, setMarks] = useState(submission.marks != null ? String(submission.marks) : '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const m = Number(marks);
    if (!Number.isInteger(m) || m < 0 || m > maxMarks) return setError(`Marks must be a whole number between 0 and ${maxMarks}.`);
    setBusy(true);
    try {
      await api(`/submissions/${submission.id}/grade`, { method: 'POST', body: { marks: m, feedback: feedback.trim() } });
      onSaved();
    } catch (err2) {
      setBusy(false);
      setError(err2.message);
      toast.error(err2.message);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Grade — ${submission.student_name}`}>
      <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 9, padding: 12, marginBottom: 14 }}>
        <div className="small muted" style={{ marginBottom: 6 }}>Submitted {fmtDateTime(submission.submitted_at)}</div>
        <div className="small" style={{ whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>{submission.answer}</div>
      </div>
      <form onSubmit={submit}>
        <div className="form-row">
          <Field label={`Marks (out of ${maxMarks})`}>
            <input className="input" type="number" min={0} max={maxMarks} value={marks} onChange={(e) => setMarks(e.target.value)} autoFocus />
          </Field>
        </div>
        <Field label="Feedback" hint="Shown to the student with their marks (optional).">
          <textarea className="input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={3000} placeholder="What was good, what to improve…" />
        </Field>
        {error && <p className="field-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save grade'}</button>
        </div>
      </form>
    </Modal>
  );
}
