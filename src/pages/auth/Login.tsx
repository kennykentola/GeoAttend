
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../../types';
import { APPWRITE_PROJECT_ID } from '../../config/constants';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      // Fix: user.role is now user.roles array
      if (user.roles.includes(UserRole.ADMIN)) {
        navigate('/admin/dashboard');
      } else if (user.roles.includes(UserRole.LECTURER)) {
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
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setIsSubmitting(false);
    }
  };

  const handleDevLogin = async (role: UserRole) => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password, role);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setIsSubmitting(false);
    }
  };

  const isConfigured = (APPWRITE_PROJECT_ID as string) !== 'your-project-id';
  const isDevCredentials = email === 'peterkehindeademola@gmail.com' && password === 'kehinde5@';

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 lg:px-8 relative overflow-hidden">
      
      {/* Decorative Background Blobs - Made transparent/subtle for the image background */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>

      <div className="relative w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-9 h-9 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.216 50.59 50.59 0 00-2.658.812m-15.482 0a50.57 50.57 0 012.658.812m12.824 0a50.57 50.57 0 002.658-.812" />
             </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Higher Institution Attendance
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Sign in to access your portal
          </p>
          {!isConfigured && (
            <div className="mt-4 p-3 bg-yellow-500/10 text-yellow-200 text-sm rounded border border-yellow-500/20 backdrop-blur-sm">
              <strong>Config Needed:</strong> Check <code>src/config/constants.ts</code>.
            </div>
          )}
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form className="space-y-6" onSubmit={handleSubmit}>
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
                  className="block w-full rounded-lg border-0 bg-black/20 py-3 px-4 text-white shadow-inner ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all focus:bg-black/30"
                  placeholder="admin@hia.edu"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-200">
                  Password
                </label>
                <div className="text-sm">
                  <Link to="/forgot-password" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border-0 bg-black/20 py-3 px-4 text-white shadow-inner ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 backdrop-blur-sm transition-all focus:bg-black/30"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-200 text-sm text-center font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20 backdrop-blur-sm">
                {error}
              </div>
            )}

            <div>
              {isDevCredentials ? (
                <div className="space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                     <button
                        type="button"
                        onClick={() => handleDevLogin(UserRole.LECTURER)}
                        disabled={isSubmitting}
                        className="flex w-full justify-center rounded-lg bg-indigo-600/80 px-3 py-2.5 text-sm font-bold leading-6 text-white shadow-lg hover:bg-indigo-500 transition-all border border-indigo-400/20"
                     >
                        Dev Lecturer
                     </button>
                     <button
                        type="button"
                        onClick={() => handleDevLogin(UserRole.STUDENT)}
                        disabled={isSubmitting}
                        className="flex w-full justify-center rounded-lg bg-teal-600/80 px-3 py-2.5 text-sm font-bold leading-6 text-white shadow-lg hover:bg-teal-500 transition-all border border-teal-400/20"
                     >
                        Dev Student
                     </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDevLogin(UserRole.ADMIN)}
                    disabled={isSubmitting}
                    className="flex w-full justify-center rounded-lg bg-purple-600/80 px-3 py-2.5 text-sm font-bold leading-6 text-white shadow-lg hover:bg-purple-500 transition-all border border-purple-400/20"
                  >
                    Dev Admin Dashboard
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !isConfigured}
                  className={`flex w-full justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-3 text-sm font-bold leading-6 text-white shadow-lg hover:from-indigo-500 hover:to-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isSubmitting || !isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>
              )}
            </div>
          </form>

          <p className="mt-10 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-white hover:text-indigo-300 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
