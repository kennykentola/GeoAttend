
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { databases, storage } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { 
  DATABASE_ID, 
  SESSIONS_COLLECTION_ID, 
  COURSES_COLLECTION_ID, 
  NOTES_COLLECTION_ID,
  USERS_COLLECTION_ID,
  STORAGE_BUCKET_ID,
  RECORDS_COLLECTION_ID
} from '../../config/constants';
import { AttendanceSession, Course, LectureNote, UserProfile, UserRole, AttendanceRecord } from '../../types';
import { ID, Query } from 'appwrite';
import { useToast } from '../../context/ToastContext';
import CreateCourseModal from '../../components/lecturer/CreateCourseModal';

type DetailTab = 'sessions' | 'history' | 'roster' | 'resources';

const CourseDetail: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [notes, setNotes] = useState<LectureNote[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]); 
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<DetailTab>('sessions');
  
  // History & Filtering State
  const [allRecords, setAllRecords] = useState<(AttendanceRecord & { studentName?: string; sessionTime?: string })[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historySession, setHistorySession] = useState('all');
  const [historyDateStart, setHistoryDateStart] = useState('');
  const [historyDateEnd, setHistoryDateEnd] = useState('');

  const [courseStats, setCourseStats] = useState({
    totalAttendance: 0,
    activeSessions: 0,
    totalSessions: 0
  });

  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);

  const noteInputRef = useRef<HTMLInputElement>(null);
  
  const fetchStudents = async () => {
    if (user?.$id === 'dev-bypass-node') {
        setStudents([
            { $id: 'u1', name: 'John Doe', email: 'j.doe@inst.edu', roles: [UserRole.STUDENT] },
            { $id: 'u2', name: 'Alice Smith', email: 'a.smith@inst.edu', roles: [UserRole.STUDENT] },
            { $id: 'u3', name: 'Bob Johnson', email: 'b.johnson@inst.edu', roles: [UserRole.STUDENT] }
        ]);
        return;
    }
    try {
        const response = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID, [Query.limit(100)]);
        const mappedStudents = response.documents
            .filter(doc => (doc.roles && doc.roles.includes(UserRole.STUDENT)) || doc.role === UserRole.STUDENT)
            .map(doc => ({
                $id: doc.$id,
                name: doc.name,
                email: doc.email,
                roles: doc.roles || [doc.role]
            })) as UserProfile[];
        setStudents(mappedStudents);
    } catch (error: any) {
        console.warn("Registry sync deferred.");
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      if (user?.$id === 'dev-bypass-node') {
          const mock = [{ $id: 'c1', name: 'Distributed Systems', code: 'CSC 402', description: 'Advanced computing node architectures' }];
          setCourses(mock as any);
          setSelectedCourseId('c1');
          return;
      }
      try {
        const response = await databases.listDocuments(DATABASE_ID, COURSES_COLLECTION_ID);
        const mapped = response.documents.map(doc => ({
          $id: doc.$id,
          name: doc.name,
          code: doc.code,
          description: doc.description
        })) as Course[];
        setCourses(mapped);
        if (mapped.length > 0) setSelectedCourseId(mapped[0].$id);
      } catch (error: any) {
        addToast(`Core Fetch Failure: ${error.message}`, 'error');
      }
    };
    fetchCourses();
    fetchStudents();
  }, [user?.$id, addToast]);

  useEffect(() => {
    if (!selectedCourseId) return;

    const fetchSessionsAndStats = async () => {
      setLoading(true);

      if (user?.$id === 'dev-bypass-node') {
          setTimeout(() => {
              setSessions([{ $id: 's1', courseId: 'c1', courseName: 'Distributed Systems', lectureStartTime: new Date().toISOString(), endTime: new Date().toISOString(), venueLat: 0, venueLon: 0, isActive: true, broadcastCode: '123456' }] as any);
              setCourseStats({ totalAttendance: 24, activeSessions: 1, totalSessions: 5 });
              setLoading(false);
          }, 600);
          return;
      }

      try {
        const sessionResponse = await databases.listDocuments(
          DATABASE_ID,
          SESSIONS_COLLECTION_ID,
          [Query.equal('courseId', selectedCourseId), Query.orderDesc('$createdAt'), Query.limit(50)]
        );
        const mappedSessions = sessionResponse.documents.map(doc => ({
          $id: doc.$id,
          courseId: doc.courseId,
          courseName: doc.courseName,
          lectureStartTime: doc.lectureStartTime,
          endTime: doc.endTime,
          venueLat: doc.venueLat,
          venueLon: doc.venueLon,
          isActive: doc.isActive,
          broadcastCode: doc.broadcastCode
        })) as AttendanceSession[];
        setSessions(mappedSessions);

        const activeCount = mappedSessions.filter(s => s.isActive).length;
        const validSessionIds = mappedSessions.map(s => s.$id).filter(id => !!id);
        let totalRecords = 0;
        
        if (validSessionIds.length > 0) {
            try {
                const recordsResponse = await databases.listDocuments(
                    DATABASE_ID,
                    RECORDS_COLLECTION_ID,
                    [Query.equal('sessionId', validSessionIds), Query.limit(1)]
                );
                totalRecords = recordsResponse.total;
            } catch (e) {
                console.warn("Analytics handshake deferred.");
            }
        }

        setCourseStats({
            totalAttendance: totalRecords,
            activeSessions: activeCount,
            totalSessions: mappedSessions.length
        });
      } catch (error: any) {
        addToast(`Registry Error: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        if (user?.$id === 'dev-bypass-node') {
            setAllRecords([
                { $id: 'r1', sessionId: 's1', studentId: 'u1', status: 'present', timestamp: new Date().toISOString(), studentName: 'John Doe', sessionTime: '10:00 AM' },
                { $id: 'r2', sessionId: 's1', studentId: 'u2', status: 'absent', timestamp: new Date().toISOString(), studentName: 'Alice Smith', sessionTime: '10:00 AM' }
            ]);
            setLoadingHistory(false);
            return;
        }

        try {
            const validSessionIds = sessions.map(s => s.$id);
            if (validSessionIds.length === 0) {
                setAllRecords([]);
                setLoadingHistory(false);
                return;
            }

            const recordsRes = await databases.listDocuments(
                DATABASE_ID,
                RECORDS_COLLECTION_ID,
                [Query.equal('sessionId', validSessionIds), Query.orderDesc('timestamp'), Query.limit(100)]
            );

            const sessionMap = new Map(sessions.map(s => [s.$id, new Date(s.lectureStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })]));
            const studentMap = new Map(students.map(s => [s.$id, s.name]));

            const enriched = recordsRes.documents.map(doc => ({
                ...doc,
                studentName: studentMap.get(doc.studentId) || 'Unknown Entity',
                sessionTime: sessionMap.get(doc.sessionId) || 'Unknown'
            })) as any;

            setAllRecords(enriched);
        } catch (e) {
            console.warn("History fetch deferred.");
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchNotes = async () => {
      setLoadingNotes(true);
      if (user?.$id === 'dev-bypass-node') {
          setNotes([{ $id: 'n1', title: 'Session 01: Node Architectures', fileId: 'f1', $createdAt: new Date().toISOString() }] as any);
          setLoadingNotes(false);
          return;
      }
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          NOTES_COLLECTION_ID,
          [Query.equal('courseId', selectedCourseId), Query.limit(50)]
        );
        setNotes(response.documents as unknown as LectureNote[]);
      } catch (error) {
        console.warn("Asset fetch deferred.");
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchSessionsAndStats();
    fetchNotes();
    if (activeTab === 'history') fetchHistory();
  }, [selectedCourseId, user?.$id, activeTab, sessions.length, addToast]);

  const filteredHistory = useMemo(() => {
      return allRecords.filter(r => {
          const matchSearch = r.studentName?.toLowerCase().includes(historySearch.toLowerCase());
          const matchStatus = historyStatus === 'all' || r.status === historyStatus;
          const matchSession = historySession === 'all' || r.sessionId === historySession;
          
          const rDate = new Date(r.timestamp);
          const matchStart = !historyDateStart || rDate >= new Date(historyDateStart);
          const matchEnd = !historyDateEnd || rDate <= new Date(historyDateEnd + 'T23:59:59');
          
          return matchSearch && matchStatus && matchSession && matchStart && matchEnd;
      });
  }, [allRecords, historySearch, historyStatus, historySession, historyDateStart, historyDateEnd]);

  const handleCreateSession = () => {
    setCreatingSession(true);
    if (!navigator.geolocation) {
      addToast("GPS protocol required.", "error");
      setCreatingSession(false);
      return;
    }
    
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (user?.$id === 'dev-bypass-node') {
        const mockSession = { 
            $id: ID.unique(), 
            courseId: selectedCourseId, 
            courseName: 'Distributed Systems', 
            lectureStartTime: new Date().toISOString(), 
            endTime: new Date().toISOString(), 
            venueLat: 0, 
            venueLon: 0, 
            isActive: true,
            broadcastCode: randomCode
        };
        setSessions(prev => [mockSession as any, ...prev]);
        addToast(`Broadcast code generated: ${randomCode}`, "info");
        setCreatingSession(false);
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const course = courses.find(c => c.$id === selectedCourseId);
        const start = new Date();
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const newSession = await databases.createDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, ID.unique(), {
            courseId: selectedCourseId,
            courseName: course?.name || 'Academic Stream',
            lectureStartTime: start.toISOString(),
            endTime: end.toISOString(),
            venueLat: pos.coords.latitude,
            venueLon: pos.coords.longitude,
            isActive: true,
            broadcastCode: randomCode
        });
        setSessions(prev => [newSession as unknown as AttendanceSession, ...prev]);
        addToast(`Node active. Broadcast Code: ${randomCode}`, 'success');
      } catch (error: any) { 
        addToast("Initialization error: " + error.message, 'error'); 
      } finally { setCreatingSession(false); }
    }, () => {
      addToast("GPS Handshake Refused.", 'error');
      setCreatingSession(false);
    });
  };

  const getDownloadUrl = (fileId: string) => {
    return storage.getFileDownload(STORAGE_BUCKET_ID, fileId);
  };

  return (
    <div className="min-h-screen relative flex flex-col font-sans text-gray-100 bg-gray-900 selection:bg-indigo-500/30 overflow-x-hidden">
       <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900/95 to-indigo-950/80"></div>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px]"></div>
       </div>

       <nav className="w-full bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 flex justify-between items-center z-20 sticky top-0 shadow-lg">
        <div className="flex items-center gap-3">
            <span className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-400"><path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347" /></svg>
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Faculty <span className="text-indigo-500">Oversight</span></h1>
        </div>
        <button onClick={() => logout()} className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl transition-all font-black uppercase tracking-widest">Terminate Session</button>
      </nav>

      <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full z-10 space-y-12 pb-24">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
              <h2 className="text-5xl font-black text-white tracking-tighter leading-none">Institutional Streams</h2>
              <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.3em]">Command Center for Registry Management</p>
          </div>
          <button onClick={() => setShowCourseModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Initialize Stream
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map(c => (
                <div key={c.$id} onClick={() => setSelectedCourseId(c.$id)} className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer h-56 flex flex-col justify-between group ${selectedCourseId === c.$id ? 'bg-indigo-600/15 border-indigo-500 shadow-[0_32px_64px_-16px_rgba(79,70,229,0.3)] ring-2 ring-indigo-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div>
                        <h3 className="font-black text-2xl truncate tracking-tighter text-white">{c.name}</h3>
                        <p className="text-[10px] font-black mt-2 uppercase tracking-[0.4em] text-indigo-400">{c.code}</p>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/5 pt-5">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Global Roster</span>
                            <span className="text-2xl font-black text-white">{students.length}</span>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${selectedCourseId === c.$id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 group-hover:bg-white/10'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {selectedCourseId && (
            <div className="animate-fade-in space-y-8">
                {/* Dashboard Tabs */}
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-[2rem] border border-white/5 w-fit">
                    {[
                        { id: 'sessions', label: 'Nodes', icon: '🛰️' },
                        { id: 'history', label: 'History', icon: '📋' },
                        { id: 'roster', label: 'Roster', icon: '👥' },
                        { id: 'resources', label: 'Assets', icon: '📁' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as DetailTab)}
                            className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all ${
                                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { label: 'Recorded Presence', value: courseStats.totalAttendance, color: 'text-indigo-400', sub: 'Verified across all nodes' },
                        { label: 'Active Channels', value: courseStats.activeSessions, color: 'text-emerald-400', sub: 'Spatial broadcasts live' },
                        { label: 'Total Nodes', value: courseStats.totalSessions, color: 'text-amber-400', sub: 'Registry instances' },
                        { label: 'Asset Library', value: notes.length, color: 'text-purple-400', sub: 'Course materials' }
                    ].map((stat, i) => (
                        <div key={i} className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-2xl flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">{stat.label}</p>
                                <p className={`text-5xl font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
                            </div>
                            <p className="text-[9px] text-slate-600 font-bold uppercase mt-4">{stat.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Tab Content Areas */}
                <div className="bg-white/5 backdrop-blur-3xl rounded-[3.5rem] p-10 border border-white/10 shadow-2xl relative overflow-hidden">
                    
                    {/* View: Sessions */}
                    {activeTab === 'sessions' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-white tracking-tighter">Presence Registry</h3>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active spatial verification nodes</p>
                                </div>
                                <button onClick={handleCreateSession} disabled={creatingSession} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-emerald-600/20">
                                    {creatingSession ? 'Initializing...' : 'Launch Session Node'}
                                </button>
                            </div>
                            {sessions.length === 0 ? (
                                <div className="py-32 text-center bg-black/20 rounded-[2.5rem] border border-dashed border-white/10">
                                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">No active verification instances found</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-[2.5rem] border border-white/10">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                            <tr><th className="px-8 py-6">Identity Hash</th><th className="px-8 py-6">Broadcast Code</th><th className="px-8 py-6">Node State</th><th className="px-8 py-6 text-right">Command</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 font-medium">
                                            {sessions.map(s => (
                                                <tr key={s.$id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-8 py-6 font-mono text-slate-400 text-xs font-bold">{s.$id.slice(0, 12)}</td>
                                                    <td className="px-8 py-6">
                                                        <span className="text-3xl font-black text-indigo-400 font-mono tracking-[0.2em]">{s.broadcastCode || '------'}</span>
                                                    </td>
                                                    <td className="px-8 py-6"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${s.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{s.isActive ? 'Spatial Broadcast' : 'Temporal Lock'}</span></td>
                                                    <td className="px-8 py-6 text-right"><button onClick={() => navigate(`/lecturer/session/${s.$id}`)} className="text-[10px] font-black uppercase text-white bg-slate-900 border border-white/10 px-8 py-3.5 rounded-xl hover:bg-indigo-600 hover:border-indigo-500 transition-all shadow-xl group-hover:scale-105 active:scale-95">Inspect Node</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View: History */}
                    {activeTab === 'history' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-white tracking-tighter">Global History</h3>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Search and filter verification records</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
                                    <input 
                                        type="text" placeholder="Search Entity..." value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                                        className="bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    />
                                    <select 
                                        value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}
                                        className="bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold outline-none"
                                    >
                                        <option value="all">All States</option>
                                        <option value="present">Present</option>
                                        <option value="absent">Absent</option>
                                    </select>
                                    <input 
                                        type="date" value={historyDateStart} onChange={e => setHistoryDateStart(e.target.value)}
                                        className="bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold outline-none"
                                    />
                                    <input 
                                        type="date" value={historyDateEnd} onChange={e => setHistoryDateEnd(e.target.value)}
                                        className="bg-black/30 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold outline-none"
                                    />
                                </div>
                            </div>

                            {loadingHistory ? (
                                <div className="py-32 flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest animate-pulse">Syncing History Registry</p>
                                </div>
                            ) : filteredHistory.length === 0 ? (
                                <div className="py-32 text-center bg-black/20 rounded-[2.5rem] border border-dashed border-white/10">
                                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">No records matching query parameters</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-[2.5rem] border border-white/10">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                            <tr><th className="px-8 py-6">Personnel Entity</th><th className="px-8 py-6">Temporal Marker</th><th className="px-8 py-6">State</th><th className="px-8 py-6 text-right">Justification</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredHistory.map(r => (
                                                <tr key={r.$id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center font-black text-xs border border-white/10">{r.studentName?.charAt(0)}</div>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-white text-sm tracking-tight">{r.studentName}</span>
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{r.studentId}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-300 text-xs font-bold">{new Date(r.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                                            <span className="text-[9px] text-slate-500 font-bold uppercase">{r.sessionTime}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${r.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>{r.status}</span>
                                                    </td>
                                                    <td className="px-8 py-6 text-right text-[10px] text-slate-500 font-medium italic">
                                                        {r.reason || 'None provided'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View: Roster */}
                    {activeTab === 'roster' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black text-white tracking-tighter">Identity Roster</h3>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Institutional personnel currently mapped to this node</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {students.map(s => (
                                    <div key={s.$id} className="p-8 rounded-[2.5rem] bg-black/20 border border-white/10 hover:border-indigo-500/50 transition-all group">
                                        <div className="flex items-center gap-5 mb-6">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-xl group-hover:scale-110 transition-transform">
                                                {s.name.charAt(0)}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h4 className="text-xl font-black text-white truncate tracking-tight">{s.name}</h4>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.email}</p>
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Identity Key</span>
                                            <span className="text-[11px] font-mono font-bold text-indigo-400 select-all">{s.$id}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* View: Resources */}
                    {activeTab === 'resources' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-white tracking-tighter">Asset Library</h3>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Institutional resources and spatial notes</p>
                                </div>
                                <div className="flex gap-2">
                                    <input type="file" ref={noteInputRef} className="hidden" onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploadingNote(true);
                                        try {
                                            const up = await storage.createFile(STORAGE_BUCKET_ID, ID.unique(), file);
                                            const doc = await databases.createDocument(DATABASE_ID, NOTES_COLLECTION_ID, ID.unique(), {
                                                courseId: selectedCourseId, title: file.name, fileId: up.$id, fileName: file.name, mimeType: file.type, size: file.size
                                            });
                                            setNotes(p => [doc as any, ...p]);
                                            addToast("Asset uploaded.", "success");
                                        } catch (err: any) { addToast(err.message, "error"); }
                                        finally { setUploadingNote(false); }
                                    }}/>
                                    <button onClick={() => noteInputRef.current?.click()} disabled={uploadingNote} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-2xl shadow-purple-600/20">
                                        {uploadingNote ? 'Uploading...' : 'Transmit Asset'}
                                    </button>
                                </div>
                            </div>
                            {loadingNotes ? (
                                <div className="py-32 flex justify-center"><div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div></div>
                            ) : notes.length === 0 ? (
                                <div className="py-32 text-center bg-black/20 rounded-[2.5rem] border border-dashed border-white/10">
                                    <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">Library currently empty</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {notes.map(n => (
                                        <div key={n.$id} className="p-8 rounded-[2.5rem] bg-black/20 border border-white/10 hover:bg-white/5 transition-all flex flex-col justify-between group h-52">
                                            <div className="flex items-start gap-4">
                                                <span className="text-4xl">📄</span>
                                                <div className="overflow-hidden">
                                                    <h4 className="font-black text-white text-lg leading-tight truncate group-hover:text-indigo-400 transition-colors" title={n.title}>{n.title}</h4>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{new Date(n.$createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-6 border-t border-white/5">
                                                <a href={getDownloadUrl(n.fileId)} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 tracking-widest transition-colors">Download</a>
                                                <button onClick={async () => {
                                                    if (!window.confirm("Purge asset?")) return;
                                                    try {
                                                        await storage.deleteFile(STORAGE_BUCKET_ID, n.fileId);
                                                        await databases.deleteDocument(DATABASE_ID, NOTES_COLLECTION_ID, n.$id);
                                                        setNotes(p => p.filter(x => x.$id !== n.$id));
                                                        addToast("Asset purged.", "info");
                                                    } catch (err: any) { addToast(err.message, "error"); }
                                                }} className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-400 tracking-widest transition-colors">Purge</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
      <CreateCourseModal isOpen={showCourseModal} onClose={() => setShowCourseModal(false)} onCourseCreated={(nc) => setCourses(p => [...p, nc])}/>
    </div>
  );
};

export default CourseDetail;
