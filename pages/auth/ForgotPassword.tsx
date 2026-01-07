import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  
  const { sendPasswordReset } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await sendPasswordReset(email);
      setIsSent(true);
      addToast('Reset link dispatched.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Dispatch failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200">
          <div className="text-center mb-10">
             <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Recovery</h2>
             <p className="text-slate-500 font-medium mt-3">Retrieve your institutional credentials</p>
          </div>

          {!isSent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block ml-1">Email Registry</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                  placeholder="id@institution.edu"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-slate-200 transition-all transform active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Dispatching...' : 'Dispatch Reset Link'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100 text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Check your inbox</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Instructions have been sent to <strong>{email}</strong>.</p>
              <Link to="/login" className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all">Return to Login</Link>
            </div>
          )}

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <Link to="/login" className="text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase tracking-widest transition-colors">Back to Authentication</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;