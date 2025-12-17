import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';
import { UserRole } from '../../../types';

// Declare Jest globals to satisfy TypeScript compiler
declare const jest: any;
declare const describe: any;
declare const beforeEach: any;
declare const test: any;
declare const expect: any;

// Mock the AuthContext
const mockLogin = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
  }),
}));

// Mock constants to avoid 'your-project-id' check
jest.mock('../../config/constants', () => ({
  APPWRITE_PROJECT_ID: 'mock-project-id',
}));

describe('Login Component', () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  };

  test('renders login form correctly', () => {
    renderLogin();
    expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  test('calls login function on form submission', async () => {
    renderLogin();
    
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  test('shows dev mode buttons when specific credentials are entered', () => {
    renderLogin();
    
    // Enter dev credentials
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'peterkehindeademola@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'kehinde5@' } });
    
    // Check if standard Sign In button is gone and Dev buttons appear
    expect(screen.queryByRole('button', { name: /Sign In/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Dev Lecturer/i)).toBeInTheDocument();
    expect(screen.getByText(/Dev Student/i)).toBeInTheDocument();
  });

  test('calls login with Lecturer role when Dev Lecturer button is clicked', async () => {
    renderLogin();
    
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'peterkehindeademola@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'kehinde5@' } });
    
    fireEvent.click(screen.getByText(/Dev Lecturer/i));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('peterkehindeademola@gmail.com', 'kehinde5@', UserRole.LECTURER);
    });
  });

  test('calls login with Student role when Dev Student button is clicked', async () => {
    renderLogin();
    
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'peterkehindeademola@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'kehinde5@' } });
    
    fireEvent.click(screen.getByText(/Dev Student/i));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('peterkehindeademola@gmail.com', 'kehinde5@', UserRole.STUDENT);
    });
  });
});