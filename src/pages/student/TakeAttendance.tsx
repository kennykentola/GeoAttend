import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { functions } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { ATTENDANCE_FUNCTION_ID } from '../../config/constants';

const TakeAttendance: React.FC = () => {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  // Initialize from URL param if available
  const [sessionId, setSessionId] = useState(searchParams.get('sessionId') || '');
  const [status, setStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [geoData, setGeoData] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);

  const handleMarkAttendance = async () => {
    // 1. Validate Input
    if (!sessionId.trim()) {
      setMessage('Session ID is required. Please enter the code provided by your lecturer.');
      setStatus('error');
      return;
    }

    setStatus('locating');
    setMessage('Acquiring your location...');

    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Geolocation is not supported by your browser.');
      return;
    }

    // 2. Get Location
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGeoData({ lat: latitude, lon: longitude, accuracy });
        
        setStatus('verifying');
        setMessage('Verifying location and session...');

        try {
          // 3. Call Serverless Function
          const payload = JSON.stringify({
            sessionId: sessionId.trim(),
            studentId: user?.$id,
            recordedLat: latitude,
            recordedLon: longitude,
          });

          const execution = await functions.createExecution(
            ATTENDANCE_FUNCTION_ID,
            payload,
            false // async = false to wait for result
          );

          if (execution.status === 'completed') {
            const responseBody = JSON.parse(execution.responseBody);
            
            if (responseBody.success) {
              setStatus('success');
              setMessage('Attendance marked successfully! You are present.');
            } else {
              setStatus('error');
              setMessage(responseBody.message || 'Validation failed.');
            }
          } else {
            setStatus('error');
            setMessage('Server error: Function execution failed.');
            console.error(execution);
          }
        } catch (error: any) {
          console.error('Attendance Error:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to communicate with server.');
        }
      },
      (error) => {
        console.error('Geo Error:', error);
        setStatus('error');
        let msg = 'Unable to retrieve location.';
        if (error.code === 1) msg = 'Location permission denied. Please allow access.';
        else if (error.code === 2) msg = 'Location unavailable.';
        else if (error.code === 3) msg = 'Location request timed out.';
        setMessage(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const getAccuracyColor = (acc: number) => {
    if (acc <= 20) return 'bg-green-50 border-green-200 text-green-700'; // Excellent
    if (acc <= 50) return 'bg-yellow-50 border-yellow-200 text-yellow-800'; // Moderate
    return 'bg-red-50 border-red-200 text-red-700'; // Poor
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <nav className="w-full bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600">GeoAttend</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Hi, {user?.name}</span>
          <button onClick={() => logout()} className="text-sm text-red-500 hover:text-red-700">Logout</button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-md p-6 flex flex-col justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Mark Attendance</h2>
          <p className="text-gray-500 text-sm mb-6">Enter the session code provided by your lecturer.</p>

          <div className="space-y-4">
            <div>
              <label htmlFor="sessionId" className="block text-sm font-medium text-gray-700">
                Session Code / ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="sessionId"
                required
                autoComplete="off"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Paste session code here"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-3"
                disabled={status === 'locating' || status === 'verifying' || status === 'success'}
              />
            </div>

            {geoData && (
              <div className={`mt-2 p-3 rounded-md border text-xs flex flex-col gap-1 transition-all ${getAccuracyColor(geoData.accuracy)}`}>
                 <div className="flex justify-between items-center font-medium">
                    <span>Signal Accuracy</span>
                    <span>±{Math.round(geoData.accuracy)} meters</span>
                 </div>
                 <div className="flex justify-between items-center opacity-80">
                    <span>Coordinates</span>
                    <span className="font-mono">{geoData.lat.toFixed(5)}, {geoData.lon.toFixed(5)}</span>
                 </div>
                 {geoData.accuracy > 50 && (
                   <div className="mt-1 text-[10px] font-bold uppercase tracking-wider">
                     Low accuracy signal - Move outdoors for better results
                   </div>
                 )}
              </div>
            )}

            {/* Status Messages */}
            {status !== 'idle' && (
              <div className={`p-4 rounded-md text-sm ${
                status === 'error' ? 'bg-red-50 text-red-700' : 
                status === 'success' ? 'bg-green-50 text-green-700' : 
                'bg-blue-50 text-blue-700'
              }`}>
                {status === 'locating' && (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{message}</span>
                  </div>
                )}
                {status !== 'locating' && message}
              </div>
            )}

            {status !== 'success' ? (
              <button
                onClick={handleMarkAttendance}
                disabled={status === 'locating' || status === 'verifying' || !sessionId.trim()}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === 'locating' || status === 'verifying' ? 'Processing...' : 'Verify Location & Mark'}
              </button>
            ) : (
              <button
                onClick={() => {
                  setStatus('idle');
                  setSessionId('');
                  setMessage('');
                  setGeoData(null);
                }}
                className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Mark Another Session
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TakeAttendance;