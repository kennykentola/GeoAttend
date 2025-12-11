import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import ProtectedRoute from './src/components/common/ProtectedRoute';
import Login from './src/pages/auth/Login';
import Register from './src/pages/auth/Register';
import ForgotPassword from './src/pages/auth/ForgotPassword';
import ResetPassword from './src/pages/auth/ResetPassword';
import TakeAttendance from './src/pages/student/TakeAttendance';
import CourseDetail from './src/pages/lecturer/CourseDetail';
import SessionAttendance from './src/pages/lecturer/SessionAttendance';
import { UserRole } from './types';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
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

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;