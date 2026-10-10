import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, MessageCircle, FileText, ListChecks, Target, Send,
} from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import {
  useToast, Card, Badge, Empty, Spinner, Modal, Field, SearchInput, Avatar,
  STATUS_TONE, fmtDateTime, timeAgo,
} from '../../ui.jsx';

/* ----------------------------- Notes ----------------------------- */

export function StudentNotes() {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState(null);
  const [courseId, setCourseId] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/courses')
      .then((d) => { if (alive) setCourses(d.courses); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (courseId) params.set('course_id', courseId);
      if (q.trim()) params.set('q', q.trim());
      const qs = params.toString();
      api(`/notes${qs ? `?${qs}` : ''}`)
        .then((d) => { if (alive) setNotes(d.notes); })
        .catch((err) => { if (alive) toast.error(err.message); });
    }, q.trim() ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [courseId, q]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Study notes</h1>
          <p className="page-sub">Notes published by your course faculty. Open a card to read the full note.</p>
        </div>
      </div>

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, flexWrap: 'wrap', marginBottom: 16,
        }}
      >
        <select
          className="input"
          style={{ maxWidth: 260 }}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </select>
        <div style={{ minWidth: 240, flex: '0 1 300px' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Search notes…" />
        </div>
      </div>

      {!notes ? (
        <Spinner label="Loading notes…" />
      ) : notes.length === 0 ? (
        <div className="card">
          <Empty
            title="No notes found"
            text={q || courseId ? 'Try a different search term or course filter.' : 'Your faculty have not published any notes yet.'}
          />
        </div>
      ) : (
        <div className="grid grid-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onClick={() => setOpen(n)}
            >
              <div className="card-body">
                <Badge tone="blue">{n.course_code}</Badge>
                <h3 style={{ fontSize: 15, margin: '10px 0 3px' }}>{n.title}</h3>
                <p className="small muted">{n.course_name} · {n.faculty_name}</p>
                {n.description && (
                  <p className="small muted" style={{ marginTop: 8 }}>{n.description}</p>
                )}
                <p className="small muted" style={{ marginTop: 12 }}>{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title || 'Note'}>
        {open && (
          <>
            <div className="chip-row" style={{ marginBottom: 12 }}>
              <Badge tone="blue">{open.course_code}</Badge>
              <Badge tone="gray">{open.course_name}</Badge>
              <span className="small muted">
                {open.faculty_name} · {timeAgo(open.created_at)}
              </span>
            </div>
            {open.description && (
              <p className="small muted" style={{ marginBottom: 12 }}>{open.description}</p>
            )}
            <div
              className="mono"
              style={{
                whiteSpace: 'pre-wrap', background: 'var(--bg)',
                border: '1px solid var(--line)', borderRadius: 11, padding: '14px 16px',
              }}
            >
              {open.content}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

/* ----------------------------- Doubts ----------------------------- */

export function StudentDoubts() {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [questions, setQuestions] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ course_id: '', title: '', body: '' });
  const [busy, setBusy] = useState(false);

  const load = () => api('/questions')
    .then((d) => setQuestions(d.questions))
    .catch((err) => toast.error(err.message));

  useEffect(() => {
    let alive = true;
    api('/courses')
      .then((d) => { if (alive) setCourses(d.courses); })
      .catch(() => {});
    api('/questions')
      .then((d) => { if (alive) setQuestions(d.questions); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.course_id) return toast.error('Please choose a course for your question.');
    setBusy(true);
    try {
      await api('/questions', {
        method: 'POST',
        body: { course_id: +form.course_id, title: form.title, body: form.body },
      });
      toast.success('Question posted. Your faculty has been notified.');
      setForm((f) => ({ ...f, title: '', body: '' }));
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const needle = q.trim().toLowerCase();
  const filtered = (questions || []).filter((x) => {
    if (!needle) return true;
    return (
      x.title.toLowerCase().includes(needle) ||
      x.body.toLowerCase().includes(needle) ||
      x.course_code.toLowerCase().includes(needle) ||
      x.course_name.toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Doubt discussion</h1>
          <p className="page-sub">Ask questions in your courses and follow replies from faculty.</p>
        </div>
      </div>

      <div className="stack">
        <Card title="Ask a question" sub="Your course faculty is notified immediately.">
          <form onSubmit={submit}>
            <div className="form-row">
              <Field label="Course">
                <select value={form.course_id} onChange={set('course_id')} required>
                  <option value="">Choose a course…</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Question title">
                <input
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g. Confused about normalization 3NF"
                  required
                  maxLength={200}
                />
              </Field>
            </div>
            <Field label="Describe your doubt" hint="At least 10 characters.">
              <textarea
                rows={4}
                value={form.body}
                onChange={set('body')}
                placeholder="Explain what you tried and where you are stuck…"
                required
                minLength={10}
                maxLength={3000}
              />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Send size={15} /> {busy ? 'Posting…' : 'Post question'}
            </button>
          </form>
        </Card>

        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, flexWrap: 'wrap',
          }}
        >
          <h3 style={{ fontSize: 15 }}>My questions</h3>
          <div style={{ minWidth: 220, flex: '0 1 280px' }}>
            <SearchInput value={q} onChange={setQ} placeholder="Search your questions…" />
          </div>
        </div>

        {!questions ? (
          <Spinner label="Loading your questions…" />
        ) : filtered.length === 0 ? (
          <div className="card">
            <Empty
              title="No questions yet"
              text={q ? 'No questions match your search.' : 'Questions you ask will appear here with faculty replies.'}
            />
          </div>
        ) : (
          filtered.map((x) => (
            <Card key={x.id} pad={false}>
              <div className="card-body" style={{ paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge tone="blue">{x.course_code}</Badge>
                  <Badge tone={STATUS_TONE[x.status]}>{x.status}</Badge>
                  <span className="small muted">{timeAgo(x.created_at)}</span>
                </div>
                <h3 style={{ fontSize: 15, margin: '10px 0 4px' }}>{x.title}</h3>
                <p className="small" style={{ color: 'var(--ink-700)', whiteSpace: 'pre-wrap' }}>{x.body}</p>
              </div>
              {x.replies.length > 0 && (
                <div style={{ borderTop: '1px solid #eef2f7', padding: '6px 20px 14px' }}>
                  {x.replies.map((r) => (
                    <div key={r.id} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <Avatar name={r.author} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.author}</span>
                          <Badge tone={r.role === 'faculty' ? 'violet' : 'gray'}>{r.role}</Badge>
                          <span className="small muted">{timeAgo(r.created_at)}</span>
                        </div>
                        <p className="small" style={{ color: 'var(--ink-700)', whiteSpace: 'pre-wrap', marginTop: 3 }}>
                          {r.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </>
  );
}

/* ----------------------------- Assistant ----------------------------- */

const MODES = [
  { key: 'chat', label: 'Ask', icon: MessageCircle },
  { key: 'summarize', label: 'Summarize', icon: FileText },
  { key: 'questions', label: 'Generate questions', icon: ListChecks },
  { key: 'topics', label: 'Revision topics', icon: Target },
];

const STATIC_NOTICE = 'DEMO ASSISTANT — no live AI API is configured. Responses are generated locally by a rule-based educational engine and are illustrative only.';

export function StudentAssistant() {
  const { user } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('chat');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(STATIC_NOTICE);
  const [log, setLog] = useState([]);
  const panelRef = useRef(null);

  useEffect(() => {
    const el = panelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log, busy]);

  const canSend = mode === 'topics' || text.trim().length > 0;

  const send = async () => {
    if (!canSend || busy) return;
    const prompt = text.trim();
    const body = { action: mode };
    if (mode === 'chat') body.message = prompt;
    if (mode === 'summarize' || mode === 'questions') body.text = prompt;
    setBusy(true);
    try {
      const d = await api('/assistant', { method: 'POST', body });
      if (d.notice) setNotice(d.notice);
      setLog((l) => [...l, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        mode, prompt, reply: d.reply, list: !!d.list,
      }]);
      setText('');
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
          <h1>Study assistant</h1>
          <p className="page-sub">Concept help, note summaries and practice questions — powered by your own academic data.</p>
        </div>
      </div>

      <div className="notice-banner">
        <Sparkles size={16} />
        <span>{notice}</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          ref={panelRef}
          className="card-body"
          style={{ maxHeight: 380, overflowY: 'auto' }}
        >
          {log.length === 0 ? (
            <Empty
              title="Start a conversation"
              text={`Hi ${(user?.name || 'there').split(' ')[0]} — pick an action below, then type a message or paste your study material.`}
            />
          ) : (
            log.map((m) => (
              <div key={m.id} style={{ marginBottom: 18 }}>
                {m.prompt && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <div
                      style={{
                        background: 'var(--blue-600)', color: '#fff', borderRadius: 12,
                        padding: '9px 14px', maxWidth: '82%', whiteSpace: 'pre-wrap', fontSize: 13,
                      }}
                    >
                      {m.prompt}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div
                    style={{
                      background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12,
                      padding: '10px 14px', maxWidth: '94%', minWidth: 0,
                    }}
                  >
                    <div className="small muted" style={{ fontWeight: 700, marginBottom: 5 }}>
                      {MODES.find((x) => x.key === m.mode)?.label}
                    </div>
                    {m.list ? (
                      <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {Array.isArray(m.reply) && m.reply.map((item, i) => (
                          <li key={i} style={{ marginBottom: 6, whiteSpace: 'pre-wrap' }}>{item}</li>
                        ))}
                      </ol>
                    ) : (
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.reply}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {busy && <Spinner label="Assistant is thinking…" />}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`btn btn-sm ${mode === m.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setMode(m.key)}
              >
                <m.icon size={14} /> {m.label}
              </button>
            ))}
          </div>

          {mode === 'topics' ? (
            <div className="notice-banner" style={{ marginBottom: 14 }}>
              <Sparkles size={16} />
              <span>
                Revision topics are computed from your real grades in this demo database, weakest
                courses first. No input needed — just press Send.
              </span>
            </div>
          ) : (
            <Field
              label={mode === 'chat' ? 'Your question' : 'Study material'}
              hint={
                mode === 'chat'
                  ? 'Ask anything academic — databases, data structures, algorithms, networks, OS…'
                  : 'Paste at least a few sentences of study material (minimum 20 characters).'
              }
            >
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={mode === 'chat' ? 'Ask an academic question…' : 'Paste your study material…'}
              />
            </Field>
          )}

          <button className="btn btn-primary" onClick={send} disabled={busy || !canSend}>
            <Send size={15} /> {busy ? 'Working…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}
