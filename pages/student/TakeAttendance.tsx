
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { functions } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { ATTENDANCE_FUNCTION_ID } from '../../config/constants';
import { useToast } from '../../context/ToastContext';
// @ts-ignore
import { Html5QrcodeScanner } from 'html5-qrcode';

const TakeAttendance: React.FC = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') || '');
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [geoData, setGeoData] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (showScanner) {
      const timer = setTimeout(() => {
        if (scannerRef.current) return;
        const scanner = new Html5QrcodeScanner("reader", { 
          fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 
        }, false);
        scannerRef.current = scanner;
        scanner.render((text) => {
          setSessionId(text.trim());
          setShowScanner(false);
          addToast("Session ID captured.", "success");
        }, () => {});
      }, 100);
      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {});
          scannerRef.current = null;
        }
      };
    }
  }, [showScanner, addToast]);

  const handleMarkAttendance = async () => {
    if (!sessionId.trim()) return addToast("Session ID required.", "error");
    if (!navigator.geolocation) return addToast("Geolocation not supported.", "error");

    setStatus('locating');
    setMessage('Acquiring physical coordinates...');
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setGeoData({ lat: latitude, lon: longitude, accuracy });
      
      if (accuracy > 80) {
        addToast("Signal precision low. Verification may fail.", "warning");
      }

      setStatus('verifying');
      setMessage('Synchronizing with institutional node...');

      try {
        const payload = JSON.stringify({
          sessionId: sessionId.trim(),
          studentId: user?.$id,
          recordedLat: latitude,
          recordedLon: longitude,
        });

        const execution = await functions.createExecution(ATTENDANCE_FUNCTION_ID, payload, false);
        const res = JSON.parse(execution.responseBody);
        
        if (res.success) {
          setStatus('success');
          setMessage('Identity Verified. Registry committed.');
        } else {
          setStatus('error');
          setMessage(res.message || 'Spatial Verification Failed.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Network handshake failed.');
      }
    }, (err) => {
      setStatus('error');
      setMessage("Location access denied. Enable GPS permissions.");
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const getAccuracyFeedback = (acc: number) => {
    if (acc <= 30) return { color: 'text-emerald-500', label: 'High Precision', tip: 'Verified within hall radius.' };
    if (acc <= 70) return { color: 'text-amber-500', label: 'Medium Precision', tip: 'Try moving closer to windows.' };
    return { color: 'text-rose-500', label: 'Low Precision', tip: 'Signal blocked. Move to open area.' };
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 selection:bg-indigo-100">
      <nav className="fixed top-0 w-full p-6 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-200 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337a49.94 49.94 0 0 0-9.9 2.133V19a.75.75 0 0 1-1.44 0v-6.805a49.94 49.94 0 0 0-9.9-2.133.75.75 0 0 1-.231-1.337A60.65 60.65 0 0 1 11.7 2.805Z" /></svg>
          </div>
          <span className="font-black tracking-tighter text-slate-900">HIA <span className="text-indigo-600">Portal</span></span>
        </div>
        <button onClick={() => logout()} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors">Terminate</button>
      </nav>

      <div className="w-full max-w-md space-y-6 mt-16 animate-slide-up">
        <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl space-y-10 relative overflow-hidden">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Spatial <br/>Check-In</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Identity Verification Node</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Identity</label>
              <div className="flex gap-2">
                <input 
                  type="text" value={sessionId} onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Enter Session Hash"
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
                <button onClick={() => setShowScanner(true)} className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" /></svg>
                </button>
              </div>
            </div>

            {geoData && (
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">GPS Accuracy Radius</span>
                  <span className={`text-[10px] font-black uppercase ${getAccuracyFeedback(geoData.accuracy).color}`}>±{Math.round(geoData.accuracy)} Meters</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${getAccuracyFeedback(geoData.accuracy).color.replace('text', 'bg')}`} style={{ width: `${Math.max(10, 100 - geoData.accuracy)}%` }}></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${getAccuracyFeedback(geoData.accuracy).color.replace('text', 'bg')}`}></div>
                  <p className="text-[10px] font-bold text-slate-500 leading-tight">
                    {getAccuracyFeedback(geoData.accuracy).label}: {getAccuracyFeedback(geoData.accuracy).tip}
                  </p>
                </div>
              </div>
            )}

            {status !== 'idle' && (
              <div className={`p-5 rounded-2xl border text-xs font-bold text-center transition-all ${
                status === 'error' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                status === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                'bg-indigo-50 border-indigo-100 text-indigo-600'
              }`}>
                {status === 'locating' || status === 'verifying' ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span className="uppercase tracking-widest text-[9px]">{message}</span>
                  </div>
                ) : message}
              </div>
            )}

            <button 
              onClick={handleMarkAttendance}
              disabled={status === 'locating' || status === 'verifying' || status === 'success'}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-[0.3em]"
            >
              Mark Presence
            </button>
          </div>
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-3xl animate-fade-in p-6">
          <div className="w-full max-w-sm bg-white rounded-[3.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scan Session QR</span>
              <button onClick={() => setShowScanner(false)} className="text-slate-400 hover:text-rose-500 font-bold">×</button>
            </div>
            <div id="reader" className="w-full"></div>
            <div className="p-8 text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Align Code within central frame</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeAttendance;
