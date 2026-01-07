
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <div className="text-xl font-semibold text-indigo-400 animate-pulse">Authenticating...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Fix: roles is now an array, check for any allowed role
  const userHasPermission = !allowedRoles || allowedRoles.some(role => user.roles.includes(role));

  if (!userHasPermission) {
    // Redirect to their appropriate dashboard if they access a forbidden route
    let redirectPath = '/login';
    if (user.roles.includes(UserRole.ADMIN)) redirectPath = '/admin/dashboard';
    else if (user.roles.includes(UserRole.LECTURER)) redirectPath = '/lecturer/dashboard';
    else redirectPath = '/student/attendance';
    
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
