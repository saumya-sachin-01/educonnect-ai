import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ClipboardList, LibraryBig, Bell, Award, Megaphone, MessageCircle,
  HelpCircle, CheckCheck, Save,
} from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import {
  useToast, Card, Badge, Empty, Spinner, Modal, Field, Avatar, fmtDate, timeAgo,
} from '../../ui.jsx';

/* ----------------------------- Courses ----------------------------- */

export function StudentCourses() {
  const toast = useToast();
  const [courses, setCourses] = useState(null);
  const [open, setOpen] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    api('/courses')
      .then((d) => { if (alive) setCourses(d.courses); })
      .catch((err) => { if (alive) toast.error(err.message); });
    return () => { alive = false; };
  }, []);

  const openCourse = async (id) => {
    setDetailLoading(true);
    try {
      const d = await api(`/courses/${id}`);
      setOpen(d);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My courses</h1>
          <p className="page-sub">Everything you are enrolled in this term. Open a course to see classmates and assignments.</p>
        </div>
      </div>

      {!courses ? (
        <Spinner label="Loading your courses…" />
      ) : courses.length === 0 ? (
        <div className="card">
          <Empty title="No enrollments yet" text="Once you are enrolled in a course, it will appear here." />
        </div>
      ) : (
        <div className="grid grid-3">
          {courses.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onClick={() => openCourse(c.id)}
            >
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge tone="violet">{c.code}</Badge>
                  <span className="small muted" style={{ display: 'inline-flex', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} /> {c.student_count}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ClipboardList size={13} /> {c.assignment_count}
                    </span>
                  </span>
                </div>
                <h3 style={{ fontSize: 15.5, margin: '12px 0 3px' }}>{c.name}</h3>
                <p className="small muted">{c.subject_name} · {c.faculty_name}</p>
                {c.description && (
                  <p className="small muted" style={{ marginTop: 8 }}>
                    {c.description.length > 130 ? `${c.description.slice(0, 129)}…` : c.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {detailLoading && <Spinner label="Loading course…" />}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${open.course.name} (${open.course.code})` : 'Course'}
        wide
      >
        {open && (
          <>
            <div className="chip-row" style={{ marginBottom: 12 }}>
              <Badge tone="violet">{open.course.code}</Badge>
              <Badge tone="gray">{open.course.subject_name}</Badge>
              <span className="small muted">Faculty: {open.course.faculty_name}</span>
            </div>
            {open.course.description && (
              <p className="small muted" style={{ marginBottom: 16 }}>{open.course.description}</p>
            )}

            <h4 style={{ fontSize: 13.5, margin: '0 0 8px' }}>Enrolled students ({open.students.length})</h4>
            {open.students.length === 0 ? (
              <p className="small muted" style={{ marginBottom: 16 }}>No students enrolled yet.</p>
            ) : (
              <div
                className="table-wrap"
                style={{ border: '1px solid var(--line)', borderRadius: 10, marginBottom: 18 }}
              >
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Email</th></tr>
                  </thead>
                  <tbody>
                    {open.students.map((s) => (
                      <tr key={s.id}>
                        <td className="t-main">{s.name}</td>
                        <td className="t-sub">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4 style={{ fontSize: 13.5, margin: '0 0 8px' }}>Assignments ({open.assignments.length})</h4>
            {open.assignments.length === 0 ? (
              <p className="small muted">No assignments posted yet.</p>
            ) : (
              open.assignments.map((a) => (
                <div
                  key={a.id}
                  className="list-row"
                  style={{ padding: '9px 4px', borderBottom: '1px solid #eef2f7' }}
                >
                  <div className="t-main" style={{ flex: 1, minWidth: 0 }}>{a.title}</div>
                  <span className="small muted">{fmtDate(a.deadline)} · {a.max_marks} marks</span>
                </div>
              ))
            )}

            <p className="small muted" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <LibraryBig size={14} />
              {open.notes.length} study note{open.notes.length === 1 ? '' : 's'} published for this course
            </p>
          </>
        )}
      </Modal>
    </>
  );
}

/* ----------------------------- Notifications ----------------------------- */

const NOTIF_ICONS = {
  assignment: ClipboardList,
  grade: Award,
  announcement: Megaphone,
  reply: MessageCircle,
  note: LibraryBig,
  question: HelpCircle,
};

export function StudentNotifications() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api('/notifications')
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) toast.error(err.message); });
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const markAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      toast.success('All notifications marked as read.');
      const d = await api('/notifications');
      setData(d);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openNotif = async (n) => {
    if (!n.is_read) {
      try {
        await api(`/notifications/${n.id}/read`, { method: 'POST' });
      } catch {
        /* keep going — still navigate */
      }
      setData((d) => d && {
        ...d,
        unread: Math.max(0, d.unread - 1),
        notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)),
      });
    }
    if (n.link && n.link.startsWith(`/${user.role}`)) navigate(n.link);
  };

  const list = data?.notifications || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="page-sub">
            {data ? `${data.unread} unread of ${list.length} recent notifications.` : 'Stay on top of assignments, grades and replies.'}
          </p>
        </div>
        <button
          className="btn btn-subtle btn-sm"
          onClick={markAll}
          disabled={!data || data.unread === 0}
        >
          <CheckCheck size={15} /> Mark all read
        </button>
      </div>

      {!data ? (
        <Spinner label="Loading notifications…" />
      ) : list.length === 0 ? (
        <div className="card">
          <Empty title="No notifications" text="Assignment alerts, grades, announcements and replies will appear here." />
        </div>
      ) : (
        <Card pad={false}>
          {list.map((n) => {
            const Icon = NOTIF_ICONS[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`list-row ${n.is_read ? '' : 'notif-unread'}`}
                style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                onClick={() => openNotif(n)}
              >
                <span
                  style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: n.is_read ? '#f1f5f9' : 'var(--blue-50)',
                    color: n.is_read ? 'var(--ink-400)' : 'var(--blue-600)',
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  <Icon size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-main">{n.title}</div>
                  <div className="t-sub">{n.body}</div>
                </div>
                <span className="small muted" style={{ whiteSpace: 'nowrap', paddingTop: 2 }}>
                  {timeAgo(n.created_at)}
                </span>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}

/* ----------------------------- Profile ----------------------------- */

export function StudentProfile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return toast.error('Name must be at least 2 characters.');
    if (password && password.length < 6) {
      return toast.error('New password must be at least 6 characters.');
    }
    if (password && password !== confirm) return toast.error('Passwords do not match.');
    const body = {};
    if (trimmed !== user.name) body.name = trimmed;
    if (password) body.password = password;
    if (Object.keys(body).length === 0) return toast.error('Nothing to update — make a change first.');
    setBusy(true);
    try {
      await api('/auth/profile', { method: 'PATCH', body });
      await refresh();
      setPassword('');
      setConfirm('');
      toast.success('Profile updated.');
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
          <h1>Profile</h1>
          <p className="page-sub">Your account details and preferences.</p>
        </div>
      </div>

      <div className="grid grid-32">
        <Card pad={false}>
          <div className="card-body" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <Avatar name={user.name} size={88} />
            <h3 style={{ fontSize: 17, marginTop: 14 }}>{user.name}</h3>
            <p className="small muted" style={{ marginTop: 2 }}>{user.email}</p>
            <div className="chip-row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <Badge tone="blue">{user.role}</Badge>
            </div>
            <hr className="divider" />
            <p className="small muted">Member since {fmtDate(user.created_at)}</p>
          </div>
        </Card>

        <Card title="Edit profile" sub="Update your display name or set a new password.">
          <form onSubmit={submit}>
            <Field label="Full name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
            </Field>
            <Field
              label="New password"
              hint="Optional — leave blank to keep your current password. Minimum 6 characters."
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the new password"
                autoComplete="new-password"
              />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Save size={15} /> {busy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
