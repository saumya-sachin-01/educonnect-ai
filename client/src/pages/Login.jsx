import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  GraduationCap, Sparkles, ClipboardList, LineChart, MessagesSquare, Bot,
  Shield, User, Presentation, ArrowRight, Loader2,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useToast, Field, Spinner } from '../ui.jsx';

const HOME = { student: '/student/dashboard', faculty: '/faculty/dashboard', admin: '/admin/dashboard' };
const ROLE_TONE = { student: 'blue', faculty: 'violet', admin: 'amber' };

function HeroPanel() {
  return (
    <div className="auth-hero">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
        <span style={{
          width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#fff',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 8px 20px rgba(37,99,235,0.35)',
        }}>
          <GraduationCap size={24} />
        </span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>EduConnect AI</div>
          <div style={{ color: '#93a5c9', fontSize: 10.5, letterSpacing: '0.14em' }}>ACADEMIC COLLABORATION</div>
        </div>
      </div>
      <h1>Where faculty and students build knowledge together.</h1>
      <p>Assignments, grading, study notes, doubt discussion and analytics — one connected workspace for your institution.</p>
      <div className="auth-points">
        <div className="auth-point">
          <span className="ap-icon"><ClipboardList size={17} /></span>
          <div><b>End-to-end assignment workflow</b><span>Create, submit and grade — with deadlines, marks and feedback.</span></div>
        </div>
        <div className="auth-point">
          <span className="ap-icon"><MessagesSquare size={17} /></span>
          <div><b>Doubt discussion that gets answered</b><span>Students ask per-course questions; faculty reply and resolve them.</span></div>
        </div>
        <div className="auth-point">
          <span className="ap-icon"><LineChart size={17} /></span>
          <div><b>Real academic analytics</b><span>Performance charts computed from actual submissions and grades.</span></div>
        </div>
        <div className="auth-point">
          <span className="ap-icon"><Bot size={17} /></span>
          <div><b>Study assistant</b><span>Summaries, revision questions and topic suggestions from your own data.</span></div>
        </div>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 30, position: 'relative', zIndex: 1 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em',
          color: '#c4b5fd', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(139,92,246,0.4)',
          padding: '6px 12px', borderRadius: 999,
        }}>
          <Sparkles size={13} /> DEMO MODE — FICTIONAL DATA
        </span>
        <p style={{ fontSize: 12, marginTop: 10 }}>All people, courses and marks in this build are fictional demo data for presentation purposes.</p>
      </div>
    </div>
  );
}

function DemoButtons({ busyRole, onDemo }) {
  const roles = [
    { role: 'student', label: 'Student', icon: <User size={15} /> },
    { role: 'faculty', label: 'Faculty', icon: <Presentation size={15} /> },
    { role: 'admin', label: 'Admin', icon: <Shield size={15} /> },
  ];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 2px' }}>
        <span className="small" style={{ color: 'var(--violet-600)', fontWeight: 700, letterSpacing: '0.06em' }}>DEMO ACCESS</span>
        <hr className="divider" style={{ flex: 1, margin: 0 }} />
      </div>
      <div className="demo-grid">
        {roles.map((r) => (
          <button key={r.role} type="button" className="demo-btn" disabled={!!busyRole} onClick={() => onDemo(r.role)}>
            {busyRole === r.role ? <Loader2 size={15} className="spin" /> : r.icon}
            {r.label}
          </button>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        One-click demo login (aarav.patel@educonnect.demo · ram.sharma@educonnect.demo · admin@educonnect.demo). Passwords: student123 / faculty123 / admin123.
      </p>
    </>
  );
}

export function LoginPage() {
  const { user, loading, login, demoLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyRole, setBusyRole] = useState(null);
  const [errors, setErrors] = useState({});

  if (loading) return <div className="auth-wrap"><div className="auth-form-side"><Spinner label="Restoring your session…" /></div></div>;
  if (user) return <Navigate to={HOME[user.role]} replace />;

  const go = (u) => navigate(HOME[u.role], { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (password.length < 1) errs.password = 'Password is required.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const d = await login(email.trim(), password);
      toast.success(`Welcome back, ${d.user.name.split(' ')[0]}.`);
      go(d.user);
    } catch (err) {
      toast.error(err.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const demo = async (role) => {
    setBusyRole(role);
    try {
      const d = await demoLogin(role);
      toast.success(`Signed in as ${d.user.name} (${d.user.role}).`);
      go(d.user);
    } catch (err) {
      toast.error(err.message || 'Demo login failed. Is the database seeded?');
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <div className="auth-wrap">
      <HeroPanel />
      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Sign in</h2>
          <p className="auth-sub">Use your EduConnect AI account, or one-click into a demo role below.</p>
          <form onSubmit={submit} noValidate>
            <Field label="Email" error={errors.email}>
              <input className="input" type="email" value={email} autoComplete="email"
                placeholder="you@educonnect.demo" onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" error={errors.password}>
              <input className="input" type="password" value={password} autoComplete="current-password"
                placeholder="Your password" onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
              {busy ? <><Loader2 size={16} className="spin" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>
          <DemoButtons busyRole={busyRole} onDemo={demo} />
          <p className="auth-foot">New here? <Link to="/register">Create a student or faculty account</Link></p>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'student' });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  if (loading) return <div className="auth-wrap"><div className="auth-form-side"><Spinner label="Loading…" /></div></div>;
  if (user) return <Navigate to={HOME[user.role]} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (form.password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const d = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
      toast.success(`Account created. Welcome, ${d.user.name.split(' ')[0]}.`);
      navigate(HOME[d.user.role], { replace: true });
    } catch (err) {
      toast.error(err.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <HeroPanel />
      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Create your account</h2>
          <p className="auth-sub">Students and faculty can self-register. Admin accounts are provisioned by the administrator.</p>
          <form onSubmit={submit} noValidate>
            <Field label="I am a" hint="Admin accounts are created from the Admin panel only.">
              <div className="chip-row" role="radiogroup" aria-label="Account role">
                {['student', 'faculty'].map((r) => (
                  <button key={r} type="button" className={`btn ${form.role === r ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                    style={{ textTransform: 'capitalize' }} onClick={() => setForm({ ...form, role: r })}>
                    {r === 'student' ? <User size={14} /> : <Presentation size={14} />} {r}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Full name" error={errors.name}>
              <input className="input" value={form.name} placeholder="e.g. Ananya Rao" onChange={set('name')} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className="input" type="email" value={form.email} autoComplete="email" placeholder="you@college.edu" onChange={set('email')} />
            </Field>
            <div className="form-row">
              <Field label="Password" error={errors.password}>
                <input className="input" type="password" value={form.password} autoComplete="new-password" placeholder="Min 6 characters" onChange={set('password')} />
              </Field>
              <Field label="Confirm" error={errors.confirm}>
                <input className="input" type="password" value={form.confirm} autoComplete="new-password" placeholder="Repeat password" onChange={set('confirm')} />
              </Field>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
              {busy ? <><Loader2 size={16} className="spin" /> Creating account…</> : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>
          <p className="auth-foot">Already registered? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
