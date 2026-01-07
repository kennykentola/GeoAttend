
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { databases } from '../../config/appwriteConfig';
import { DATABASE_ID, RECORDS_COLLECTION_ID, SESSIONS_COLLECTION_ID, COURSES_COLLECTION_ID } from '../../config/constants';
import { Query } from 'appwrite';
import { AttendanceRecord, Course, AttendanceSession } from '../../types';
import { useToast } from '../../context/ToastContext';

const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  
  const [records, setRecords] = useState<(AttendanceRecord & { sessionName?: string; courseId?: string })[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0 });
  const [totalRecordsInRegistry, setTotalRecordsInRegistry] = useState(0);

  // Filter States
  const [courseFilter, setCourseFilter] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const RECORDS_PER_PAGE = 20;

  const fetchGlobalStats = async () => {
    if (!user?.$id) return;
    try {
        if (user.$id === 'dev-bypass-node') {
            setStats({ present: 22, absent: 15, total: 37 });
            return;
        }
        const [p, a] = await Promise.all([
            databases.listDocuments(DATABASE_ID, RECORDS_COLLECTION_ID, [Query.equal('studentId', user.$id), Query.equal('status', 'present'), Query.limit(1)]),
            databases.listDocuments(DATABASE_ID, RECORDS_COLLECTION_ID, [Query.equal('studentId', user.$id), Query.equal('status', 'absent'), Query.limit(1)])
        ]);
        setStats({ present: p.total, absent: a.total, total: p.total + a.total });
    } catch (e) { console.warn("Stats isolated."); }
  };

  const fetchActiveNodes = async () => {
    if (!user?.$id) return;
    try {
        if (user.$id === 'dev-bypass-node') {
            setActiveSessions([{ $id: 's1', courseId: 'c1', courseName: 'Distributed Systems', broadcastCode: '582934', isActive: true, lectureStartTime: '', endTime: '', venueLat: 0, venueLon: 0 }]);
            return;
        }
        const res = await databases.listDocuments(DATABASE_ID, SESSIONS_COLLECTION_ID, [Query.equal('isActive', true), Query.limit(5)]);
        setActiveSessions(res.documents as unknown as AttendanceSession[]);
    } catch (e) { console.warn("Node sync deferred."); }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    if (!user?.$id) return;

    try {
      // 1. Fetch Courses
      let courseList: Course[] = [];
      if (user.$id === 'dev-bypass-node') {
        courseList = [
          { $id: 'c1', name: 'Distributed Systems', code: 'CSC402', description: '' },
          { $id: 'c2', name: 'Computer Architecture', code: 'CSC301', description: '' }
        ];
      } else {
        const res = await databases.listDocuments(DATABASE_ID, COURSES_COLLECTION_ID);
        courseList = res.documents as unknown as Course[];
      }
      setCourses(courseList);

      // 2. Fetch Records
      await fetchHistoryBatch(0);
    } catch (e) {
      console.error(e);
      addToast("Failed to fetch historical registry.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryBatch = async (offset: number) => {
    if (!user?.$id) return;

    if (user.$id === 'dev-bypass-node') {
        const mock = [
          { $id: 'r1', sessionId: 's1', studentId: 'u1', status: 'present', timestamp: new Date().toISOString(), sessionName: 'Distributed Systems', courseId: 'c1' },
          { $id: 'r2', sessionId: 's2', studentId: 'u1', status: 'absent', timestamp: new Date(Date.now() - 86400000).toISOString(), sessionName: 'Computer Architecture', courseId: 'c2' }
        ];
        setRecords(offset === 0 ? mock : [...records, ...mock]);
        setTotalRecordsInRegistry(37); // Simulated total
        return;
    }

    try {
      const res = await databases.listDocuments(DATABASE_ID, RECORDS_COLLECTION_ID, [
        Query.equal('studentId', user.$id),
        Query.orderDesc('timestamp'),
        Query.limit(RECORDS_PER_PAGE),
        Query.offset(offset)
      ]);
      
      setTotalRecordsInRegistry(res.total);

      // Fetch active sessions to map names - we fetch a larger chunk to ensure we have context
      const sessionsRes = await databases.listDocuments(DATABASE_ID, SESSIONS_COLLECTION_ID, [Query.limit(100)]);
      const sessionsMap = new Map<string, { name: string; courseId: string }>(
        sessionsRes.documents.map((s: any) => [s.$id, { name: s.courseName, courseId: s.courseId }])
      );

      const batch = res.documents.map(doc => {
        const session = sessionsMap.get(doc.sessionId);
        return {
          ...doc,
          sessionName: session?.name || 'Unknown Session',
          courseId: session?.courseId || 'unknown'
        };
      }) as any;

      setRecords(prev => offset === 0 ? batch : [...prev, ...batch]);
    } catch (e) {
      addToast("Error syncing history batch.", "error");
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchHistoryBatch(records.length);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchGlobalStats();
    fetchActiveNodes();
    fetchInitialData();
    const int = setInterval(fetchActiveNodes, 30000);
    return () => clearInterval(int);
  }, [user?.$id]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchCourse = courseFilter === 'all' || r.courseId === courseFilter;
      const rDate = new Date(r.timestamp);
      const matchStart = !dateStart || rDate >= new Date(dateStart);
      const matchEnd = !dateEnd || rDate <= new Date(dateEnd + 'T23:59:59');
      return matchCourse && matchStart && matchEnd;
    });
  }, [records, courseFilter, dateStart, dateEnd]);

  const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
  const isAtRisk = stats.total > 5 && attendanceRate < 75;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 transition-all duration-500">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-40">
        <div className={`absolute top-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full blur-[140px] animate-blob transition-colors duration-1000 ${isAtRisk ? 'bg-rose-100' : 'bg-indigo-50'}`}></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <nav className="w-full px-8 py-5 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/student/dashboard')}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white"><path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337a49.94 49.94 0 0 0-9.9 2.133V19a.75.75 0 0 1-1.44 0v-6.805a49.94 49.94 0 0 0-9.9-2.133.75.75 0 0 1-.231-1.337A60.65 60.65 0 0 1 11.7 2.805Z" /></svg>
            </div>
            <span className="text-lg font-black tracking-tighter leading-none">HIA <span className="text-indigo-600">Portal</span></span>
          </div>
          <button onClick={() => logout()} className="px-5 py-2.5 rounded-xl bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-200">Terminate</button>
        </nav>

        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-10 space-y-10">
          
          {/* Risk Alert Panel */}
          {isAtRisk && (
              <section className="bg-rose-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-rose-200 animate-pulse-slow">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                      <div className="flex items-center gap-6">
                          <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner">⚠️</div>
                          <div>
                              <h3 className="text-3xl font-black tracking-tight leading-none">Compliance Alert</h3>
                              <p className="text-rose-100 font-bold mt-2 uppercase tracking-widest text-[10px]">Your registry rate has fallen below institutional minimums (75%)</p>
                          </div>
                      </div>
                      <Link to="/student/attendance" className="px-12 py-5 bg-white text-rose-600 font-black rounded-3xl uppercase tracking-widest text-[11px] shadow-2xl hover:scale-105 transition-transform">Correct Standing</Link>
                  </div>
              </section>
          )}

          {/* Aggregate HUD */}
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-[2.25rem] bg-slate-900 text-white flex items-center justify-center font-black text-4xl shadow-2xl">
                        {user?.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{user?.name}</h1>
                        <p className="text-slate-400 font-bold text-lg">{user?.email}</p>
                        <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-100 mt-2">Active Student Node</span>
                    </div>
                </div>
                <Link to="/student/attendance" className="w-full md:w-auto px-10 py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 text-center">Mark Presence</Link>
            </div>

            <div className={`rounded-[3rem] p-8 border shadow-xl flex flex-col justify-between transition-all duration-1000 ${isAtRisk ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                <div className="flex justify-between items-start">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isAtRisk ? 'text-rose-500' : 'text-slate-400'}`}>Consistency</p>
                    <span className="text-xl">📈</span>
                </div>
                <div className="mt-4">
                    <p className={`text-6xl font-black tracking-tighter ${isAtRisk ? 'text-rose-600' : 'text-indigo-600'}`}>{attendanceRate}%</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isAtRisk ? 'text-rose-400' : 'text-slate-400'}`}>Minimum Required: 75%</p>
                </div>
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-8 shadow-xl flex flex-col justify-between text-white">
                <div className="flex justify-between items-start opacity-60">
                    <p className="text-[10px] font-black uppercase tracking-widest">Aggregate</p>
                    <span className="text-xl">📊</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <p className="text-2xl font-black text-emerald-400">{stats.present}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Verified</p>
                    </div>
                    <div>
                        <p className="text-2xl font-black text-rose-400">{stats.absent}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Missed</p>
                    </div>
                </div>
            </div>
          </section>

          {/* Active Nodes */}
          {activeSessions.length > 0 && (
            <section className="space-y-6">
                <div className="flex items-center gap-3 px-4">
                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span></span>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Live Broadcast Nodes</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeSessions.map((session) => (
                        <div key={session.$id} className="bg-white rounded-[2.5rem] p-8 border-2 border-indigo-100 shadow-xl group hover:border-indigo-600 transition-all duration-500">
                            <h3 className="font-black text-xl text-slate-900 tracking-tight">{session.courseName}</h3>
                            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-100 my-6">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Broadcast Code</span>
                                <span className="text-4xl font-black text-indigo-600 font-mono">{session.broadcastCode || '------'}</span>
                            </div>
                            <button onClick={() => navigate(`/student/attendance?sessionId=${session.$id}`)} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-indigo-600 transition-all text-[10px] uppercase tracking-widest">Join Node</button>
                        </div>
                    ))}
                </div>
            </section>
          )}

          {/* Historical Table and Filters */}
          <section className="space-y-8">
            <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl space-y-10">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">History Log</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">Registry Temporal Records</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Stream Filter</label>
                            <select 
                                value={courseFilter} 
                                onChange={(e) => setCourseFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                            >
                                <option value="all">All Courses</option>
                                {courses.map(c => <option key={c.$id} value={c.$id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Start Date</label>
                            <input 
                                type="date" 
                                value={dateStart} 
                                onChange={(e) => setDateStart(e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">End Date</label>
                            <input 
                                type="date" 
                                value={dateEnd} 
                                onChange={(e) => setDateEnd(e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-[2rem] border border-slate-50">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-6">Lecture Session</th>
                                <th className="px-8 py-6">Temporal Marker</th>
                                <th className="px-8 py-6">Registry State</th>
                                <th className="px-8 py-6 text-right">Reference</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                                        No records synchronized within this temporal vector
                                    </td>
                                </tr>
                            ) : (
                                <>
                                  {filteredRecords.map((record) => (
                                      <tr key={record.$id} className="hover:bg-slate-50/50 transition-colors group">
                                          <td className="px-8 py-6">
                                              <div className="flex flex-col">
                                                  <span className="text-slate-900 font-bold text-sm tracking-tight">{record.sessionName}</span>
                                                  <span className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{record.courseId}</span>
                                              </div>
                                          </td>
                                          <td className="px-8 py-6">
                                              <div className="flex flex-col">
                                                  <span className="text-slate-600 text-xs">{new Date(record.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                  <span className="text-[10px] text-slate-400 font-bold">{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                              </div>
                                          </td>
                                          <td className="px-8 py-6">
                                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                  record.status === 'present' 
                                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                  : 'bg-rose-50 text-rose-600 border-rose-100'
                                              }`}>
                                                  {record.status}
                                              </span>
                                          </td>
                                          <td className="px-8 py-6 text-right font-mono text-[9px] text-slate-300 font-bold group-hover:text-indigo-300 transition-colors">
                                              {record.$id.slice(0, 12)}
                                          </td>
                                      </tr>
                                  ))}
                                  {records.length < totalRecordsInRegistry && (
                                    <tr>
                                      <td colSpan={4} className="px-8 py-10 text-center">
                                        <button 
                                          onClick={handleLoadMore}
                                          disabled={loadingMore}
                                          className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl uppercase tracking-widest text-[11px] shadow-xl shadow-indigo-100 transition-all disabled:opacity-50 flex items-center gap-3 mx-auto"
                                        >
                                          {loadingMore && <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                                          {loadingMore ? 'Syncing...' : 'Load More Records'}
                                        </button>
                                        <p className="mt-4 text-[9px] font-black uppercase text-slate-300 tracking-[0.2em]">Showing {records.length} of {totalRecordsInRegistry} entries</p>
                                      </td>
                                    </tr>
                                  )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;
