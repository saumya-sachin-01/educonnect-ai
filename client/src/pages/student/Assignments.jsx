import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Info, AlertTriangle } from 'lucide-react';
import { useToast, Card, Badge, Empty, Spinner, Field, SearchInput, STATUS_TONE, fmtDate, fmtDateTime, deadlineInfo } from '../../ui.jsx';
import { api } from '../../api.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded', label: 'Graded' },
  { key: 'overdue', label: 'Overdue' },
];

export function StudentAssignments() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    let alive = true;
    api('/assignments')
      .then((d) => { if (alive) setRows(d.assignments); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, submitted: 0, graded: 0, overdue: 0 };
    for (const a of rows || []) {
      c.all += 1;
      c[a.status] = (c[a.status] || 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter((a) => {
      if (tab !== 'all' && a.status !== tab) return false;
      if (!needle) return true;
      return (
        a.title.toLowerCase().includes(needle) ||
        a.course_name.toLowerCase().includes(needle) ||
        a.course_code.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, tab]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assignments</h1>
          <p className="page-sub">Submit your work before the deadline and track marks and feedback.</p>
        </div>
      </div>

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, flexWrap: 'wrap', marginBottom: 16,
        }}
      >
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label} ({counts[t.key] || 0})
            </button>
          ))}
        </div>
        <div style={{ minWidth: 240, flex: '0 1 300px' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search by title or course…" />
        </div>
      </div>

      {!rows ? (
        <Spinner label="Loading assignments…" />
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty
            title="No assignments found"
            text={q || tab !== 'all' ? 'Try a different search term or status filter.' : 'You have no assignments right now.'}
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Deadline</th>
                  <th>Max marks</th>
                  <th>My marks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const dl = deadlineInfo(a.deadline);
                  return (
                    <tr
                      key={a.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/student/assignments/${a.id}`)}
                    >
                      <td>
                        <div className="t-main">{a.title}</div>
                        <div className="t-sub">{a.course_code} · {a.course_name}</div>
                      </td>
                      <td>
                        <div>{fmtDate(a.deadline)}</div>
                        <div className="t-sub">{dl.label}</div>
                      </td>
                      <td>{a.max_marks}</td>
                      <td>{a.marks ?? '—'}</td>
                      <td>
                        <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function StudentAssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api(`/assignments/${id}`)
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) toast.error(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) return <Spinner label="Loading assignment…" />;
  if (!data) {
    return (
      <div className="card">
        <Empty
          title="Assignment not found"
          text="It may have been removed, or you may not have access to it."
          action={
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/student/assignments')}>
              Back to assignments
            </button>
          }
        />
      </div>
    );
  }

  const { assignment: a, submission: sub } = data;
  const dl = deadlineInfo(a.deadline);
  const graded = !!sub && sub.graded_at != null;
  const overdue = !sub && dl.tone === 'red' && dl.label === 'Overdue';
  const pct = graded ? Math.min(100, Math.max(0, Math.round((sub.marks / a.max_marks) * 100))) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (answer.trim().length < 10) {
      return toast.error('Your answer must be at least 10 characters. Describe your work clearly.');
    }
    setBusy(true);
    try {
      const d = await api(`/assignments/${id}/submit`, { method: 'POST', body: { answer } });
      toast.success(d.updated ? 'Submission updated.' : 'Answer submitted successfully.');
      const fresh = await api(`/assignments/${id}`);
      setData(fresh);
      setAnswer('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{a.title}</h1>
          <p className="page-sub">
            {a.course_name} ({a.course_code}) · Faculty: {a.faculty_name}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge tone={dl.tone}>{dl.label}</Badge>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/assignments')}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>

      <div className="grid grid-32">
        <Card
          title="Assignment brief"
          sub={`Deadline ${fmtDateTime(a.deadline)} · Maximum ${a.max_marks} marks`}
        >
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.description}</p>
        </Card>

        <div>
          {sub ? (
            <>
              {graded && (
                <div className="notice-banner">
                  <Info size={16} />
                  <span>
                    This assignment has been graded. Your submission is locked and can no longer be
                    changed.
                  </span>
                </div>
              )}
              <Card title="Your submission" sub={`Submitted ${fmtDateTime(sub.submitted_at)}`}>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{sub.answer}</p>
                {graded && (
                  <>
                    <hr className="divider" />
                    <div className="small muted" style={{ marginBottom: 4 }}>Marks awarded</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{sub.marks}</span>
                      <span className="muted">/ {a.max_marks}</span>
                    </div>
                    <div className="grad-strip" style={{ margin: '10px 0 14px' }}>
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    {sub.feedback ? (
                      <div
                        style={{
                          background: 'var(--blue-50)', border: '1px solid #dbeafe',
                          borderRadius: 11, padding: '12px 15px',
                        }}
                      >
                        <div className="small" style={{ fontWeight: 700, color: 'var(--ink-700)', marginBottom: 4 }}>
                          Faculty feedback
                        </div>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{sub.feedback}</p>
                      </div>
                    ) : (
                      <p className="small muted">No written feedback was provided for this submission.</p>
                    )}
                  </>
                )}
              </Card>
            </>
          ) : overdue ? (
            <div className="notice-banner">
              <AlertTriangle size={16} />
              <span>
                The deadline for this assignment passed on {fmtDateTime(a.deadline)} and no submission
                was received. Contact your faculty if you believe this is a mistake.
              </span>
            </div>
          ) : (
            <Card title="Submit your answer" sub={`Due ${fmtDateTime(a.deadline)}`}>
              <form onSubmit={submit}>
                <Field
                  label="Your answer"
                  hint={`Minimum 10 characters · text only, no file uploads in this demo · ${answer.trim().length.toLocaleString()} / 20,000 characters`}
                >
                  <textarea
                    rows={10}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value.slice(0, 20000))}
                    placeholder="Write your answer here. Describe your work clearly and completely…"
                  />
                </Field>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || answer.trim().length < 10}
                >
                  <Send size={15} /> {busy ? 'Submitting…' : 'Submit answer'}
                </button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
