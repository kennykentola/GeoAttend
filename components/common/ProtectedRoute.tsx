import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="relative">
            <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-indigo-400 font-bold uppercase tracking-widest text-[9px] animate-pulse">Security Handshake...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const userRoles = user.roles || [];
    const hasPermission = userRoles.some(role => allowedRoles.includes(role as UserRole));
    
    if (!hasPermission) {
        let redirectPath = '/login';
        if (userRoles.includes(UserRole.ADMIN)) {
            redirectPath = '/admin/dashboard';
        } else if (userRoles.includes(UserRole.LECTURER)) {
            redirectPath = '/lecturer/dashboard';
        } else {
            redirectPath = '/student/dashboard';
        }
        
        return <Navigate to={redirectPath} replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;