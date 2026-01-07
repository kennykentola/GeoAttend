import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import TakeAttendance from './pages/student/TakeAttendance';
import StudentDashboard from './pages/student/StudentDashboard';
import CourseDetail from './pages/lecturer/CourseDetail';
import SessionAttendance from './pages/lecturer/SessionAttendance';
import AdminDashboard from './pages/admin/AdminDashboard';
import Home from './pages/Home';
import { UserRole } from './types';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Student Authority Grid */}
            <Route element={<ProtectedRoute allowedRoles={[UserRole.STUDENT]} />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/attendance" element={<TakeAttendance />} />
            </Route>
            
            {/* Faculty Authority Grid */}
            <Route element={<ProtectedRoute allowedRoles={[UserRole.LECTURER]} />}>
              <Route path="/lecturer/dashboard" element={<CourseDetail />} />
              <Route path="/lecturer/session/:sessionId" element={<SessionAttendance />} />
            </Route>
            
            {/* Administrative Oversight */}
            <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;