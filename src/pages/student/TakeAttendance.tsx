import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { functions } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { ATTENDANCE_FUNCTION_ID } from '../../config/constants';
// @ts-ignore
import { Html5QrcodeScanner } from 'html5-qrcode';

const TakeAttendance: React.FC = () => {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') || '');
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [geoData, setGeoData] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (showScanner) {
      const timer = setTimeout(() => {
        if (scannerRef.current) return;

        const scanner = new Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        );
        
        scannerRef.current = scanner;

        scanner.render(
          (decodedText: string) => {
            if (decodedText) {
                setSessionId(decodedText.trim());
                setShowScanner(false);
            }
          },
          (error: any) => {
            // Ignore scan errors
          }
        );
      }, 100);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
            scannerRef.current.clear().catch((err: any) => console.warn("Scanner clear error", err));
            scannerRef.current = null;
        }
      };
    }
  }, [showScanner]);

  const handleLogout = async () => {
    setSessionId('');
    setGeoData(null);
    setStatus('idle');
    setMessage('');
    await logout();
  };

  const getPosition = (timeout: number): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: timeout,
        maximumAge: 0
      });
    });
  };

  const handleMarkAttendance = async () => {
    if (!sessionId.trim()) {
      setMessage('Session ID is required.');
      setStatus('error');
      return;
    }

    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Geolocation not supported by this browser.');
      return;
    }

    setStatus('locating');
    setGeoData(null);
    
    const MAX_ATTEMPTS = 3;
    const TARGET_ACCURACY = 40; // meters
    let bestPos: GeolocationPosition | null = null;
    let finalError: string = 'Unknown location error.';

    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      setAttempt(i);
      const timeout = 5000 + (i - 1) * 3000; // 5s, 8s, 11s
      setMessage(`Attempt ${i} of ${MAX_ATTEMPTS}: Acquiring precise location...`);

      try {
        const position = await getPosition(timeout);
        const { latitude, longitude, accuracy } = position.coords;
        
        // Always store the one with best accuracy
        if (!bestPos || accuracy < bestPos.coords.accuracy) {
          bestPos = position;
          setGeoData({ lat: latitude, lon: longitude, accuracy });
        }

        // If accuracy is good enough, proceed immediately
        if (accuracy <= TARGET_ACCURACY) {
          break;
        } else if (i < MAX_ATTEMPTS) {
          setMessage(`Signal weak (±${Math.round(accuracy)}m). Retrying for better precision...`);
          // Small delay before retry
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (error: any) {
        if (error.code === 1) { // Permission Denied
          finalError = 'Location access denied. Please enable GPS and allow permissions.';
          break; 
        }
        if (i === MAX_ATTEMPTS && !bestPos) {
           if (error.code === 3) finalError = 'Location request timed out. Try moving outdoors.';
           else if (error.code === 2) finalError = 'Position unavailable. Check your connection.';
           else finalError = error.message || 'Location error.';
        }
      }
    }

    if (!bestPos) {
      setStatus('error');
      setMessage(finalError);
      return;
    }

    // Even if accuracy isn't perfect, we use the best one we got after retries
    const { latitude, longitude } = bestPos.coords;
    setStatus('verifying');
    setMessage('Verifying attendance with server...');

    try {
      const payload = JSON.stringify({
        sessionId: sessionId.trim(),
        studentId: user?.$id,
        recordedLat: latitude,
        recordedLon: longitude,
      });

      const execution = await functions.createExecution(
        ATTENDANCE_FUNCTION_ID,
        payload,
        false 
      );

      if (execution.status === 'completed') {
        const responseBody = JSON.parse(execution.responseBody);
        
        if (responseBody.success) {
          setStatus('success');
          setMessage('Check-in successful! Attendance recorded.');
        } else {
          setStatus('error');
          setMessage(responseBody.message || 'Verification failed.');
        }
      } else {
        setStatus('error');
        setMessage('Server verification timed out or failed.');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Network connection failed.');
    }
  };

  const getSignalStatus = (acc: number) => {
    if (acc <= 30) return { 
        className: 'bg-green-500/20 border-green-500/40 text-green-200', 
        label: 'High Precision', 
        tip: null 
    };
    if (acc <= 70) return { 
        className: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200', 
        label: 'Medium Precision', 
        tip: 'May be rejected if geofence is tight.' 
    };
    return { 
        className: 'bg-red-500/20 border-red-500/40 text-red-200', 
        label: 'Low Precision', 
        tip: 'Try moving to a more open area.' 
    };
  };

  const signal = geoData ? getSignalStatus(geoData.accuracy) : null;

  return (
    <div className="flex flex-col items-center w-full min-h-screen">
      {/* Glass Navbar */}
      <nav className="w-full bg-white/5 backdrop-blur-md border-b border-white/10 p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
           <span className="bg-indigo-600 p-1.5 rounded-lg">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.216 50.59 50.59 0 00-2.658.812m-15.482 0a50.57 50.57 0 012.658.812m12.824 0a50.57 50.57 0 002.658-.812" />
             </svg>
           </span>
           HIA
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300 hidden sm:inline">Welcome, {user?.name}</span>
          <button 
            onClick={handleLogout} 
            className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-md p-6 flex flex-col justify-center relative">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-8 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 left-[-50%] w-[200%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">Check In</h2>
            <p className="text-gray-400 text-sm mb-6">Scan QR or enter session code below.</p>

            <div className="space-y-5">
              <div>
                <label htmlFor="sessionId" className="block text-sm font-medium text-gray-300 mb-1">
                  Session ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="sessionId"
                    required
                    autoComplete="off"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="Enter ID..."
                    className="block w-full rounded-xl border border-white/20 bg-black/20 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm p-3 transition-all outline-none"
                    disabled={status === 'locating' || status === 'verifying' || status === 'success'}
                  />
                  <button
                     type="button"
                     onClick={() => setShowScanner(true)}
                     disabled={status === 'locating' || status === 'verifying' || status === 'success'}
                     className="inline-flex items-center px-4 py-2 border border-white/20 shadow-sm text-sm font-medium rounded-xl text-white bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                     title="Scan QR Code"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75zM16.5 19.5h.75v.75h-.75v-.75z" />
                    </svg>
                  </button>
                </div>
              </div>

              {geoData && signal && (
                <div className={`p-3 rounded-xl border text-xs flex flex-col gap-1 transition-all ${signal.className} animate-fade-in`}>
                   <div className="flex justify-between items-center font-bold">
                      <span className="flex items-center gap-1.5">
                         {signal.label === 'High Precision' && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>}
                         {signal.label === 'Medium Precision' && <span className="w-2 h-2 rounded-full bg-yellow-400"></span>}
                         {signal.label === 'Low Precision' && <span className="w-2 h-2 rounded-full bg-red-400"></span>}
                         {signal.label}
                      </span>
                      <span>Accuracy: ±{Math.round(geoData.accuracy)}m</span>
                   </div>
                   <div className="flex justify-between items-center opacity-80 mt-1">
                      <span>Coordinates</span>
                      <span className="font-mono">{geoData.lat.toFixed(5)}, {geoData.lon.toFixed(5)}</span>
                   </div>
                   {signal.tip && (
                       <div className="mt-2 text-[10px] uppercase tracking-wide font-bold bg-black/20 p-1.5 rounded text-center">
                           Tip: {signal.tip}
                       </div>
                   )}
                </div>
              )}

              {status !== 'idle' && (
                <div className={`p-4 rounded-xl text-sm font-medium border transition-all ${
                  status === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-200' : 
                  status === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-200' : 
                  'bg-blue-500/20 border-blue-500/30 text-blue-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {(status === 'locating' || status === 'verifying') && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    )}
                    <span className="flex-1">{message}</span>
                  </div>
                </div>
              )}

              {status !== 'success' ? (
                <button
                  onClick={handleMarkAttendance}
                  disabled={status === 'locating' || status === 'verifying' || !sessionId.trim()}
                  className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {status === 'locating' ? 'Locating...' : status === 'verifying' ? 'Verifying...' : 'Check In'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setStatus('idle');
                    setSessionId('');
                    setMessage('');
                    setGeoData(null);
                  }}
                  className="w-full py-3.5 px-4 border border-white/20 rounded-xl shadow-sm text-sm font-bold text-white bg-white/10 hover:bg-white/20 focus:outline-none transition-all"
                >
                  Mark New Attendance
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">Scan QR Code</h3>
                    <button onClick={() => setShowScanner(false)} className="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-4 flex flex-col items-center justify-center bg-black">
                    <div id="reader" className="w-full"></div>
                    <p className="text-xs text-gray-400 mt-2">Align the QR code within the box</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TakeAttendance;