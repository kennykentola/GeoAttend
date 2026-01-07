import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../../types';
import { APPWRITE_PROJECT_ID } from '../../config/constants';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      // Fix: roles is now an array, check for role inclusion
      if (user.roles.includes(UserRole.LECTURER)) {
        navigate('/lecturer/dashboard');
      } else {
        navigate('/student/attendance');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await register(email, password, name, role);
    } catch (err: any) {
      setError(err.message || 'Failed to register. Please try again.');
      setIsSubmitting(false);
    }
  };

  const isConfigured = (APPWRITE_PROJECT_ID as string) !== 'your-project-id';

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 lg:px-8 relative overflow-hidden">
      
      {/* Decorative Background Blobs - Subtle opacity */}
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="relative w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Create Account
          </h2>
          <p className="mt-2 text-sm text-gray-200/80">
            Join HIA today
          </p>
          {!isConfigured && (
             <div className="mt-4 p-3 bg-yellow-500/20 text-yellow-200 text-sm rounded border border-yellow-500/50 backdrop-blur-sm">
                <strong>Configuration Needed:</strong> Check <code>src/config/constants.ts</code>.
             </div>
          )}
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-200">
                Full Name
              </label>
              <div className="mt-2">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border-0 bg-black/20 py-2.5 px-4 text-white shadow-sm ring-1 ring-inset ring-white/20 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all focus:bg-black/30"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-200">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border-0 bg-black/20 py-2.5 px-4 text-white shadow-sm ring-1 ring-inset ring-white/20 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all focus:bg-black/30"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-200">
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border-0 bg-black/20 py-2.5 px-4 text-white shadow-sm ring-1 ring-inset ring-white/20 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all focus:bg-black/30"
                  placeholder="Min 8 chars"
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium leading-6 text-gray-200">
                I am a...
              </label>
              <div className="mt-2 relative">
                <select
                  id="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="block w-full rounded-lg border-0 bg-black/20 py-2.5 px-4 text-white shadow-sm ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all focus:bg-black/30 appearance-none"
                >
                  <option value={UserRole.STUDENT} className="bg-gray-800 text-white">Student</option>
                  <option value={UserRole.LECTURER} className="bg-gray-800 text-white">Lecturer</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-200 text-sm text-center font-medium bg-red-500/20 p-2 rounded-lg border border-red-500/30 backdrop-blur-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting || !isConfigured}
                className={`flex w-full justify-center rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2.5 text-sm font-bold leading-6 text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isSubmitting || !isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Creating account...' : 'Sign Up'}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-gray-300">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-white hover:text-purple-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;