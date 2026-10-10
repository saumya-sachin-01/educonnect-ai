import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, ClipboardList, Inbox, CheckCircle2, MessageCircleQuestion,
  ArrowRight, Activity,
} from 'lucide-react';
import { api } from '../../api.js';
import { Card, Stat, Badge, STATUS_TONE, Empty, Spinner, timeAgo } from '../../ui.jsx';

export function FacultyDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/dashboard').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Empty title="Could not load your dashboard" text={err} />;
  if (!data) return <Spinner label="Loading your dashboard…" />;

  const { stats, perCourse, recent_submissions, recent_questions, recent_activity } = data;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Faculty Dashboard</h1>
          <p className="page-sub">Your teaching overview — courses, grading queue and student doubts.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Stat icon={Users} label="Students taught" value={stats.total_students} tone="blue" />
        <Stat icon={BookOpen} label="Courses" value={stats.courses} tone="violet" />
        <Stat icon={ClipboardList} label="Assignments" value={stats.assignments} tone="blue" />
        <Stat
          icon={Inbox}
          label="Waiting for grade"
          value={stats.pending_submissions}
          tone={stats.pending_submissions > 0 ? 'amber' : 'green'}
          hint={`${stats.graded_submissions} graded so far`}
        />
        <Stat
          icon={MessageCircleQuestion}
          label="Open doubts"
          value={stats.open_questions}
          tone={stats.open_questions > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="grid-2">
        <Card title="Courses you teach" sub="Enrollment and submission progress">
          {perCourse.length === 0 ? (
            <Empty title="No courses assigned yet" text="Ask the admin to assign courses to you." />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {perCourse.map((c) => (
                <div key={c.id} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="small muted mono">{c.code}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="small">{c.students} students · {c.assignments} assignments</div>
                    <div className="small muted">{c.graded}/{c.submissions || 0} submissions graded</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Recent submissions"
          sub="Latest answers from your students"
          actions={<Link className="btn btn-ghost btn-sm" to="/faculty/assignments">Grade now <ArrowRight size={14} /></Link>}
        >
          {recent_submissions.length === 0 ? (
            <Empty title="No submissions yet" text="When students submit, they appear here for grading." />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {recent_submissions.map((s) => (
                <div key={s.id} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/faculty/assignments/${s.assignment_id}`} style={{ fontWeight: 600, color: 'inherit' }}>
                      {s.assignment_title}
                    </Link>
                    <div className="small muted">{s.student_name} · {timeAgo(s.submitted_at)}</div>
                  </div>
                  <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card
          title="Student doubts"
          sub="Open questions from your courses"
          actions={<Link className="btn btn-ghost btn-sm" to="/faculty/doubts">Reply <ArrowRight size={14} /></Link>}
        >
          {recent_questions.length === 0 ? (
            <Empty title="No doubts yet" text="Student questions will show up here." />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {recent_questions.map((q) => (
                <div key={q.id} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{q.title}</div>
                    <div className="small muted">{q.student_name} · {q.course_code} · {timeAgo(q.created_at)}</div>
                  </div>
                  <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Your recent activity" sub="Actions you performed, newest first">
          {recent_activity.length === 0 ? (
            <Empty title="No activity yet" text="Your actions (creating assignments, grading) are logged here." />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {recent_activity.map((a, i) => (
                <div key={i} className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}><Activity size={12} style={{ verticalAlign: '-2px' }} /> {a.action}</div>
                    <div className="small muted">{a.detail}</div>
                  </div>
                  <span className="small muted">{timeAgo(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
