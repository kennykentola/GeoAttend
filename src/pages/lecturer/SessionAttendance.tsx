import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client, { databases } from '../../config/appwriteConfig';
import { DATABASE_ID, SESSIONS_COLLECTION_ID, RECORDS_COLLECTION_ID, USERS_COLLECTION_ID } from '../../config/constants';
import { AttendanceSession, AttendanceRecord } from '../../../types';
import { Query } from 'appwrite';
import { useToast } from '../../context/ToastContext';

const SessionAttendance: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  // Use ref to track fetched names to avoid stale closures in subscription
  const fetchedNamesRef = useRef<Set<string>>(new Set());
  // Track last notification minute to avoid spamming toast multiple times in the same minute
  const lastNotificationMinuteRef = useRef<number | null>(null);

  const fetchStudentName = async (studentId: string): Promise<string> => {
    if (fetchedNamesRef.current.has(studentId)) {
        return studentNames[studentId] || 'Loading...';
    }
    
    try {
        fetchedNamesRef.current.add(studentId);
        const userDoc = await databases.getDocument(DATABASE_ID, USERS_COLLECTION_ID, studentId);
        const name = userDoc.name;
        setStudentNames(prev => ({ ...prev, [studentId]: name }));
        return name;
    } catch (e) {
        setStudentNames(prev => ({ ...prev, [studentId]: 'Unknown Student' }));
        return 'Unknown Student';
    }
  };

  // Check for session expiration every minute
  useEffect(() => {
    if (!session || !session.isActive || !session.endTime) return;

    const checkExpiration = () => {
      const now = new Date().getTime();
      const end = new Date(session.endTime).getTime();
      const diff = end - now;
      
      // Calculate minutes left
      const minsLeft = Math.ceil(diff / 60000);

      // If between 0 and 5 minutes (300,000 ms), and we haven't notified for this specific minute count yet
      if (diff > 0 && diff <= 300000 && lastNotificationMinuteRef.current !== minsLeft) {
        addToast(`Warning: Session expires in ${minsLeft} minute${minsLeft > 1 ? 's' : ''}.`, 'warning');
        lastNotificationMinuteRef.current = minsLeft;
      }
    };

    const interval = setInterval(checkExpiration, 10000); // Check every 10 seconds for better precision near end
    // Initial check
    checkExpiration();
    
    return () => clearInterval(interval);
  }, [session, addToast]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchData = async () => {
      try {
        // Fetch Session
        const sessionDoc = await databases.getDocument(
          DATABASE_ID,
          SESSIONS_COLLECTION_ID,
          sessionId
        );
        setSession({
            $id: sessionDoc.$id,
            courseId: sessionDoc.courseId,
            courseName: sessionDoc.courseName,
            lectureStartTime: sessionDoc.lectureStartTime,
            endTime: sessionDoc.endTime,
            venueLat: sessionDoc.venueLat,
            venueLon: sessionDoc.venueLon,
            isActive: sessionDoc.isActive
        });

        // Fetch Records
        const recordsResponse = await databases.listDocuments(
          DATABASE_ID,
          RECORDS_COLLECTION_ID,
          [Query.equal('sessionId', sessionId), Query.limit(100), Query.orderDesc('$createdAt')] 
        );
        
        const mappedRecords = recordsResponse.documents.map(doc => ({
            $id: doc.$id,
            sessionId: doc.sessionId,
            studentId: doc.studentId,
            timestamp: doc.timestamp,
            status: doc.status as 'present' | 'absent'
        }));
        setRecords(mappedRecords);

        // Fetch Names for initial records
        mappedRecords.forEach(r => fetchStudentName(r.studentId));

      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time subscription
    const channel = `databases.${DATABASE_ID}.collections.${RECORDS_COLLECTION_ID}.documents`;
    const unsubscribe = client.subscribe(channel, async (response) => {
        if (response.events.some(event => event.endsWith('.create'))) {
            const payload = response.payload as any;
            if (payload.sessionId === sessionId) {
                const newRecord: AttendanceRecord = {
                    $id: payload.$id,
                    sessionId: payload.sessionId,
                    studentId: payload.studentId,
                    timestamp: payload.timestamp,
                    status: payload.status
                };
                
                // Prevent duplicate addition (in case of race conditions with initial fetch)
                setRecords(prev => {
                    if (prev.some(r => r.$id === newRecord.$id)) return prev;
                    return [newRecord, ...prev];
                });
                
                // Fetch name and Notify
                const name = await fetchStudentName(payload.studentId);
                addToast(`Student Verified: ${name} is present.`, 'success');
            }
        }
    });

    return () => {
        unsubscribe();
    };
  }, [sessionId, addToast]);

  const downloadCSV = () => {
    if (!session || records.length === 0) {
      addToast("No records to export.", "info");
      return;
    }

    const headers = ['Student Name', 'Student ID', 'Time Marked', 'Status'];
    const csvRows = [headers.join(',')];

    records.forEach(record => {
      const name = studentNames[record.studentId] || 'Unknown Student';
      const safeName = `"${name.replace(/"/g, '""')}"`;
      const time = new Date(record.timestamp).toLocaleString();
      const safeTime = `"${time}"`;
      
      csvRows.push([safeName, record.studentId, safeTime, record.status].join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `attendance_${session.courseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast("CSV Export started.", "success");
  };

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-xl font-semibold text-indigo-600 animate-pulse">Loading Attendance...</div>
    </div>
  );

  if (!session) return (
    <div className="p-8 text-center text-red-600">Session not found or error loading session.</div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       <nav className="w-full bg-white shadow-sm p-4 flex justify-between items-center z-10 sticky top-0">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate('/lecturer/dashboard')} 
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="-ml-1 mr-2 h-5 w-5 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to Dashboard
            </button>
        </div>
        <h1 className="text-xl font-bold text-indigo-600 hidden sm:block">Real-Time Attendance</h1>
      </nav>

      <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
         <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{session.courseName}</h2>
                    <p className="text-gray-500 text-sm mt-1">Session ID: <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{session.$id}</span></p>
                </div>
                <div className="flex flex-col items-end">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${session.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {session.isActive ? 'Live / Active' : 'Session Closed'}
                    </div>
                    <span className="text-xs text-gray-400 mt-2">
                        Ends: {session.endTime ? new Date(session.endTime).toLocaleString() : 'N/A'}
                    </span>
                </div>
            </div>
            
            <div className="mt-6 border-t pt-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">Total Present</p>
                    <p className="text-4xl font-bold text-indigo-600">{records.length}</p>
                </div>
                <div className="animate-pulse flex items-center">
                   {session.isActive && <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>}
                   <span className="text-sm text-gray-400">{session.isActive ? 'Listening for updates...' : 'Session ended'}</span>
                </div>
            </div>
         </div>

         <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800">Student List</h3>
                <div className="flex gap-2">
                  <span className="hidden sm:flex items-center text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5 animate-pulse"></span>
                    Live Feed Active
                  </span>
                  <button
                      onClick={downloadCSV}
                      disabled={records.length === 0}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="-ml-0.5 mr-2 h-4 w-4 text-gray-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Export CSV
                  </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Marked</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {records.map(record => (
                            <tr key={record.$id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                                            {(studentNames[record.studentId] || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">
                                                {studentNames[record.studentId] || 'Loading...'}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono">
                                                {record.studentId}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(record.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {record.status === 'present' ? 'Verified / Present' : 'Absent'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <svg className="h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        <p className="text-sm font-medium text-gray-600">No students have marked attendance yet.</p>
                                        <p className="text-xs text-gray-400 mt-1">Real-time updates will appear here instantly.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default SessionAttendance;