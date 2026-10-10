import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, X, Inbox } from 'lucide-react';

/* ---------------- Toasts ---------------- */

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((type, msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
            <span>{t.msg}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------- Date helpers ---------------- */

export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).length === 19 ? 'Z' : ''));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).length === 19 ? 'Z' : ''));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).length === 19 ? 'Z' : ''));
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return fmtDate(s);
}

export function deadlineInfo(deadline) {
  const d = new Date(String(deadline).replace(' ', 'T') + 'Z');
  const ms = d.getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (ms < 0) return { label: 'Overdue', tone: 'red' };
  if (days <= 1) return { label: 'Due today', tone: 'red' };
  if (days <= 3) return { label: `Due in ${days} days`, tone: 'amber' };
  return { label: `Due in ${days} days`, tone: 'green' };
}

/* ---------------- Primitives ---------------- */

export function Card({ title, sub, actions, children, pad = true }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : 'card-body card-body-flush'}>{children}</div>
    </section>
  );
}

export function Stat({ icon: Icon, label, value, hint, tone = 'blue' }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon">{Icon && <Icon size={20} />}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

const TONES = { blue: 'b-blue', violet: 'b-violet', green: 'b-green', amber: 'b-amber', red: 'b-red', gray: 'b-gray' };

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge ${TONES[tone] || 'b-gray'}`}>{children}</span>;
}

export const STATUS_TONE = { pending: 'amber', submitted: 'blue', graded: 'green', overdue: 'red', open: 'amber', answered: 'green', read: 'gray' };

export function Empty({ title = 'Nothing here yet', text = 'When data appears, it will show up in this space.', action }) {
  return (
    <div className="empty">
      <Inbox size={30} strokeWidth={1.5} />
      <h4>{title}</h4>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <input
      className="input search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export function Avatar({ name, size = 34 }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  );
}
