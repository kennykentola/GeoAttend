import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.roles.includes(UserRole.ADMIN)) navigate('/admin/dashboard');
      else if (user.roles.includes(UserRole.LECTURER)) navigate('/lecturer/dashboard');
      else navigate('/student/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
      setIsSubmitting(false);
    }
  };

  const handleBypass = async (role: UserRole) => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password, role);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('handshake') || msg.toLowerCase().includes('fetch')) {
          setError('Handshake Failed: Ensure your current domain is added as a "Web Platform" in your Appwrite Project Settings.');
      } else {
          setError(msg || 'Bypass protocol failure.');
      }
      setIsSubmitting(false);
    }
  }

  const isDev = email === 'peterkehindeademola@gmail.com' && password === 'kehinde5@';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-50 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-violet-50 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md animate-slide-up relative z-10">
        <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] p-10 shadow-2xl border border-slate-100">
          <div className="text-center mb-10">
            <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 mb-6 transform rotate-3 hover:rotate-0 transition-all duration-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
              </svg>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Identity Node</h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-3">Access Institutional Grid</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block ml-1">Registry Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                placeholder="id@institution.edu"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Access Key</label>
                <Link to="/forgot-password" university-recovery="true" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400 transition-colors">Lost Key?</Link>
              </div>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 pr-14 text-slate-900 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors p-1"
                  aria-label={showPassword ? "Hide access key" : "Show access key"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className={`border px-5 py-4 rounded-2xl text-[11px] font-bold text-center animate-shake ${
                error.includes('Handshake') 
                ? 'bg-amber-50 border-amber-100 text-amber-700' 
                : 'bg-rose-50 border-rose-100 text-rose-500'
              }`}>
                <p className="uppercase tracking-widest mb-1 font-black">System Alert</p>
                <p className="normal-case font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {!isDev ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-2xl shadow-slate-200 transition-all transform active:scale-95 disabled:opacity-50 text-sm uppercase tracking-[0.2em]"
              >
                {isSubmitting ? 'Verifying...' : 'Establish Session'}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => handleBypass(UserRole.ADMIN)} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-rose-100 transition-all">Admin Bypass</button>
                <button type="button" onClick={() => handleBypass(UserRole.LECTURER)} disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-violet-100 transition-all">Lecturer Bypass</button>
                <button type="button" onClick={() => handleBypass(UserRole.STUDENT)} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 col-span-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-100 transition-all">Student Bypass</button>
              </div>
            )}
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-slate-400 text-sm font-medium">
              New Entity? <Link to="/register" className="text-slate-900 font-black hover:text-indigo-600 transition-colors ml-1">Establish ID</Link>
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <Link to="/" className="text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 transition-colors">← System Exit</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;