import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import { UserRole } from '../../../types';

// Declare Jest globals to satisfy TypeScript compiler
declare const jest: any;
declare const describe: any;
declare const beforeEach: any;
declare const test: any;
declare const expect: any;

// Mock useAuth
const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockClear();
  });

  test('shows loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({ loading: true, user: null });
    
    render(
      <MemoryRouter>
        <ProtectedRoute />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading Auth.../i)).toBeInTheDocument();
  });

  test('redirects to login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ loading: false, user: null });
    
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute />}>
             <Route path="" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('renders content when user is authenticated and no specific role required', () => {
    mockUseAuth.mockReturnValue({ 
      loading: false, 
      user: { role: UserRole.STUDENT, name: 'Test User' } 
    });
    
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
             <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects student accessing lecturer route', () => {
    mockUseAuth.mockReturnValue({ 
      loading: false, 
      user: { role: UserRole.STUDENT, name: 'Student User' } 
    });
    
    render(
      <MemoryRouter initialEntries={['/lecturer']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={[UserRole.LECTURER]} />}>
             <Route path="/lecturer" element={<div>Lecturer Content</div>} />
          </Route>
          <Route path="/student/attendance" element={<div>Student Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to student dashboard
    expect(screen.getByText('Student Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Lecturer Content')).not.toBeInTheDocument();
  });

  test('renders content when role matches', () => {
    mockUseAuth.mockReturnValue({ 
      loading: false, 
      user: { role: UserRole.LECTURER, name: 'Lecturer User' } 
    });
    
    render(
      <MemoryRouter initialEntries={['/lecturer']}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={[UserRole.LECTURER]} />}>
             <Route path="/lecturer" element={<div>Lecturer Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Lecturer Content')).toBeInTheDocument();
  });
});