import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import ProtectedRoute from './src/components/common/ProtectedRoute';
import Login from './src/pages/auth/Login';
import Register from './src/pages/auth/Register';
import ForgotPassword from './src/pages/auth/ForgotPassword';
import ResetPassword from './src/pages/auth/ResetPassword';
import TakeAttendance from './src/pages/student/TakeAttendance';
import CourseDetail from './src/pages/lecturer/CourseDetail';
import SessionAttendance from './src/pages/lecturer/SessionAttendance';
import AdminDashboard from './src/pages/admin/AdminDashboard';
import Home from './src/pages/Home';
import { UserRole } from './types';

const GlobalNavigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Hide on auth pages
  const hideOnPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
  if (hideOnPaths.includes(location.pathname)) return null;

  // Only show if user is logged in
  if (!user) return null;

  let dashboardPath = '/student/attendance';
  let dashboardLabel = 'Student Dashboard';
  let iconColor = 'text-teal-400';

  if (user.role === UserRole.ADMIN) {
    dashboardPath = '/admin/dashboard';
    dashboardLabel = 'Admin Dashboard';
    iconColor = 'text-red-400';
  } else if (user.role === UserRole.LECTURER) {
    dashboardPath = '/lecturer/dashboard';
    dashboardLabel = 'Lecturer Dashboard';
    iconColor = 'text-indigo-400';
  }

  // Check if we are currently ON the dashboard to highlight it? 
  // Maybe just a simple link is enough.

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 transition-all hover:bg-black/80 hover:scale-105">
        
        {/* Home Link */}
        <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2" title="Home">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </Link>
        
        <div className="h-4 w-px bg-white/20"></div>

        {/* Dynamic Role-Based Dashboard Link */}
        <Link to={dashboardPath} className="text-white font-medium hover:text-indigo-300 transition-colors flex items-center gap-2 group">
            <span className={`${iconColor} group-hover:text-white transition-colors`}>
              {user.role === UserRole.ADMIN && (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                 </svg>
              )}
              {user.role === UserRole.LECTURER && (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.216 50.59 50.59 0 00-2.658.812m-15.482 0a50.57 50.57 0 012.658.812m12.824 0a50.57 50.57 0 002.658-.812" />
                 </svg>
              )}
              {user.role === UserRole.STUDENT && (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                 </svg>
              )}
            </span>
            <span className="whitespace-nowrap">{dashboardLabel}</span>
        </Link>

        <div className="h-4 w-px bg-white/20"></div>

        {/* Logout */}
        <button onClick={() => logout()} className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2" title="Logout">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <GlobalNavigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Student Routes */}
            <Route element={<ProtectedRoute allowedRoles={[UserRole.STUDENT]} />}>
              <Route path="/student/attendance" element={<TakeAttendance />} />
            </Route>

            {/* Lecturer Routes */}
            <Route element={<ProtectedRoute allowedRoles={[UserRole.LECTURER]} />}>
              <Route path="/lecturer/dashboard" element={<CourseDetail />} />
              <Route path="/lecturer/session/:sessionId" element={<SessionAttendance />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>

            {/* Default Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;