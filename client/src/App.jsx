import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Spinner } from './ui.jsx';
import Layout from './layout.jsx';
import { LoginPage, RegisterPage } from './pages/Login.jsx';

// Student pages
const StudentDashboard = lazy(() => import('./pages/student/Dashboard.jsx').then((m) => ({ default: m.StudentDashboard })));
const StudentAssignments = lazy(() => import('./pages/student/Assignments.jsx').then((m) => ({ default: m.StudentAssignments })));
const StudentAssignmentDetail = lazy(() => import('./pages/student/Assignments.jsx').then((m) => ({ default: m.StudentAssignmentDetail })));
const StudentNotes = lazy(() => import('./pages/student/Learning.jsx').then((m) => ({ default: m.StudentNotes })));
const StudentDoubts = lazy(() => import('./pages/student/Learning.jsx').then((m) => ({ default: m.StudentDoubts })));
const StudentAssistant = lazy(() => import('./pages/student/Learning.jsx').then((m) => ({ default: m.StudentAssistant })));
const StudentCourses = lazy(() => import('./pages/student/General.jsx').then((m) => ({ default: m.StudentCourses })));
const StudentNotifications = lazy(() => import('./pages/student/General.jsx').then((m) => ({ default: m.StudentNotifications })));
const StudentProfile = lazy(() => import('./pages/student/General.jsx').then((m) => ({ default: m.StudentProfile })));

// Faculty pages
const FacultyDashboard = lazy(() => import('./pages/faculty/Dashboard.jsx').then((m) => ({ default: m.FacultyDashboard })));
const FacultyAssignments = lazy(() => import('./pages/faculty/Assignments.jsx').then((m) => ({ default: m.FacultyAssignments })));
const FacultyAssignmentDetail = lazy(() => import('./pages/faculty/Assignments.jsx').then((m) => ({ default: m.FacultyAssignmentDetail })));
const FacultyNotes = lazy(() => import('./pages/faculty/Teaching.jsx').then((m) => ({ default: m.FacultyNotes })));
const FacultyAnnouncements = lazy(() => import('./pages/faculty/Teaching.jsx').then((m) => ({ default: m.FacultyAnnouncements })));
const FacultyDoubts = lazy(() => import('./pages/faculty/Teaching.jsx').then((m) => ({ default: m.FacultyDoubts })));
const FacultyAnalytics = lazy(() => import('./pages/faculty/Insights.jsx').then((m) => ({ default: m.FacultyAnalytics })));
const FacultyCourses = lazy(() => import('./pages/faculty/Insights.jsx').then((m) => ({ default: m.FacultyCourses })));
const FacultyProfile = lazy(() => import('./pages/faculty/Insights.jsx').then((m) => ({ default: m.FacultyProfile })));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m.AdminUsers })));
const AdminCourses = lazy(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m.AdminCourses })));
const AdminSubjects = lazy(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m.AdminSubjects })));
const AdminAssignments = lazy(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m.AdminAssignments })));
const AdminActivity = lazy(() => import('./pages/admin/Admin.jsx').then((m) => ({ default: m.AdminActivity })));

const HOME = { student: '/student/dashboard', faculty: '/faculty/dashboard', admin: '/admin/dashboard' };

function Guard({ role, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="auth-wrap"><div className="auth-form-side"><Spinner label="Restoring your session…" /></div></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={user ? HOME[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner label="Loading page…" />}>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<Guard><Layout /></Guard>}>
          <Route path="/student" element={<Guard role="student"><Outlet /></Guard>}>
            <Route index element={<Navigate to="/student/dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="courses" element={<StudentCourses />} />
            <Route path="assignments" element={<StudentAssignments />} />
            <Route path="assignments/:id" element={<StudentAssignmentDetail />} />
            <Route path="notes" element={<StudentNotes />} />
            <Route path="doubts" element={<StudentDoubts />} />
            <Route path="assistant" element={<StudentAssistant />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="profile" element={<StudentProfile />} />
          </Route>
          <Route path="/faculty" element={<Guard role="faculty"><Outlet /></Guard>}>
            <Route index element={<Navigate to="/faculty/dashboard" replace />} />
            <Route path="dashboard" element={<FacultyDashboard />} />
            <Route path="courses" element={<FacultyCourses />} />
            <Route path="assignments" element={<FacultyAssignments />} />
            <Route path="assignments/:id" element={<FacultyAssignmentDetail />} />
            <Route path="notes" element={<FacultyNotes />} />
            <Route path="doubts" element={<FacultyDoubts />} />
            <Route path="announcements" element={<FacultyAnnouncements />} />
            <Route path="analytics" element={<FacultyAnalytics />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="profile" element={<FacultyProfile />} />
          </Route>
          <Route path="/admin" element={<Guard role="admin"><Outlet /></Guard>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="subjects" element={<AdminSubjects />} />
            <Route path="assignments" element={<AdminAssignments />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="activity" element={<AdminActivity />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
