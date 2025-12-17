
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client, { databases } from '../../config/appwriteConfig';
import { DATABASE_ID, SESSIONS_COLLECTION_ID, RECORDS_COLLECTION_ID, USERS_COLLECTION_ID } from '../../config/constants';
import { AttendanceSession, AttendanceRecord, UserProfile, UserRole } from '../../../types';
import { Query, ID } from 'appwrite';
import { useToast } from '../../context/ToastContext';
// @ts-ignore
import QRCode from 'qrcode';

const SessionAttendance: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isTogglingSession, setIsTogglingSession] = useState(false);
  
  // Edit Record Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<{ student: UserProfile; record: AttendanceRecord | null } | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent'>('present');
  const [editTimestamp, setEditTimestamp] = useState('');

  // QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [timeLeft, setTimeLeft] = useState<string>(''); 
  const lastNotificationMinuteRef = useRef<number | null>(null);

  // Derived sorted roster: Present students first (sorted by time DESC), then Unmarked
  const sortedStudents = useMemo(() => {
    return [...allStudents].sort((a, b) => {
      const recordA = records.find(r => r.studentId === a.$id);
      const recordB = records.find(r => r.studentId === b.$id);

      if (recordA && !recordB) return -1;
      if (!recordA && recordB) return 1;
      if (recordA && recordB) {
        return new Date(recordB.timestamp).getTime() - new Date(recordA.timestamp).getTime();
      }
      return a.name.localeCompare(b.name);
    });
  }, [allStudents, records]);

  useEffect(() => {
      if (showQrModal && session && qrCanvasRef.current) {
          QRCode.toCanvas(qrCanvasRef.current, session.$id, { 
              width: 300,
              margin: 2,
              scale: 4,
              color: {
                  dark: '#4f46e5',
                  light: '#ffffff'
              }
          }, (error: any) => {
              if (error) console.error("QR Gen Error:", error);
          });
      }
  }, [showQrModal, session]);

  useEffect(() => {
    if (!session || !session.isActive || !session.endTime) return;
    const checkExpiration = () => {
      const now = new Date().getTime();
      const end = new Date(session.endTime).getTime();
      const diff = end - now;
      const minsLeft = Math.ceil(diff / 60000);

      if (diff > 0 && diff <= 300000 && lastNotificationMinuteRef.current !== minsLeft) {
        addToast(`Warning: Session expires in ${minsLeft} minute${minsLeft > 1 ? 's' : ''}.`, 'warning');
        lastNotificationMinuteRef.current = minsLeft;
      }
    };
    const interval = setInterval(checkExpiration, 10000); 
    checkExpiration();
    return () => clearInterval(interval);
  }, [session, addToast]);

  useEffect(() => {
    if (!session || !session.isActive || !session.endTime) {
      setTimeLeft('');
      return;
    }
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(session.endTime).getTime();
      const distance = end - now;
      if (distance < 0) {
        setTimeLeft('EXPIRED');
        return;
      }
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
      setTimeLeft(parts.join(' '));
    };
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [session]);

  const fetchData = async () => {
    if (!sessionId) return;
    try {
      const sessionDoc = await databases.getDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, sessionId);
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

      const recordsResponse = await databases.listDocuments(
        DATABASE_ID, RECORDS_COLLECTION_ID, [Query.equal('sessionId', sessionId), Query.limit(100)] 
      );
      const mappedRecords = recordsResponse.documents.map(doc => ({
          $id: doc.$id,
          sessionId: doc.sessionId,
          studentId: doc.studentId,
          timestamp: doc.timestamp,
          status: doc.status as 'present' | 'absent'
      }));
      setRecords(mappedRecords);

      const studentsResponse = await databases.listDocuments(
          DATABASE_ID,
          USERS_COLLECTION_ID,
          [Query.equal('role', UserRole.STUDENT), Query.limit(100)]
      );
      setAllStudents(studentsResponse.documents.map(doc => ({
          $id: doc.$id,
          name: doc.name,
          email: doc.email,
          role: doc.role as UserRole
      })));

    } catch (error) {
      console.error("Error fetching data", error);
      addToast("Error loading session data", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = `databases.${DATABASE_ID}.collections.${RECORDS_COLLECTION_ID}.documents`;
    const unsubscribe = client.subscribe(channel, (response) => {
        const payload = response.payload as any;
        if (payload.sessionId !== sessionId) return;

        if (response.events.some(event => event.endsWith('.create'))) {
            setRecords(prev => {
                if (prev.some(r => r.$id === payload.$id)) return prev;
                return [...prev, {
                    $id: payload.$id,
                    sessionId: payload.sessionId,
                    studentId: payload.studentId,
                    timestamp: payload.timestamp,
                    status: payload.status
                }];
            });
        } else if (response.events.some(event => event.endsWith('.update'))) {
            setRecords(prev => prev.map(r => r.$id === payload.$id ? {
                ...r,
                status: payload.status,
                timestamp: payload.timestamp
            } : r));
        } else if (response.events.some(event => event.endsWith('.delete'))) {
            setRecords(prev => prev.filter(r => r.$id === payload.$id));
        }
    });
    return () => { unsubscribe(); };
  }, [sessionId]); 

  const handleToggleAttendance = async (student: UserProfile, currentRecord?: AttendanceRecord, targetStatus: 'present' | 'absent' = 'present') => {
      if (!sessionId) return;
      setProcessingId(student.$id);

      try {
          if (currentRecord) {
              await databases.updateDocument(
                  DATABASE_ID,
                  RECORDS_COLLECTION_ID,
                  currentRecord.$id,
                  {
                      status: targetStatus,
                      timestamp: new Date().toISOString()
                  }
              );
              addToast(`Updated ${student.name} to ${targetStatus}`, 'success');
          } else {
              await databases.createDocument(
                  DATABASE_ID,
                  RECORDS_COLLECTION_ID,
                  ID.unique(),
                  {
                      sessionId: sessionId,
                      studentId: student.$id,
                      status: targetStatus,
                      timestamp: new Date().toISOString()
                  }
              );
              addToast(`Marked ${student.name} as ${targetStatus}`, 'success');
          }
      } catch (error: any) {
          addToast(`Operation failed: ${error.message}`, 'error');
      } finally {
          setProcessingId(null);
      }
  };

  const openEditModal = (student: UserProfile, record: AttendanceRecord | null) => {
    setEditingData({ student, record });
    setEditStatus(record?.status || 'present');
    // Convert ISO to local datetime string (YYYY-MM-DDThh:mm)
    const date = record ? new Date(record.timestamp) : new Date();
    const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditTimestamp(formattedDate);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingData || !sessionId) return;
    const { student, record } = editingData;
    setProcessingId(student.$id);

    try {
      const timestamp = new Date(editTimestamp).toISOString();
      if (record) {
        await databases.updateDocument(DATABASE_ID, RECORDS_COLLECTION_ID, record.$id, {
          status: editStatus,
          timestamp: timestamp
        });
        addToast(`Successfully updated ${student.name}'s record.`, 'success');
      } else {
        await databases.createDocument(DATABASE_ID, RECORDS_COLLECTION_ID, ID.unique(), {
          sessionId,
          studentId: student.$id,
          status: editStatus,
          timestamp: timestamp
        });
        addToast(`Record created for ${student.name}.`, 'success');
      }
      setIsEditModalOpen(false);
    } catch (error: any) {
      addToast(`Update failed: ${error.message}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleSessionStatus = async () => {
    if (!session) return;
    const isClosing = session.isActive;
    const confirmMessage = isClosing 
        ? "Are you sure you want to CLOSE this session? Students will no longer be able to mark their attendance."
        : "Re-open this session? Students will be able to mark attendance again.";

    if (!window.confirm(confirmMessage)) {
        return;
    }

    setIsTogglingSession(true);
    try {
      const newStatus = !session.isActive;
      await databases.updateDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, session.$id, { isActive: newStatus });
      setSession({ ...session, isActive: newStatus });
      addToast(`Session ${newStatus ? 'opened' : 'closed'} successfully`, 'success');
    } catch (error: any) {
      addToast(`Failed to update session: ${error.message}`, 'error');
    } finally {
      setIsTogglingSession(false);
    }
  };

  const downloadCSV = () => {
    if (!session || sortedStudents.length === 0) {
      addToast("No student roster found to export.", "info");
      return;
    }
    const headers = ['Student Name', 'Student ID', 'Time Marked', 'Status'];
    const csvRows = [headers.join(',')];
    
    sortedStudents.forEach(student => {
      const record = records.find(r => r.studentId === student.$id);
      const name = student.name || 'Unknown Student';
      const safeName = `"${name.replace(/"/g, '""')}"`;
      const status = record ? record.status : 'unmarked';
      const time = record ? new Date(record.timestamp).toLocaleString() : 'N/A';
      const safeTime = `"${time}"`;
      
      csvRows.push([safeName, student.$id, safeTime, status].join(','));
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
    addToast("CSV Export started for full roster.", "success");
  };

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <div className="text-xl font-semibold text-indigo-400 animate-pulse">Loading Attendance...</div>
    </div>
  );

  if (!session) return (
    <div className="p-8 text-center text-red-400 bg-gray-900 h-screen">Session not found or error loading session.</div>
  );

  return (
    <div className="min-h-screen relative flex flex-col font-sans text-gray-100 overflow-x-hidden bg-gray-900">
       
       <div className="fixed inset-0 z-0 pointer-events-none">
          <img 
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop" 
            alt="University Background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900/90 to-indigo-900/80"></div>
       </div>

       <nav className="w-full bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 flex justify-between items-center z-20 sticky top-0 shadow-lg">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate('/lecturer/dashboard')} 
                className="inline-flex items-center px-4 py-2 border border-white/10 shadow-sm text-sm font-medium rounded-md text-gray-200 bg-white/5 hover:bg-white/10 focus:outline-none transition-all backdrop-blur-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="-ml-1 mr-2 h-5 w-5 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to Dashboard
            </button>
        </div>
        <h1 className="text-xl font-bold text-white hidden sm:block">Attendance Management</h1>
      </nav>

      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full z-10">
         <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl p-6 mb-6 border border-white/10 animate-fade-in">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-bold text-white drop-shadow-sm">{session.courseName}</h2>
                        <div className="flex items-center bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                            <span className="text-indigo-400 font-black text-sm mr-2">{allStudents.length}</span>
                            <span className="text-indigo-200/60 text-[10px] uppercase font-bold tracking-widest text-nowrap">Students Enrolled</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-gray-400 text-sm">Session ID: <span className="font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded select-all">{session.$id}</span></p>
                        <button 
                            onClick={() => setShowQrModal(true)}
                            className="inline-flex items-center px-3 py-1 border border-indigo-500/30 text-xs font-medium rounded-full text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75zM16.5 19.5h.75v.75h-.75v-.75z" />
                            </svg>
                            Show QR
                        </button>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleSessionStatus}
                            disabled={isTogglingSession}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-lg ${
                                session.isActive 
                                ? 'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30' 
                                : 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
                            }`}
                        >
                            {isTogglingSession ? 'Updating...' : session.isActive ? 'Close Session' : 'Re-open Session'}
                        </button>
                        <div className={`px-4 py-1.5 rounded-lg text-xs font-bold border ${session.isActive ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                            {session.isActive ? 'ACTIVE' : 'CLOSED'}
                        </div>
                    </div>
                    {session.isActive && timeLeft && (
                        <div className="flex items-center gap-1 text-indigo-400 font-bold text-lg animate-pulse">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-mono">{timeLeft}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-8 border-t border-white/10 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Present</p>
                    <p className="text-3xl font-black text-green-400">{records.filter(r => r.status === 'present').length}</p>
                </div>
                <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Absent</p>
                    <p className="text-3xl font-black text-red-400">{records.filter(r => r.status === 'absent').length}</p>
                </div>
                <div className="bg-gray-500/5 p-4 rounded-xl border border-gray-500/10">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unmarked</p>
                    <p className="text-3xl font-black text-gray-400">{allStudents.length - records.length}</p>
                </div>
                <div className="flex items-center justify-end">
                  <button
                      onClick={downloadCSV}
                      disabled={allStudents.length === 0}
                      className="inline-flex items-center px-4 py-3 border border-indigo-500/30 shadow-lg text-sm font-bold rounded-xl text-white bg-indigo-600/20 hover:bg-indigo-600/40 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0l4.5-4.5M12 16.5V3" />
                    </svg>
                    Export Full Roster
                  </button>
                </div>
            </div>
         </div>

         <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10">
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white tracking-tight">Student Roster</h3>
                <span className="text-xs text-gray-500">Live Updates Enabled</span>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left">
                    <thead className="bg-black/30">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student Info</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time Marked</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-black/10">
                        {sortedStudents.map(student => {
                            const record = records.find(r => r.studentId === student.$id);
                            const isProcessing = processingId === student.$id;
                            
                            return (
                                <tr key={student.$id} className="group hover:bg-white/5 transition-all">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm mr-4 border border-white/10 shadow-lg group-hover:scale-105 transition-transform">
                                                {student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{student.name}</div>
                                                <div className="text-[10px] text-gray-500 font-mono tracking-tight uppercase">{student.$id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {!record ? (
                                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-black rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 uppercase tracking-widest">
                                                Unmarked
                                            </span>
                                        ) : record.status === 'present' ? (
                                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-black rounded-full bg-green-500/20 text-green-300 border border-green-500/30 uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                                Present
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-black rounded-full bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                                                Absent
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                        {record ? new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '---'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-2">
                                            <div className="flex bg-black/20 rounded-lg p-1 border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(student, record || null)}
                                                    className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                                    title="Edit Record"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <button
                                                disabled={isProcessing || record?.status === 'present'}
                                                onClick={() => handleToggleAttendance(student, record, 'present')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    record?.status === 'present' 
                                                    ? 'bg-green-600/10 text-green-500/40 border-green-600/10 cursor-default' 
                                                    : 'bg-green-600/20 text-green-300 border-green-500/30 hover:bg-green-600/40'
                                                }`}
                                            >
                                                {isProcessing && !record ? '...' : 'Present'}
                                            </button>
                                            <button
                                                disabled={isProcessing || record?.status === 'absent'}
                                                onClick={() => handleToggleAttendance(student, record, 'absent')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    record?.status === 'absent' 
                                                    ? 'bg-red-600/10 text-red-500/40 border-red-600/10 cursor-default' 
                                                    : 'bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/40'
                                                }`}
                                            >
                                                {isProcessing && !record ? '...' : 'Absent'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
         </div>
      </div>

      {/* Edit Record Modal */}
      {isEditModalOpen && editingData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-white">Manual Record Edit</h3>
                    <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                            {editingData.student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-white font-bold">{editingData.student.name}</p>
                            <p className="text-xs text-gray-500 font-mono tracking-tighter uppercase">{editingData.student.$id}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Attendance Status</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setEditStatus('present')}
                                className={`py-3 rounded-xl border font-bold transition-all ${editStatus === 'present' ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                            >
                                Present
                            </button>
                            <button 
                                onClick={() => setEditStatus('absent')}
                                className={`py-3 rounded-xl border font-bold transition-all ${editStatus === 'absent' ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                            >
                                Absent
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Verification Timestamp</label>
                        <input 
                            type="datetime-local" 
                            value={editTimestamp}
                            onChange={(e) => setEditTimestamp(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button 
                            onClick={() => setIsEditModalOpen(false)}
                            className="flex-1 py-3 border border-white/10 rounded-xl text-gray-300 font-bold hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveEdit}
                            disabled={processingId === editingData.student.$id}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                        >
                            {processingId === editingData.student.$id ? 'Saving...' : 'Save Record'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in" onClick={() => setShowQrModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center max-w-sm w-full animate-fade-in-up border border-white/10" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Scan to Check In</h3>
                <div className="bg-white p-3 rounded-xl border-4 border-indigo-100 shadow-inner mb-6">
                    <canvas ref={qrCanvasRef} className="w-64 h-64"></canvas>
                </div>
                <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 mb-6 flex flex-col items-center">
                    <span className="text-xs text-indigo-400 uppercase font-bold tracking-wider mb-1">Session ID</span>
                    <p className="text-xl font-mono font-bold text-indigo-600 tracking-wider select-all cursor-pointer">{session.$id}</p>
                </div>
                <button 
                    onClick={() => setShowQrModal(false)}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors shadow-lg"
                >
                    Close
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default SessionAttendance;
