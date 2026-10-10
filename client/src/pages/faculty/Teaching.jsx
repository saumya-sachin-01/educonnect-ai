import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, MessageCircleQuestion, Send, CheckCircle2, RotateCcw, StickyNote,
} from 'lucide-react';
import { api } from '../../api.js';
import {
  Card, Badge, STATUS_TONE, Empty, Spinner, Modal, Field, useToast,
  fmtDateTime, timeAgo,
} from '../../ui.jsx';

/* ---------------- Notes (faculty: publish & manage) ---------------- */

export function FacultyNotes() {
  const toast = useToast();
  const [notes, setNotes] = useState(null);
  const [courses, setCourses] = useState([]);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    api(`/notes${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((d) => setNotes(d.notes)).catch((e) => setErr(e.message));
  }, [q]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/courses').then((d) => setCourses(d.courses)); }, []);

  const remove = async (n) => {
    if (!window.confirm(`Delete notes "${n.title}"?`)) return;
    try {
      await api(`/notes/${n.id}`, { method: 'DELETE' });
      setNotes((ns) => ns.filter((x) => x.id !== n.id));
      toast.success('Notes deleted.');
    } catch (e) { toast.error(e.message); }
  };

  if (err) return <Empty title="Could not load notes" text={err} />;
  if (!notes) return <Spinner label="Loading notes…" />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Study Notes</h1>
          <p className="page-sub">Publish text notes to your courses. Students are notified when you publish. (Text only — file upload is not available in this demo.)</p>
        </div>
        <button className="btn btn-primary" disabled={courses.length === 0} onClick={() => setShowForm(true)}><Plus size={15} /> Publish notes</button>
      </div>

      <div className="page-head" style={{ marginBottom: 0 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search your notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {notes.length === 0 ? (
        <Empty
          title={q ? 'No matching notes' : 'No notes published yet'}
          text={q ? 'Try a different search.' : 'Share lecture notes as text with your students.'}
          action={courses.length > 0 && !q ? <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Publish notes</button> : null}
        />
      ) : (
        <div className="grid-2">
          {notes.map((n) => (
            <Card
              key={n.id}
              title={n.title}
              sub={`${n.course_code} — ${n.course_name} · ${timeAgo(n.created_at)}`}
              actions={
                <>
                  <button className="icon-btn" title="Edit" onClick={() => setEditing(n)}><StickyNote size={15} /></button>
                  <button className="icon-btn" title="Delete" onClick={() => remove(n)}><Trash2 size={15} /></button>
                </>
              }
            >
              {n.description && <p className="small muted" style={{ marginBottom: 8 }}>{n.description}</p>}
              <div className="small" style={{ whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto' }}>{n.content}</div>
            </Card>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <NoteForm
          courses={courses}
          note={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); toast.success(editing ? 'Notes updated.' : 'Notes published — enrolled students notified.'); }}
        />
      )}
    </div>
  );
}

function NoteForm({ courses, note, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    course_id: note ? String(note.course_id) : courses.length ? String(courses[0].id) : '',
    title: note?.title || '',
    description: note?.description || '',
    content: note?.content || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required.');
    if (form.content.trim().length < 10) return setError('Content must be at least 10 characters.');
    setBusy(true);
    try {
      const body = { course_id: Number(form.course_id), title: form.title.trim(), description: form.description.trim(), content: form.content.trim() };
      if (note) await api(`/notes/${note.id}`, { method: 'PUT', body });
      else await api('/notes', { method: 'POST', body });
      onSaved();
    } catch (err2) {
      setBusy(false);
      setError(err2.message);
      toast.error(err2.message);
    }
  };

  return (
    <Modal open onClose={onClose} title={note ? 'Edit notes' : 'Publish notes'}>
      <form onSubmit={submit}>
        <Field label="Course">
          <select className="input" value={form.course_id} onChange={set('course_id')} disabled={!!note}>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input className="input" value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. Normalization — quick recap" />
        </Field>
        <Field label="Short description (optional)">
          <input className="input" value={form.description} onChange={set('description')} maxLength={300} />
        </Field>
        <Field label="Note content (text only)" hint="Up to 20,000 characters. File/PDF upload is not available in this demo.">
          <textarea className="input" rows={8} value={form.content} onChange={set('content')} maxLength={20000} placeholder="Paste or type the study material here…" />
        </Field>
        {error && <p className="field-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : note ? 'Save changes' : 'Publish & notify'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Announcements ---------------- */

export function FacultyAnnouncements() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [courses, setCourses] = useState([]);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api('/announcements').then((d) => setItems(d.announcements)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/courses').then((d) => setCourses(d.courses)); }, []);

  const remove = async (a) => {
    if (!window.confirm(`Delete announcement "${a.title}"?`)) return;
    try {
      await api(`/announcements/${a.id}`, { method: 'DELETE' });
      setItems((xs) => xs.filter((x) => x.id !== a.id));
      toast.success('Announcement deleted.');
    } catch (e) { toast.error(e.message); }
  };

  if (err) return <Empty title="Could not load announcements" text={err} />;
  if (!items) return <Spinner label="Loading announcements…" />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Announcements</h1>
          <p className="page-sub">Broadcast to all students, or to one specific course. Everyone gets an in-app notification.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> New announcement</button>
      </div>

      {items.length === 0 ? (
        <Empty title="No announcements yet" text="Post your first announcement — students receive it instantly." />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {items.map((a) => (
            <Card
              key={a.id}
              title={a.title}
              sub={`${a.author_name} · ${fmtDateTime(a.created_at)}${a.course_code ? ` · ${a.course_code}` : ' · All students'}`}
              actions={<button className="icon-btn" title="Delete" onClick={() => remove(a)}><Trash2 size={15} /></button>}
            >
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <AnnouncementForm
          courses={courses}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); toast.success('Announcement posted — students notified.'); }}
        />
      )}
    </div>
  );
}

function AnnouncementForm({ courses, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', body: '', course_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required.');
    if (!form.body.trim()) return setError('Body is required.');
    setBusy(true);
    try {
      await api('/announcements', {
        method: 'POST',
        body: { title: form.title.trim(), body: form.body.trim(), ...(form.course_id ? { course_id: Number(form.course_id) } : {}) },
      });
      onSaved();
    } catch (err2) {
      setBusy(false);
      setError(err2.message);
      toast.error(err2.message);
    }
  };

  return (
    <Modal open onClose={onClose} title="New announcement">
      <form onSubmit={submit}>
        <Field label="Audience" hint="All students, or just one of your courses.">
          <select className="input" value={form.course_id} onChange={set('course_id')}>
            <option value="">📢 All my students</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name} only</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input className="input" value={form.title} onChange={set('title')} maxLength={200} placeholder="e.g. Extra lab session on Saturday" />
        </Field>
        <Field label="Message">
          <textarea className="input" rows={4} value={form.body} onChange={set('body')} maxLength={3000} />
        </Field>
        {error && <p className="field-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post announcement'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Doubts (faculty: answer open questions) ---------------- */

export function FacultyDoubts() {
  const toast = useToast();
  const [questions, setQuestions] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('open'); // open | all
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyErr, setReplyErr] = useState('');

  const load = useCallback(() => {
    api('/questions').then((d) => setQuestions(d.questions)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <Empty title="Could not load doubts" text={err} />;
  if (!questions) return <Spinner label="Loading student doubts…" />;

  const visible = filter === 'open' ? questions.filter((q) => q.status === 'open') : questions;

  const sendReply = async (e) => {
    e.preventDefault();
    setReplyErr('');
    if (replyBody.trim().length < 2) return setReplyErr('Reply cannot be empty.');
    setBusy(true);
    try {
      await api(`/questions/${replyTo.id}/replies`, { method: 'POST', body: { body: replyBody.trim() } });
      setReplyTo(null);
      setReplyBody('');
      load();
      toast.success('Reply sent — student notified.');
    } catch (err2) {
      setBusy(false);
      setReplyErr(err2.message);
    }
  };

  const toggleStatus = async (q) => {
    const next = q.status === 'open' ? 'answered' : 'open';
    try {
      await api(`/questions/${q.id}`, { method: 'PATCH', body: { status: next } });
      load();
    } catch (e2) { toast.error(e2.message); }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Student Doubts</h1>
          <p className="page-sub">Questions from students in your courses. Replying marks the doubt answered and notifies the student.</p>
        </div>
        <div className="tabs">
          <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open</button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty
          title={filter === 'open' ? 'No open doubts' : 'No doubts yet'}
          text={filter === 'open' ? 'All caught up! Switch to "All" to see answered questions.' : 'When students ask questions in your courses, they appear here.'}
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {visible.map((q) => (
            <Card
              key={q.id}
              title={q.title}
              sub={`${q.student_name} · ${q.course_code} — ${q.course_name} · ${timeAgo(q.created_at)}`}
              actions={<Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>}
            >
              <p style={{ whiteSpace: 'pre-wrap', marginBottom: 10 }}>{q.body}</p>

              {q.replies.length > 0 && (
                <div className="stack" style={{ gap: 8, margin: '10px 0', borderLeft: '3px solid var(--blue-100, #dbeafe)', paddingLeft: 12 }}>
                  {q.replies.map((r) => (
                    <div key={r.id}>
                      <div className="small" style={{ fontWeight: 600 }}>
                        {r.author} <span className="muted">({r.role}) · {timeAgo(r.created_at)}</span>
                      </div>
                      <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-subtle btn-sm" onClick={() => { setReplyTo(q); setReplyBody(''); }}>
                  <MessageCircleQuestion size={14} /> Reply
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(q)}>
                  {q.status === 'open' ? <><CheckCircle2 size={14} /> Mark answered</> : <><RotateCcw size={14} /> Reopen</>}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!replyTo} onClose={() => setReplyTo(null)} title={`Reply — ${replyTo?.title || ''}`}>
        {replyTo && (
          <>
            <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 9, padding: 12, marginBottom: 12 }}>
              <div className="small muted">{replyTo.student_name} · {replyTo.course_code} · {timeAgo(replyTo.created_at)}</div>
              <div className="small" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{replyTo.body}</div>
            </div>
            {replyTo.replies.length > 0 && (
              <div className="small muted" style={{ marginBottom: 10 }}>
                {replyTo.replies.length} earlier {replyTo.replies.length === 1 ? 'reply' : 'replies'} on this question.
              </div>
            )}
            <form onSubmit={sendReply}>
              <Field label="Your answer">
                <textarea className="input" rows={5} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} maxLength={3000} autoFocus placeholder="Explain the concept, share references, or point to your notes…" />
              </Field>
              {replyErr && <p className="field-error">{replyErr}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setReplyTo(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}><Send size={14} /> {busy ? 'Sending…' : 'Send reply'}</button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
