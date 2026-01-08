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
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Edit Record Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<{ student: UserProfile; record: AttendanceRecord | null } | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent'>('present');
  const [editTimestamp, setEditTimestamp] = useState('');

  // QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Visual Countdown State
  const [timeLeft, setTimeLeft] = useState<string>(''); 
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const lastNotificationMinuteRef = useRef<number | null>(null);

  const sortedStudents = useMemo(() => {
    return [...allStudents].sort((a, b) => {
      const recordA = records.find(r => r.studentId === a.$id);
      const recordB = records.find(r => r.studentId === b.$id);
      if (recordA && !recordB) return -1;
      if (!recordA && recordB) return 1;
      if (recordA && recordB) return new Date(recordB.timestamp).getTime() - new Date(recordA.timestamp).getTime();
      return a.name.localeCompare(b.name);
    });
  }, [allStudents, records]);

  const toggleSelectAll = () => {
    if (selectedIds.size === allStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allStudents.map(s => s.$id)));
    }
  };

  const toggleSelectStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAction = async (targetStatus: 'present' | 'absent') => {
    if (!sessionId || selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    let successCount = 0;
    
    addToast(`Syncing batch of ${selectedIds.size} records...`, 'info');

    try {
      for (const studentId of Array.from(selectedIds)) {
        const currentRecord = records.find(r => r.studentId === studentId);
        try {
          if (currentRecord) {
            if (currentRecord.status !== targetStatus) {
              await databases.updateDocument(DATABASE_ID, RECORDS_COLLECTION_ID, currentRecord.$id, {
                status: targetStatus,
                timestamp: new Date().toISOString()
              });
              successCount++;
            }
          } else {
            await databases.createDocument(DATABASE_ID, RECORDS_COLLECTION_ID, ID.unique(), {
              sessionId,
              studentId,
              status: targetStatus,
              timestamp: new Date().toISOString()
            });
            successCount++;
          }
        } catch (err) {
          console.error(`Protocol error for node ${studentId}`, err);
        }
      }
      
      addToast(`Batch operation successful. ${successCount} entries committed.`, 'success');
      setSelectedIds(new Set());
    } catch (error: any) {
      addToast(`Batch transition failed: ${error.message}`, 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  useEffect(() => {
      if (showQrModal && session && qrCanvasRef.current) {
          QRCode.toCanvas(qrCanvasRef.current, session.$id, { 
              width: 300, margin: 2, scale: 4, color: { dark: '#4f46e5', light: '#ffffff' }
          }, (error: any) => { if (error) console.error("QR Gen Error:", error); });
      }
  }, [showQrModal, session]);

  // Visual Timer & Near-Expiration Alert logic
  useEffect(() => {
    if (!session || !session.isActive || !session.endTime) { 
        setTimeLeft(''); 
        setProgressPercent(0);
        return; 
    }
    
    const start = new Date(session.lectureStartTime).getTime();
    const end = new Date(session.endTime).getTime();
    const total = end - start;

    const updatePulse = () => {
      const now = new Date().getTime();
      const distance = end - now;
      const minsLeft = Math.ceil(distance / 60000);
      
      // Expiration notification logic
      if (distance > 0 && distance <= 300000 && lastNotificationMinuteRef.current !== minsLeft) {
        addToast(`Temporal Alert: Session node locking in ${minsLeft} minute${minsLeft > 1 ? 's' : ''}.`, 'warning');
        lastNotificationMinuteRef.current = minsLeft;
      }
      
      if (distance <= 0) { 
          if (session.isActive) {
              setSession(prev => prev ? { ...prev, isActive: false } : null);
              addToast("Temporal lock established. Session terminated.", "error");
          }
          setTimeLeft('EXPIRED'); 
          setProgressPercent(0);
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
      setProgressPercent(Math.max(0, Math.min(100, (distance / total) * 100)));
    };
    
    updatePulse();
    const timerInterval = setInterval(updatePulse, 1000);
    return () => clearInterval(timerInterval);
  }, [session, addToast]);

  const fetchData = async () => {
    if (!sessionId) return;
    try {
      const sessionDoc = await databases.getDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, sessionId);
      setSession({
          $id: sessionDoc.$id, courseId: sessionDoc.courseId, courseName: sessionDoc.courseName,
          lectureStartTime: sessionDoc.lectureStartTime, endTime: sessionDoc.endTime,
          venueLat: sessionDoc.venueLat, venueLon: sessionDoc.venueLon, isActive: sessionDoc.isActive
      });
      const recordsResponse = await databases.listDocuments(DATABASE_ID, RECORDS_COLLECTION_ID, [Query.equal('sessionId', sessionId), Query.limit(100)]);
      setRecords(recordsResponse.documents.map(doc => ({
          $id: doc.$id, sessionId: doc.sessionId, studentId: doc.studentId, timestamp: doc.timestamp, status: doc.status as 'present' | 'absent'
      })));
      const studentsResponse = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID, [Query.equal('role', UserRole.STUDENT), Query.limit(100)]);
      
      // Fixed: mapping role to roles array to match UserProfile type
      setAllStudents(studentsResponse.documents.map(doc => ({
          $id: doc.$id, name: doc.name, email: doc.email, roles: [doc.role as UserRole]
      })) as unknown as UserProfile[]);
    } catch (error) { addToast("Terminal Error: Resource sync failed.", 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const unsubscribe = client.subscribe(`databases.${DATABASE_ID}.collections.${RECORDS_COLLECTION_ID}.documents`, (response) => {
        const payload = response.payload as any;
        if (payload.sessionId !== sessionId) return;
        if (response.events.some(event => event.endsWith('.create'))) {
            setRecords(prev => prev.some(r => r.$id === payload.$id) ? prev : [...prev, {
                $id: payload.$id, sessionId: payload.sessionId, studentId: payload.studentId, timestamp: payload.timestamp, status: payload.status
            }]);
        } else if (response.events.some(event => event.endsWith('.update'))) {
            setRecords(prev => prev.map(r => r.$id === payload.$id ? { ...r, status: payload.status, timestamp: payload.timestamp } : r));
        } else if (response.events.some(event => event.endsWith('.delete'))) {
            setRecords(prev => prev.filter(r => r.$id !== payload.$id));
        }
    });
    return () => { unsubscribe(); };
  }, [sessionId]); 

  const handleToggleAttendance = async (student: UserProfile, currentRecord?: AttendanceRecord, targetStatus: 'present' | 'absent' = 'present') => {
      if (!sessionId) return;
      setProcessingId(student.$id);
      try {
          if (currentRecord) {
              await databases.updateDocument(DATABASE_ID, RECORDS_COLLECTION_ID, currentRecord.$id, { status: targetStatus, timestamp: new Date().toISOString() });
              addToast(`Identity ${student.name} synchronized as ${targetStatus}`, 'success');
          } else {
              await databases.createDocument(DATABASE_ID, RECORDS_COLLECTION_ID, ID.unique(), {
                  sessionId, studentId: student.$id, status: targetStatus, timestamp: new Date().toISOString()
              });
              addToast(`Identity ${student.name} committed as ${targetStatus}`, 'success');
          }
      } catch (error: any) { addToast(`Protocol violation: ${error.message}`, 'error'); }
      finally { setProcessingId(null); }
  };

  const openEditModal = (student: UserProfile, record: AttendanceRecord | null) => {
    setEditingData({ student, record });
    setEditStatus(record?.status || 'present');
    const date = record ? new Date(record.timestamp) : new Date();
    setEditTimestamp(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingData || !sessionId) return;
    const { student, record } = editingData;
    setProcessingId(student.$id);
    try {
      const timestamp = new Date(editTimestamp).toISOString();
      if (record) {
        await databases.updateDocument(DATABASE_ID, RECORDS_COLLECTION_ID, record.$id, { status: editStatus, timestamp });
      } else {
        await databases.createDocument(DATABASE_ID, RECORDS_COLLECTION_ID, ID.unique(), { sessionId, studentId: student.$id, status: editStatus, timestamp });
      }
      addToast(`Manual registry edit committed for ${student.name}`, 'success');
      setIsEditModalOpen(false);
    } catch (error: any) { addToast(`Registry update failed: ${error.message}`, 'error'); }
    finally { setProcessingId(null); }
  };

  const handleToggleSessionStatus = async () => {
    if (!session) return;
    const confirm = window.confirm(session.isActive ? "Execute temporal lock? Students will be excluded immediately." : "Resume broadcasting?");
    if (!confirm) return;

    setIsTogglingSession(true);
    try {
      const newStatus = !session.isActive;
      await databases.updateDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, session.$id, { isActive: newStatus });
      setSession({ ...session, isActive: newStatus });
      addToast(`Session Node ${newStatus ? 'Activated' : 'Locked'}`, 'success');
    } catch (error: any) { addToast(`Transition failed: ${error.message}`, 'error'); }
    finally { setIsTogglingSession(false); }
  };

  const downloadCSV = () => {
    if (!session || sortedStudents.length === 0) return;
    const headers = ['Student Name', 'Student ID', 'Time Marked', 'Status'];
    const csvRows = [headers.join(','), ...sortedStudents.map(s => {
      const r = records.find(rec => rec.studentId === s.$id);
      return [`"${s.name.replace(/"/g, '""')}"`, s.$id, `"${r ? new Date(r.timestamp).toLocaleString() : 'N/A'}"`, r ? r.status : 'unmarked'].join(',');
    })];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registry_${session.courseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    addToast("Exporting institutional registry...", "success");
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] animate-pulse">Initializing Data Stream</p>
    </div>
  );

  if (!session) return (
    <div className="p-8 text-center text-rose-500 bg-white h-screen flex flex-col items-center justify-center">
        <h2 className="text-3xl font-black mb-4 tracking-tighter">Handshake Failure</h2>
        <p className="text-slate-400 mb-8 max-w-sm">The node identity requested is currently unreachable or purged from the institutional registry.</p>
        <button onClick={() => navigate('/lecturer/dashboard')} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl">Return to Terminal</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
       
       <nav className="w-full bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <button onClick={() => navigate('/lecturer/dashboard')} className="group flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-all border border-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Terminal
        </button>
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337a49.94 49.94 0 0 0-9.9 2.133V19a.75.75 0 0 1-1.44 0v-6.805a49.94 49.94 0 0 0-9.9-2.133.75.75 0 0 1-.231-1.337A60.65 60.65 0 0 1 11.7 2.805Z" /></svg>
            </div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight hidden sm:block">Identity <span className="text-indigo-600">Oversight</span></h1>
        </div>
        <button onClick={downloadCSV} className="px-6 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl transition-all active:scale-95">Export Registry</button>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8 pb-40 animate-fade-in">
         
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Session Summary Card */}
            <div className="lg:col-span-2 bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl shadow-slate-100/50 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-[-20%] right-[-10%] w-[450px] h-[450px] bg-indigo-50/50 rounded-full blur-[100px]"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${session.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {session.isActive ? 'Spatial Broadcast Active' : 'Registry Locked'}
                        </span>
                        <button onClick={() => setShowQrModal(true)} className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-lg">Broadcast Key</button>
                    </div>
                    <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4 leading-none">{session.courseName}</h2>
                    <p className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-widest leading-none">Node Hash: {session.$id}</p>
                </div>
                
                <div className="relative z-10 mt-12 pt-8 border-t border-slate-50 flex items-center gap-12">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">State Control</span>
                        <button onClick={handleToggleSessionStatus} disabled={isTogglingSession} className={`text-2xl font-black tracking-tighter ${session.isActive ? 'text-indigo-600' : 'text-rose-500'} hover:underline transition-all text-left`}>
                            {isTogglingSession ? 'Syncing...' : session.isActive ? 'Active Terminus' : 'Registry Halt'}
                        </button>
                    </div>
                    <div className="h-10 w-px bg-slate-100"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Entity Reach</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">{records.length} <span className="text-slate-300">/ {allStudents.length}</span></span>
                    </div>
                </div>
            </div>

            {/* Countdown HUD Card */}
            <div className="bg-slate-950 rounded-[3.5rem] p-10 shadow-2xl text-white flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,rgba(79,70,229,0.35),transparent_70%)]"></div>
                <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-8">Temporal Integrity</p>
                    {session.isActive ? (
                        <div className="space-y-6">
                            <div className="flex items-baseline gap-3">
                                <h3 className="text-6xl font-black tracking-tighter animate-pulse-slow font-mono">{timeLeft}</h3>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Left</span>
                            </div>
                            {/* Visual Progress UI */}
                            <div className="space-y-3">
                                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[2px]">
                                    <div 
                                        className={`h-full transition-all duration-1000 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] ${progressPercent < 15 ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`} 
                                        style={{ width: `${progressPercent}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    <span>Initiated</span>
                                    <span>Terminus</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-5xl font-black tracking-tighter text-slate-700">STATIC</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Clock Synchronisation Suspended</p>
                        </div>
                    )}
                </div>
                
                <div className="relative z-10 pt-8 mt-8 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Broadcast</span>
                        <span className="text-sm font-black font-mono text-slate-300">{new Date(session.lectureStartTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Lockdown</span>
                        <span className="text-sm font-black font-mono text-slate-300">{new Date(session.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>
            </div>
         </div>

         {/* Registry Management */}
         <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-2xl shadow-slate-100/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Personnel Roster</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Institutional Node Monitor</p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 rounded-2xl border border-indigo-100 animate-slide-up">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{selectedIds.size} Entities Selected</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="pb-8 w-12 px-4 text-center">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.size === allStudents.length && allStudents.length > 0} 
                                    onChange={toggleSelectAll}
                                    className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                />
                            </th>
                            <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Entity</th>
                            <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Status State</th>
                            <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Registry Key</th>
                            <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {sortedStudents.map(student => {
                            const record = records.find(r => r.studentId === student.$id);
                            const isSelected = selectedIds.has(student.$id);
                            const isProcessing = processingId === student.$id;
                            
                            return (
                                <tr key={student.$id} className={`group hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                                    <td className="py-8 px-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={() => toggleSelectStudent(student.$id)}
                                            className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                        />
                                    </td>
                                    <td className="py-8 px-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg group-hover:scale-110 transition-transform">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 tracking-tight leading-none mb-1.5">{student.name}</span>
                                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">ID: {student.$id.slice(0, 12)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-8 px-4">
                                        {!record ? (
                                            <span className="px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase border bg-slate-50 border-slate-100 text-slate-400 tracking-widest">Unmarked</span>
                                        ) : (
                                            <span className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase border tracking-widest ${record.status === 'present' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                                                {record.status}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-8 px-4 text-[11px] font-mono font-bold text-slate-600">
                                        {record ? new Date(record.timestamp).toLocaleTimeString() : '---'}
                                    </td>
                                    <td className="py-8 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditModal(student, record || null)} className="p-3 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button 
                                                disabled={isProcessing || record?.status === 'present'} 
                                                onClick={() => handleToggleAttendance(student, record, 'present')} 
                                                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${record?.status === 'present' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-100'}`}
                                            >
                                                Present
                                            </button>
                                            <button 
                                                disabled={isProcessing || record?.status === 'absent'} 
                                                onClick={() => handleToggleAttendance(student, record, 'absent')} 
                                                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${record?.status === 'absent' ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:text-rose-600 hover:border-rose-100'}`}
                                            >
                                                Absent
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {allStudents.length === 0 && (
                            <tr><td colSpan={5} className="py-20 text-center text-[11px] font-black uppercase tracking-widest text-slate-300 italic">No registered entities found for this node.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
         </div>
      </main>

      {/* Bulk Action Overlay HUD */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 animate-slide-up w-full max-w-2xl px-6">
            <div className="bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-[3rem] px-10 py-7 flex items-center justify-between shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em] mb-1">Batch Registry Control</span>
                    <span className="text-xl font-black text-white tracking-tight">{selectedIds.size} Identities Staged</span>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => handleBulkAction('present')} disabled={isBulkProcessing} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 active:scale-95">Set Present</button>
                    <button onClick={() => handleBulkAction('absent')} disabled={isBulkProcessing} className="px-10 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-rose-600/20 active:scale-95">Set Absent</button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-3 text-slate-500 hover:text-white transition-colors">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Record Edit Modal */}
      {isEditModalOpen && editingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
            <div className="bg-white rounded-[3.5rem] p-12 w-full max-w-md shadow-2xl border border-slate-100 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="mb-10">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Registry Revision</h3>
                    <p className="text-slate-500 text-sm font-medium mt-2">Adjusting entity: <span className="text-indigo-600 font-black">{editingData.student.name}</span></p>
                </div>

                <div className="space-y-10">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5 block">State Declaration</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setEditStatus('present')} className={`py-5 rounded-3xl border font-black text-[10px] uppercase tracking-widest transition-all ${editStatus === 'present' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>Present</button>
                            <button onClick={() => setEditStatus('absent')} className={`py-5 rounded-3xl border font-black text-[10px] uppercase tracking-widest transition-all ${editStatus === 'absent' ? 'bg-rose-600 border-rose-600 text-white shadow-xl shadow-rose-100' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>Absent</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-5 block">Temporal Marker</label>
                        <input type="datetime-local" value={editTimestamp} onChange={(e) => setEditTimestamp(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] px-8 py-5 text-slate-900 font-mono font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"/>
                    </div>
                    <div className="flex gap-4 pt-6">
                        <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">Discard</button>
                        <button onClick={handleSaveEdit} className="flex-[2] bg-slate-900 text-white font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-[0.2em] shadow-2xl transition-all hover:bg-indigo-600 active:scale-95">Commit Edit</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Broadcast QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-3xl animate-fade-in" onClick={() => setShowQrModal(false)}>
            <div className="bg-white rounded-[4.5rem] p-16 flex flex-col items-center max-w-md w-full shadow-2xl border border-white/20 animate-slide-up relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-indigo-50 rounded-full blur-[80px]"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                    <div className="bg-indigo-600 p-4 rounded-[2.5rem] mb-10 shadow-2xl shadow-indigo-600/30 rotate-3 group-hover:rotate-0 transition-all">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01"/></svg>
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Spatial Node</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-12 text-center leading-relaxed">Verification Broadcast Active</p>
                    
                    <div className="p-6 bg-white rounded-[3.5rem] border-[3px] border-indigo-50 shadow-inner mb-12 transform hover:scale-105 transition-all duration-500">
                        <canvas ref={qrCanvasRef} className="w-64 h-64"></canvas>
                    </div>
                    
                    <div className="w-full bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col items-center gap-3 mb-10">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Identity Token</span>
                        <span className="text-2xl font-black font-mono text-indigo-600 select-all tracking-wider">{session.$id}</span>
                    </div>

                    <button onClick={() => setShowQrModal(false)} className="w-full py-6 bg-slate-950 text-white font-black text-[11px] uppercase tracking-widest rounded-3xl hover:bg-indigo-600 transition-all shadow-2xl active:scale-95">Deactivate Broadcast</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default SessionAttendance;