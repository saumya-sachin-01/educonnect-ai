import { useEffect, useMemo, useState } from 'react';
import {
  Users, UserCog, BookOpen, Layers, ClipboardList, FileUp, ClipboardCheck,
  MessageCircleQuestion, UserPlus, Trash2, Pencil, FolderPlus, Plus, SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import {
  useToast, Card, Stat, Badge, Empty, Spinner, Modal, Field, SearchInput, Avatar,
  fmtDate, fmtDateTime, timeAgo, deadlineInfo,
} from '../../ui.jsx';

const ROLE_TONE = { student: 'blue', faculty: 'violet', admin: 'gray' };

/* ================= DASHBOARD ================= */

export function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [byCourse, setByCourse] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [dash, asg] = await Promise.all([api('/dashboard'), api('/assignments')]);
        if (!alive) return;
        setStats(dash.stats);
        setActivity(dash.recent_activity || []);
        const map = new Map();
        for (const a of asg.assignments || []) {
          const key = a.course_code || '—';
          const cur = map.get(key) || { code: a.course_code || '—', name: a.course_name || 'Unknown course', count: 0 };
          cur.count += 1;
          map.set(key, cur);
        }
        setByCourse([...map.values()].sort((x, y) => y.count - x.count));
      } catch (err) {
        if (alive) toast.error(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p className="page-sub">Platform-wide overview of users, courses and academic activity.</p>
        </div>
      </div>

      <div className="stack">
        <div className="grid grid-4">
          <Stat icon={Users} label="Students" value={stats?.students ?? 0} tone="blue" />
          <Stat icon={UserCog} label="Faculty" value={stats?.faculty ?? 0} tone="violet" />
          <Stat icon={BookOpen} label="Courses" value={stats?.courses ?? 0} tone="green" />
          <Stat icon={Layers} label="Subjects" value={stats?.subjects ?? 0} tone="amber" />
        </div>
        <div className="grid grid-4">
          <Stat icon={ClipboardList} label="Assignments" value={stats?.assignments ?? 0} tone="blue" />
          <Stat icon={FileUp} label="Submissions" value={stats?.submissions ?? 0} tone="violet" />
          <Stat icon={ClipboardCheck} label="Graded" value={stats?.graded ?? 0} tone="green" />
          <Stat icon={MessageCircleQuestion} label="Questions" value={stats?.questions ?? 0} tone="amber" />
        </div>

        <div className="grid grid-32">
          <Card title="Recent platform activity" sub="The latest actions recorded across EduConnect AI" pad={false}>
            {activity.length === 0 ? (
              <Empty title="No activity yet" text="Actions taken on the platform will show up here." />
            ) : (
              activity.map((a, i) => (
                <div className="list-row" key={i}>
                  <Avatar name={a.user_name || '?'} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{a.user_name || 'Unknown user'}</span>
                      {a.role && <Badge tone={ROLE_TONE[a.role] || 'gray'}>{a.role}</Badge>}
                    </div>
                    <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</div>
                  </div>
                  <span className="small muted" style={{ flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                </div>
              ))
            )}
          </Card>

          <Card title="Assignments by course" sub="Grouped live from the full assignments list" pad={false}>
            {byCourse.length === 0 ? (
              <Empty title="No assignments yet" text="Once faculty publish assignments, the per-course breakdown appears here." />
            ) : (
              byCourse.map((c) => (
                <div className="list-row" key={c.code}>
                  <Badge tone="blue">{c.code}</Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  </div>
                  <span className="small muted" style={{ flexShrink: 0 }}>{c.count} assignment{c.count === 1 ? '' : 's'}</span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ================= USERS ================= */

const USER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'admin', label: 'Admins' },
];

export function AdminUsers() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('all');
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let alive = true;
    setUsers(null);
    api(tab === 'all' ? '/users' : `/users?role=${tab}`)
      .then((d) => { if (alive) setUsers(d.users); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, [tab]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
  }, [users, q]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const reload = async () => {
    try {
      const d = await api(tab === 'all' ? '/users' : `/users?role=${tab}`);
      setUsers(d.users);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/users', {
        method: 'POST',
        body: { name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role },
      });
      toast.success(`Account created for ${form.name.trim()}`);
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', role: 'student' });
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    setDeleting(u.id);
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      toast.success(`${u.name} deleted`);
      setUsers((list) => list.filter((x) => x.id !== u.id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="page-sub">Provision accounts and manage access for everyone on the platform.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><UserPlus size={16} /> Add user</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="tabs">
          {USER_TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search name or email…" />
      </div>

      {users === null ? (
        <Spinner label="Loading users…" />
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            title={q ? 'No matches found' : 'No users in this view'}
            text={q ? `Nobody matches "${q}". Try a different search.` : 'Accounts created for this filter will appear here.'}
          />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Member since</th><th style={{ textAlign: 'right' }}>Action</th></tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={u.name} size={32} />
                        <span className="t-main">{u.name}</span>
                      </div>
                    </td>
                    <td className="t-sub">{u.email}</td>
                    <td><Badge tone={ROLE_TONE[u.role] || 'gray'}>{u.role}</Badge></td>
                    <td className="t-sub">{fmtDate(u.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {u.id !== user?.id && (
                        <button className="btn btn-danger btn-sm" disabled={deleting === u.id} onClick={() => remove(u)}>
                          <Trash2 size={13} /> {deleting === u.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showAdd} onClose={() => !busy && setShowAdd(false)} title="Add user">
        <form onSubmit={submit}>
          <Field label="Full name">
            <input value={form.name} onChange={setF('name')} placeholder="e.g. Aisha Khan" required minLength={2} maxLength={80} />
          </Field>
          <Field label="Email address">
            <input type="email" value={form.email} onChange={setF('email')} placeholder="name@college.edu" required />
          </Field>
          <Field label="Password" hint="Minimum 6 characters">
            <input type="password" value={form.password} onChange={setF('password')} placeholder="••••••••" required minLength={6} />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={setF('role')}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              <UserPlus size={15} /> {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ================= COURSES ================= */

const EMPTY_COURSE = { name: '', code: '', subject_id: '', faculty_id: '', description: '' };

export function AdminCourses() {
  const toast = useToast();
  const [courses, setCourses] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [modal, setModal] = useState(null); // { mode: 'add' } | { mode: 'edit', course } | { mode: 'manage', course }
  const [form, setForm] = useState(EMPTY_COURSE);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [enrollId, setEnrollId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const reload = async () => {
    try {
      const d = await api('/courses');
      setCourses(d.courses);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, s, f, st] = await Promise.all([
          api('/courses'), api('/subjects'), api('/users?role=faculty'), api('/users?role=student'),
        ]);
        if (!alive) return;
        setCourses(c.courses);
        setSubjects(s.subjects);
        setFaculty(f.users);
        setStudents(st.users);
      } catch (err) {
        if (alive) toast.error(err.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => {
    setForm(EMPTY_COURSE);
    setModal({ mode: 'add' });
  };

  const openEdit = (c) => {
    setForm({
      name: c.name,
      code: c.code,
      subject_id: String(c.subject_id ?? ''),
      faculty_id: String(c.faculty_id ?? ''),
      description: c.description || '',
    });
    setModal({ mode: 'edit', course: c });
  };

  const openManage = async (c) => {
    setModal({ mode: 'manage', course: c });
    setDetail(null);
    setDetailLoading(true);
    setEnrollId('');
    try {
      const d = await api(`/courses/${c.id}`);
      setDetail(d);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        subject_id: Number(form.subject_id),
        faculty_id: Number(form.faculty_id),
        description: form.description.trim(),
      };
      if (modal.mode === 'add') {
        await api('/courses', { method: 'POST', body });
        toast.success(`Course ${body.code.toUpperCase()} created`);
      } else {
        await api(`/courses/${modal.course.id}`, { method: 'PUT', body });
        toast.success(`Course ${body.code.toUpperCase()} updated`);
      }
      setModal(null);
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete course ${c.code} — ${c.name}? Its enrollments, assignments and notes will be removed.`)) return;
    setDeletingId(c.id);
    try {
      await api(`/courses/${c.id}`, { method: 'DELETE' });
      toast.success(`Course ${c.code} deleted`);
      if (modal?.mode === 'manage' && modal.course.id === c.id) setModal(null);
      setCourses((list) => list.filter((x) => x.id !== c.id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const refreshDetail = async () => {
    try {
      const d = await api(`/courses/${modal.course.id}`);
      setDetail(d);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const enroll = async () => {
    if (!enrollId) return;
    setEnrolling(true);
    try {
      await api(`/courses/${modal.course.id}/enroll`, { method: 'POST', body: { student_id: Number(enrollId) } });
      toast.success('Student enrolled');
      setEnrollId('');
      await refreshDetail();
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const enrolledIds = new Set((detail?.students || []).map((s) => s.id));
  const available = students.filter((s) => !enrolledIds.has(s.id));
  const editing = modal?.mode === 'add' || modal?.mode === 'edit';

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Courses</h1>
          <p className="page-sub">Create courses, assign faculty and manage student enrollments.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><FolderPlus size={16} /> Add course</button>
      </div>

      {courses === null ? (
        <Spinner label="Loading courses…" />
      ) : courses.length === 0 ? (
        <Card>
          <Empty title="No courses yet" text="Create your first course to start enrolling students and assigning faculty." action={<button className="btn btn-primary" onClick={openAdd}><FolderPlus size={15} /> Add course</button>} />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Course</th><th>Subject</th><th>Faculty</th><th>Students</th><th>Assignments</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Badge tone="blue">{c.code}</Badge>
                        <span className="t-main">{c.name}</span>
                      </div>
                    </td>
                    <td className="t-sub">{c.subject_name}</td>
                    <td className="t-sub">{c.faculty_name}</td>
                    <td className="t-sub">{c.student_count}</td>
                    <td className="t-sub">{c.assignment_count}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Pencil size={13} /> Edit</button>
                        <button className="btn btn-subtle btn-sm" onClick={() => openManage(c)}><SlidersHorizontal size={13} /> Manage</button>
                        <button className="btn btn-danger btn-sm" disabled={deletingId === c.id} onClick={() => remove(c)}>
                          <Trash2 size={13} /> {deletingId === c.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={editing} onClose={() => !busy && setModal(null)} title={modal?.mode === 'edit' ? `Edit course ${modal.course.code}` : 'Add course'} wide>
        <form onSubmit={submit}>
          <div className="form-row">
            <Field label="Course name">
              <input value={form.name} onChange={setF('name')} placeholder="e.g. Data Structures" required />
            </Field>
            <Field label="Course code">
              <input value={form.code} onChange={setF('code')} placeholder="e.g. CS201" required />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Subject">
              <select value={form.subject_id} onChange={setF('subject_id')} required>
                <option value="">Choose a subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </Field>
            <Field label="Faculty">
              <select value={form.faculty_id} onChange={setF('faculty_id')} required>
                <option value="">Choose faculty…</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description" hint="Optional — a short summary shown to students.">
            <textarea value={form.description} onChange={setF('description')} placeholder="What this course covers…" maxLength={500} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : modal?.mode === 'edit' ? 'Save changes' : 'Create course'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === 'manage'} onClose={() => setModal(null)} title={`Course overview — ${modal?.course?.code || ''}`} wide>
        {detailLoading || !detail ? (
          <Spinner label="Loading course…" />
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone="blue">{detail.course.code}</Badge>
                <span className="small muted">{detail.course.subject_name} · Faculty: {detail.course.faculty_name}</span>
              </div>
              {detail.course.description
                ? <p className="small muted" style={{ marginTop: 8 }}>{detail.course.description}</p>
                : <p className="small muted" style={{ marginTop: 8 }}>No description provided.</p>}
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <div>
              <h4 style={{ fontSize: 13.5 }}>Enrolled students ({detail.students.length})</h4>
              {detail.students.length === 0 ? (
                <p className="small muted" style={{ marginTop: 6 }}>No students enrolled yet.</p>
              ) : (
                <div className="table-wrap" style={{ marginTop: 8, border: '1px solid var(--line)', borderRadius: 10 }}>
                  <table className="table">
                    <thead>
                      <tr><th>Student</th><th>Email</th></tr>
                    </thead>
                    <tbody>
                      {detail.students.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={s.name} size={30} />
                              <span className="t-main">{s.name}</span>
                            </div>
                          </td>
                          <td className="t-sub">{s.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <span className="field-label">Enroll a student</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <select className="input" style={{ flex: 1 }} value={enrollId} onChange={(e) => setEnrollId(e.target.value)}>
                  <option value="">Choose a student…</option>
                  {available.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}
                </select>
                <button className="btn btn-primary" disabled={enrolling || !enrollId} onClick={enroll}>
                  <UserPlus size={15} /> {enrolling ? 'Enrolling…' : 'Enroll student'}
                </button>
              </div>
              {available.length === 0 && <p className="small muted" style={{ marginTop: 6 }}>Every student is already enrolled in this course.</p>}
            </div>

            <hr className="divider" style={{ margin: 0 }} />

            <div className="grid grid-2" style={{ gap: 14 }}>
              <div>
                <h4 style={{ fontSize: 13.5 }}>Assignments ({detail.assignments.length})</h4>
                {detail.assignments.length === 0 ? (
                  <p className="small muted" style={{ marginTop: 6 }}>No assignments posted.</p>
                ) : (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {detail.assignments.map((a) => {
                      const dl = deadlineInfo(a.deadline);
                      return (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span className="small" style={{ fontWeight: 600 }}>{a.title}</span>
                          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <Badge tone={dl.tone}>{dl.label}</Badge>
                            <span className="small muted">{a.max_marks} marks</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <h4 style={{ fontSize: 13.5 }}>Notes ({detail.notes.length})</h4>
                {detail.notes.length === 0 ? (
                  <p className="small muted" style={{ marginTop: 6 }}>No notes uploaded.</p>
                ) : (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    {detail.notes.map((n) => (
                      <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span className="small" style={{ fontWeight: 600 }}>{n.title}</span>
                        <span className="small muted">{fmtDate(n.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================= SUBJECTS ================= */

export function AdminSubjects() {
  const toast = useToast();
  const [subjects, setSubjects] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/subjects')
      .then((d) => { if (alive) setSubjects(d.subjects); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, []);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/subjects', { method: 'POST', body: { name: form.name.trim(), code: form.code.trim() } });
      toast.success(`Subject ${form.code.trim().toUpperCase()} added`);
      setForm({ name: '', code: '' });
      const d = await api('/subjects');
      setSubjects(d.subjects);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete subject ${s.code} — ${s.name}?`)) return;
    setDeletingId(s.id);
    try {
      await api(`/subjects/${s.id}`, { method: 'DELETE' });
      toast.success(`Subject ${s.code} deleted`);
      setSubjects((list) => list.filter((x) => x.id !== s.id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Subjects</h1>
          <p className="page-sub">Define the subjects that courses are organised under.</p>
        </div>
      </div>

      <div className="grid grid-23">
        <Card title="All subjects" sub={`${subjects?.length ?? 0} on the platform`} pad={false}>
          {subjects === null ? (
            <Spinner label="Loading subjects…" />
          ) : subjects.length === 0 ? (
            <Empty title="No subjects yet" text="Add your first subject using the form beside this list." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Code</th><th>Name</th><th>Created</th><th style={{ textAlign: 'right' }}>Action</th></tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td><Badge tone="violet">{s.code}</Badge></td>
                      <td className="t-main">{s.name}</td>
                      <td className="t-sub">{fmtDate(s.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-danger btn-sm" disabled={deletingId === s.id} onClick={() => remove(s)}>
                          <Trash2 size={13} /> {deletingId === s.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Add subject" sub="New subjects are available for courses immediately">
          <form onSubmit={submit}>
            <Field label="Subject name">
              <input value={form.name} onChange={setF('name')} placeholder="e.g. Computer Science" required maxLength={100} />
            </Field>
            <Field label="Subject code" hint="Max 20 characters — stored in uppercase.">
              <input value={form.code} onChange={setF('code')} placeholder="e.g. CS" required maxLength={20} />
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              <Plus size={15} /> {busy ? 'Adding…' : 'Add subject'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ================= ASSIGNMENTS ================= */

export function AdminAssignments() {
  const toast = useToast();
  const [assignments, setAssignments] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    api('/assignments')
      .then((d) => { if (alive) setAssignments(d.assignments); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!assignments) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return assignments;
    return assignments.filter((a) =>
      a.title.toLowerCase().includes(needle) ||
      (a.course_name || '').toLowerCase().includes(needle) ||
      (a.course_code || '').toLowerCase().includes(needle) ||
      (a.faculty_name || '').toLowerCase().includes(needle));
  }, [assignments, q]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Assignments Overview</h1>
          <p className="page-sub">Every assignment across all courses — read-only summary for administrators.</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search title, course or faculty…" />
      </div>

      {assignments === null ? (
        <Spinner label="Loading assignments…" />
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            title={q ? 'No matches found' : 'No assignments yet'}
            text={q ? `Nothing matches "${q}". Try a different search.` : 'Assignments published by faculty will appear here.'}
          />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Assignment</th><th>Faculty</th><th>Deadline</th><th>Class size</th><th>Submitted</th><th>Graded</th><th>Avg marks</th></tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const dl = deadlineInfo(a.deadline);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="t-main">{a.title}</div>
                        <div className="t-sub">{a.course_code} — {a.course_name}</div>
                      </td>
                      <td className="t-sub">{a.faculty_name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="t-sub">{fmtDate(a.deadline)}</span>
                          <Badge tone={dl.tone}>{dl.label}</Badge>
                        </div>
                      </td>
                      <td className="t-sub">{a.student_count}</td>
                      <td className="t-sub">{a.submitted_count}</td>
                      <td className="t-sub">{a.graded_count}</td>
                      <td className="t-sub">{a.avg_marks ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================= ACTIVITY ================= */

export function AdminActivity() {
  const toast = useToast();
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/activity')
      .then((d) => { if (alive) setActivity(d.activity); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Activity Overview</h1>
          <p className="page-sub">The latest events recorded across the platform, newest first.</p>
        </div>
      </div>

      <Card title="Platform activity" sub="Latest 100 events" pad={false}>
        {activity === null ? (
          <Spinner label="Loading activity…" />
        ) : activity.length === 0 ? (
          <Empty title="No activity recorded" text="User actions across the platform will be logged here." />
        ) : (
          activity.map((a) => (
            <div className="list-row" key={a.id}>
              <Avatar name={a.user_name || '?'} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{a.user_name || 'Unknown user'}</span>
                  {a.role && <Badge tone={ROLE_TONE[a.role] || 'gray'}>{a.role}</Badge>}
                  <span className="mono muted">{a.action}</span>
                </div>
                <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</div>
                <div className="small" style={{ color: 'var(--ink-400)' }}>{fmtDateTime(a.created_at)}</div>
              </div>
              <span className="small muted" style={{ flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
