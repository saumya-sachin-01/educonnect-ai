# EduConnect AI — Intelligent Faculty–Student Academic Collaboration Platform

A complete, self-contained academic collaboration web app: three roles (Student / Faculty / Admin),
persistent SQLite storage, assignment workflow, notes, doubt discussion, announcements, notifications,
analytics, and a clearly-labeled **demo** study assistant.

> **DEMO MODE NOTICE** — This build is prepared for a live college presentation. All seeded people,
> courses, marks and messages are **fictional demo data**. Authentication is real (hashed passwords +
> signed session tokens), but it is a local demo deployment — not a hardened production service.

## Quick start

```bash
npm run setup     # install server + client dependencies (first time only)
npm run demo      # build the client, then start the app on http://localhost:4000
```

To re-seed the database with fresh fictional demo data:

```bash
npm run seed      # adds demo data only if the database is empty
node server/seed.js --reset   # wipes and recreates demo data (removes any test artifacts)
```

Then restart the app (`npm start`). The database file lives at `server/educonnect.db` — delete it and
run `--reset` for a completely fresh start.

**Frontend development mode (optional):** `npm start` in one terminal, `npm run dev` inside `client/`
in another — Vite serves the UI on http://localhost:5173 and proxies `/api` to the server.

## Demo credentials

| Role | Email | Password | One-click |
|---|---|---|---|
| Student | `aarav.patel@educonnect.demo` | `student123` | "Student" demo button on the login page |
| Faculty | `ram.sharma@educonnect.demo` | `faculty123` | "Faculty" demo button |
| Faculty 2 | `priya.nair@educonnect.demo` | `faculty123` | login form |
| Admin | `admin@educonnect.demo` | `admin123` | "Admin" demo button |
| Other students | `diya.singh@`, `kabir.khan@`, `meera.iyer@`, `rohan.verma@` …demo | `student123` | login form |

The login page also offers **one-click demo login** buttons for Student / Faculty / Admin, and a
registration form for creating new Student or Faculty accounts (passwords are scrypt-hashed, never stored in plaintext).

## Environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `EDUCONNECT_DB` | `server/educonnect.db` | SQLite database file location |
| `EDUCONNECT_SECRET` | auto-generated → `server/.auth_secret` | HMAC secret for session tokens |

No AI API keys are used or required. The Study Assistant is a **local rule-based fallback engine**;
every response is explicitly labeled "DEMO ASSISTANT". No live AI integration is claimed.

## Feature checklist

**Working & verified (backend verified by an automated 33-assertion smoke test; UI verified in browser):**
- Login / register / logout / role-based routing for all three roles; sessions persist across refresh
- Faculty: create / edit / delete own assignments (deadline + marks validation), grade submissions with feedback
- Student: view assignments, submit text answers, resubmit until graded, see marks + feedback
- Status lifecycle: pending → submitted → graded (+ overdue); duplicate-submission and past-deadline protection
- Notes (text-only), doubt discussion with faculty replies, announcements, in-app notifications (unread badge, mark read)
- Admin: user / course / subject / enrollment management, read-only assignments overview, activity log
- Dashboards & analytics computed from real stored data (recharts)
- Demo Study Assistant: chat KB, summarizer, question generator, grade-based revision topics

**Known limitations (by design for the 1-hour demo):**
- **No file uploads** — submissions and notes are text-only (the UI says so explicitly)
- Study Assistant is rule-based, **not** a live AI model
- No email/SMS/push — notifications are in-app only
- Demo-mode scope: no rate limiting, CSRF hardening, or HTTPS termination (local network demo)

## Smoke test

With the server running on :4000: `node server/smoke-test.mjs` — 33 assertions covering the full
assignment workflow, permissions (cross-faculty 403s, student 403s), validation errors, and admin CRUD.

## 3-minute presentation script

1. **(0:00)** "EduConnect AI connects faculty and students in one academic workspace." Open the login
   page — point out the three demo buttons and the DEMO MODE label.
2. **(0:20)** Click **Student**. Walk the dashboard: real stats, deadlines, announcements, performance
   chart. Open Assignments → open a pending one → submit an answer live.
3. **(1:00)** One-click back to login → **Faculty**. Open the same assignment — the student's
   submission is there. Grade it with marks + feedback, show the notification badge appear.
4. **(1:40)** Back to **Student**: the grade, feedback and unread notification are visible. Show Notes,
   Doubt discussion (ask a question), and the demo Study Assistant summarizing pasted notes.
5. **(2:20)** One-click → **Admin**: totals, create a user/course, activity log. Close with: "Everything
   you saw is stored in a real database and survives refreshes and restarts — and all of it is clearly
   labeled demo data."
