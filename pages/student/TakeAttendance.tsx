
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { databases, functions, storage } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { ATTENDANCE_FUNCTION_ID, DATABASE_ID, SESSIONS_COLLECTION_ID, MAX_DISTANCE_METERS, STORAGE_BUCKET_ID } from '../../config/constants';
import { useToast } from '../../context/ToastContext';
import { AttendanceSession } from '../../types';
import { ID } from 'appwrite';
// @ts-ignore
import { Html5QrcodeScanner } from 'html5-qrcode';

const TakeAttendance: React.FC = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') || '');
  const [sessionMetadata, setSessionMetadata] = useState<AttendanceSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'camera' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [distanceToVenue, setDistanceToVenue] = useState<number | null>(null);
  
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'camera') {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
            .catch(() => addToast("Camera access required for verification protocol.", "error"));
    }
  }, [status]);

  const capturePhoto = () => {
    if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        setCapturedImage(canvas.toDataURL('image/jpeg'));
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        
        setStatus('verifying');
        executeVerification();
    }
  };

  const executeVerification = async () => {
    setMessage('Transmitting Presence + Biometric Handshake...');
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true });
      });

      const payload = JSON.stringify({ 
        sessionId: sessionId.trim(), 
        studentId: user?.$id, 
        recordedLat: pos.coords.latitude, 
        recordedLon: pos.coords.longitude,
        hasPhoto: !!capturedImage 
      });

      const execution = await functions.createExecution(ATTENDANCE_FUNCTION_ID, payload, false);
      const res = JSON.parse(execution.responseBody);
      
      if (res.success) {
          setStatus('success');
          addToast("Biometric Handshake Confirmed.", "success");
      } else {
          setStatus('error');
          setMessage(res.message);
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(e.message || 'System handshake failed.');
    }
  };

  const startVerificationNode = () => {
      if (!sessionId.trim()) return addToast("Node ID required.", "error");
      setStatus('camera');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-slate-50">
      <nav className="w-full max-w-lg flex justify-between items-center mb-12">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337a49.94 49.94 0 0 0-9.9 2.133V19a.75.75 0 0 1-1.44 0v-6.805a49.94 49.94 0 0 0-9.9-2.133.75.75 0 0 1-.231-1.337A60.65 60.65 0 0 1 11.7 2.805Z" /></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">HIA <span className="text-indigo-600">Sync</span></h1>
          </div>
      </nav>

      <main className="w-full max-w-lg space-y-6">
        <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl space-y-10 relative overflow-hidden">
            
            {status === 'idle' && (
                <div className="space-y-10 animate-fade-in">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Initialize <br/>Handshake</h2>
                        <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em]">Two-Factor Registry Entry</p>
                    </div>
                    <div className="space-y-6">
                        <input 
                            type="text" value={sessionId} onChange={(e) => setSessionId(e.target.value)} 
                            placeholder="Spatial Node ID" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-xl font-mono font-black tracking-widest text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        />
                        <button 
                            onClick={startVerificationNode}
                            className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl shadow-2xl uppercase tracking-[0.2em] text-xs hover:bg-indigo-600 transition-all active:scale-95"
                        >
                            Activate Protocol
                        </button>
                    </div>
                </div>
            )}

            {status === 'camera' && (
                <div className="space-y-10 animate-slide-up flex flex-col items-center">
                    <div className="text-center">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Photo Handshake</h2>
                        <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Verify Physical Presence</p>
                    </div>
                    <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-indigo-600 shadow-2xl bg-slate-900 ring-8 ring-indigo-50">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                        <div className="absolute inset-0 border-[24px] border-white/10 rounded-full pointer-events-none"></div>
                    </div>
                    <button 
                        onClick={capturePhoto}
                        className="w-full bg-indigo-600 text-white font-black py-6 rounded-2xl shadow-xl uppercase tracking-widest text-[10px] active:scale-95"
                    >
                        Confirm Identity
                    </button>
                </div>
            )}

            {status === 'verifying' && (
                <div className="py-20 text-center space-y-8 animate-fade-in">
                    <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-600 rounded-full animate-spin mx-auto shadow-2xl shadow-indigo-500/20"></div>
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.4em] animate-pulse">{message}</p>
                </div>
            )}

            {status === 'success' && (
                <div className="py-12 text-center space-y-10 animate-fade-in">
                    <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-100 rotate-3"><svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg></div>
                    <div className="space-y-2">
                        <h3 className="text-3xl font-black text-slate-900">Sync Complete</h3>
                        <p className="text-slate-400 font-medium">Attendance verified and committed to registry.</p>
                    </div>
                    <button onClick={() => navigate('/student/dashboard')} className="w-full bg-slate-100 text-slate-600 font-black py-5 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]">Return to Console</button>
                </div>
            )}

            {status === 'error' && (
                <div className="py-12 text-center space-y-10 animate-shake">
                    <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border-2 border-rose-100"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></div>
                    <div className="space-y-2 px-6">
                        <h3 className="text-2xl font-black text-slate-900">Handshake Aborted</h3>
                        <p className="text-rose-400 text-sm font-bold uppercase">{message}</p>
                    </div>
                    <button onClick={() => setStatus('idle')} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-[10px]">Restart Protocol</button>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default TakeAttendance;
