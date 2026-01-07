import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  
  const { resetPassword } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const userId = searchParams.get('userId');
  const secret = searchParams.get('secret');

  useEffect(() => {
    if (!userId || !secret) {
      addToast('Invalid password reset link.', 'error');
      navigate('/login');
    }
  }, [userId, secret, navigate, addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    
    if (!userId || !secret) return;

    setIsSubmitting(true);
    try {
      await resetPassword(userId, secret, password);
      addToast('Password updated. Please login.', 'success');
      navigate('/login');
    } catch (err: any) {
      addToast(err.message || 'Failed to update credentials.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md animate-slide-up relative z-10">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200">
          <div className="text-center mb-10">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg mb-6">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
               </svg>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Security Update</h2>
            <p className="text-slate-500 font-medium mt-3">Establish a new access key</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block ml-1">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block ml-1">Confirm Identity</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-slate-200 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating Core...' : 'Reset Access Credentials'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/login" className="text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase tracking-widest transition-colors">Return to Auth</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;