import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Clock3, Send, Award, AlertTriangle, Megaphone,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import {
  useToast, Card, Stat, Badge, Empty, Spinner, STATUS_TONE, fmtDate, timeAgo, deadlineInfo,
} from '../../ui.jsx';

const num = (v) => v ?? 0;

export function StudentDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api('/dashboard')
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) toast.error(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <Spinner label="Loading your dashboard…" />;
  if (!data) return <Empty title="Could not load dashboard" text="Please refresh the page to try again." />;

  const { stats, upcoming, performance, announcements, unread } = data;
  const firstName = (user?.name || 'there').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const statCards = [
    { icon: ClipboardList, label: 'Total assignments', value: num(stats.total), tone: 'blue' },
    { icon: Clock3, label: 'Pending', value: num(stats.pending), tone: 'amber' },
    { icon: Send, label: 'Submitted', value: num(stats.submitted), tone: 'violet' },
    { icon: Award, label: 'Graded', value: num(stats.graded), tone: 'green' },
    { icon: AlertTriangle, label: 'Overdue', value: num(stats.overdue), tone: 'red' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p className="page-sub">
            {today}.{' '}
            {unread > 0
              ? `You have ${unread} unread notification${unread === 1 ? '' : 's'} waiting for you.`
              : 'You are all caught up.'}
          </p>
        </div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', marginBottom: 16 }}
      >
        {statCards.map((s) => (
          <Stat key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>

      <div className="grid grid-32">
        <Card title="Academic performance" sub="Your average marks in each course (graded work)">
          {performance.length === 0 ? (
            <Empty
              title="No grades yet"
              text="Once your submissions are graded, your course-wise performance will appear here."
            />
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performance} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis
                    dataKey="course"
                    tick={{ fontSize: 11, fill: 'var(--ink-500)' }}
                    tickFormatter={(v) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--ink-500)' }} />
                  <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }} />
                  <Bar dataKey="avg_pct" name="Average %" fill="var(--blue-600)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Upcoming deadlines" sub="Pending and overdue work, nearest first" pad={false}>
            {upcoming.length === 0 ? (
              <Empty title="Nothing due" text="No pending or overdue assignments right now. Nice work!" />
            ) : (
              upcoming.map((a) => {
                const dl = deadlineInfo(a.deadline);
                return (
                  <div
                    key={a.id}
                    className="list-row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/student/assignments/${a.id}`)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-main">{a.title}</div>
                      <div className="t-sub">
                        {a.course_code} · {fmtDate(a.deadline)}
                      </div>
                    </div>
                    <Badge tone={dl.tone}>{dl.label}</Badge>
                    <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                  </div>
                );
              })
            )}
          </Card>

          <Card title="Recent announcements" pad={false}>
            {announcements.length === 0 ? (
              <Empty title="No announcements" text="Course announcements from your faculty will appear here." />
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: 'var(--violet-50)', color: 'var(--violet-600)',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <Megaphone size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-main">
                      {a.title} <span className="small muted">· {timeAgo(a.created_at)}</span>
                    </div>
                    <div className="t-sub">{a.body}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
