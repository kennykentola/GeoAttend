
import React, { useState, useEffect, useMemo } from 'react';
import { databases } from '../../config/appwriteConfig';
import { 
  DATABASE_ID, 
  USERS_COLLECTION_ID, 
  COURSES_COLLECTION_ID,
  SESSIONS_COLLECTION_ID,
  RECORDS_COLLECTION_ID
} from '../../config/constants';
import { UserProfile, Course, UserRole, AttendanceSession } from '../../types';
import { Query } from 'appwrite';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

type AdminTab = 'users' | 'courses' | 'telemetry';

const AdminDashboard: React.FC = () => {
  const { user: currentUser, logout } = useAuth();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [stats, setStats] = useState({ users: 0, courses: 0, sessions: 0, records: 0 });
  const [loading, setLoading] = useState(true);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Multi-role management state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    
    // Dev Bypass Check
    if (currentUser?.$id === 'dev-bypass-node') {
        setTimeout(() => {
            const mockUsers = [
                { $id: 'u1', name: 'Dr. Sarah Jenkins', email: 'jenkins@inst.edu', roles: [UserRole.LECTURER], lastLogin: new Date().toISOString() },
                { $id: 'u2', name: 'John Doe', email: 'doe.j@inst.edu', roles: [UserRole.STUDENT], lastLogin: new Date(Date.now() - 3600000).toISOString() },
                { $id: 'u3', name: 'Admin Master', email: 'admin@hia.edu', roles: [UserRole.ADMIN, UserRole.LECTURER], lastLogin: new Date().toISOString() }
            ];
            setUsers(mockUsers);
            setCourses([{ $id: 'c1', name: 'Distributed Systems', code: 'CSC 402', description: 'Advanced node architectures' }]);
            setStats({ users: 1240, courses: 42, sessions: 18, records: 15420 });
            setLoading(false);
        }, 800);
        return;
    }

    try {
      const [usersRes, coursesRes, sessionsRes, recordsRes] = await Promise.all([
        databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID, [Query.limit(100), Query.orderDesc('lastLogin')]),
        databases.listDocuments(DATABASE_ID, COURSES_COLLECTION_ID),
        databases.listDocuments(DATABASE_ID, SESSIONS_COLLECTION_ID, [Query.equal('isActive', true)]),
        databases.listDocuments(DATABASE_ID, RECORDS_COLLECTION_ID, [Query.limit(1)])
      ]);

      const normalizedUsers = usersRes.documents.map(doc => ({
        $id: doc.$id,
        name: doc.name,
        email: doc.email,
        roles: Array.isArray(doc.roles) ? doc.roles : (doc.roles ? [doc.roles] : (doc.role ? [doc.role] : [])),
        lastLogin: doc.lastLogin
      })) as UserProfile[];

      setUsers(normalizedUsers);
      setCourses(coursesRes.documents as any);
      setActiveSessions(sessionsRes.documents as any);
      setStats({
        users: usersRes.total,
        courses: coursesRes.total,
        sessions: sessionsRes.total,
        records: recordsRes.total
      });
    } catch (error: any) {
      addToast(`Telemetry Failure: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.$id]);

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (roleFilter !== 'all') {
      result = result.filter(u => u.roles.includes(roleFilter));
    }

    return result;
  }, [users, searchTerm, roleFilter]);

  const handleToggleRole = async (targetRole: string) => {
    if (!viewingUser) return;
    
    // Dev Bypass Check
    if (currentUser?.$id === 'dev-bypass-node') {
        const nextRoles = viewingUser.roles.includes(targetRole) 
            ? viewingUser.roles.filter(r => r !== targetRole)
            : [...viewingUser.roles, targetRole];
        const updatedUser = { ...viewingUser, roles: nextRoles };
        setViewingUser(updatedUser);
        setUsers(prev => prev.map(u => u.$id === viewingUser.$id ? updatedUser : u));
        addToast("Bypass: Roles updated locally.", "info");
        return;
    }

    setIsUpdatingRoles(true);
    try {
      const nextRoles = viewingUser.roles.includes(targetRole) 
        ? viewingUser.roles.filter(r => r !== targetRole)
        : [...viewingUser.roles, targetRole];

      await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, viewingUser.$id, {
        roles: nextRoles
      });

      const updatedUser = { ...viewingUser, roles: nextRoles };
      setViewingUser(updatedUser);
      setUsers(prev => prev.map(u => u.$id === viewingUser.$id ? updatedUser : u));
      addToast(`Authority updated for ${viewingUser.name}`, 'success');
    } catch (error: any) {
      addToast(`Protocol Violation: ${error.message}`, 'error');
    } finally {
      setIsUpdatingRoles(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm("Permanently revoke user access and delete registry record?")) return;
    try {
      await databases.deleteDocument(DATABASE_ID, USERS_COLLECTION_ID, userId);
      setUsers(prev => prev.filter(u => u.$id !== userId));
      addToast("User entry purged from registry.", "info");
    } catch (error: any) {
      addToast(error.message, "error");
    }
  };

  const formatLastLogin = (iso?: string) => {
    if (!iso) return { label: 'Never', active: false };
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const isActive = diff < 900000; // 15 mins
    return {
        label: date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        active: isActive
    };
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shadow-2xl shadow-indigo-500/20"></div>
        <p className="text-indigo-400 font-black text-xs uppercase tracking-[0.4em] animate-pulse">Initializing Command Console</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="w-full bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
                </svg>
            </div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Institutional <span className="text-indigo-600">Command</span></h1>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">Administrative Oversight</span>
            </div>
        </div>
        <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['users', 'courses', 'telemetry'] as AdminTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === tab ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            <button onClick={logout} className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-600 transition-colors tracking-widest">Terminate Session</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12 space-y-10 animate-fade-in">
        
        {/* Telemetry View */}
        {activeTab === 'telemetry' && (
            <div className="space-y-10 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { label: 'Total Registry', value: stats.users, color: 'text-indigo-600', icon: '👤', desc: 'Enrolled identities' },
                        { label: 'Academic Streams', value: stats.courses, color: 'text-emerald-600', icon: '📚', desc: 'Available courses' },
                        { label: 'Active Sessions', value: stats.sessions, color: 'text-amber-600', icon: '🛰️', desc: 'Live spatial nodes' },
                        { label: 'Registry Logs', value: stats.records, color: 'text-rose-600', icon: '📝', desc: 'Verification events' }
                    ].map((stat, i) => (
                        <div key={i} className="p-10 rounded-[3rem] bg-white border border-slate-100 shadow-2xl shadow-slate-100/50 flex flex-col justify-between group hover:border-indigo-100 transition-all duration-500">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                <span className="text-2xl group-hover:scale-125 transition-transform duration-500 opacity-20 grayscale">{stat.icon}</span>
                            </div>
                            <div className="mt-8">
                                <p className={`text-6xl font-black tracking-tighter ${stat.color}`}>{stat.value.toLocaleString()}</p>
                                <p className="text-[11px] font-medium text-slate-400 mt-2">{stat.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-2xl">
                    <h3 className="text-2xl font-black mb-12">Registry Load Vector (Last 7 Days)</h3>
                    <div className="flex items-end justify-between h-64 gap-4 px-6 border-b border-slate-100">
                        {[45, 65, 32, 85, 70, 95, 55].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                                <div 
                                    className="w-full bg-indigo-500/10 group-hover:bg-indigo-600 rounded-t-2xl transition-all duration-500 relative cursor-pointer"
                                    style={{ height: `${h}%` }}
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        {h * 12} Logs
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Courses View */}
        {activeTab === 'courses' && (
            <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-2xl shadow-slate-100/50">
                <div className="mb-12">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Academic Oversight</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Manage Institutional Curriculum Nodes</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-50">
                                <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Code</th>
                                <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Stream Identity</th>
                                <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Active Nodes</th>
                                <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {courses.map((c) => {
                                const courseSessions = activeSessions.filter(s => s.courseId === c.$id).length;
                                return (
                                    <tr key={c.$id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="py-8 px-4 font-mono font-bold text-indigo-600 text-sm tracking-widest">{c.code}</td>
                                        <td className="py-8 px-4">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 tracking-tight text-lg">{c.name}</span>
                                                <span className="text-[11px] text-slate-400 truncate max-w-md">{c.description || 'No institutional memo provided.'}</span>
                                            </div>
                                        </td>
                                        <td className="py-8 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${courseSessions > 0 ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-200'}`}></div>
                                                <span className={`text-[11px] font-black uppercase tracking-widest ${courseSessions > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {courseSessions} Active
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-8 px-4 text-right">
                                            <button className="text-[10px] font-black uppercase text-indigo-600 hover:underline tracking-widest">Inspect</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Users View */}
        {activeTab === 'users' && (
            <div className="space-y-8">
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-2xl shadow-slate-100/50">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
                        <div className="space-y-1">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Identity Registry</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Credential & Authority Management</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                            <div className="relative group flex-1">
                                <input 
                                    type="text" 
                                    placeholder="Search Identities..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full sm:w-80 bg-slate-50 border border-slate-100 rounded-[1.5rem] px-8 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-inner"
                                />
                                <svg className="w-5 h-5 absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            </div>
                            <select 
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="bg-white border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none appearance-none cursor-pointer hover:border-indigo-100 transition-colors shadow-sm"
                            >
                                <option value="all">All Access</option>
                                <option value={UserRole.STUDENT}>Students</option>
                                <option value={UserRole.LECTURER}>Faculty</option>
                                <option value={UserRole.ADMIN}>Admin</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Entity</th>
                                    <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Authority badges</th>
                                    <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Last Sync</th>
                                    <th className="pb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4 text-right">Registry Controls</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredUsers.map((u) => {
                                    const login = formatLastLogin(u.lastLogin);
                                    return (
                                        <tr key={u.$id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-8 px-4">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xl group-hover:scale-110 transition-transform duration-500">
                                                        {u.name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-slate-900 tracking-tight text-lg leading-none mb-1.5">{u.name}</span>
                                                        <span className="text-[11px] font-medium text-slate-400">{u.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-8 px-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {u.roles.map(role => (
                                                        <span key={role} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                                                            role === UserRole.ADMIN ? 'bg-rose-50 border-rose-100 text-rose-600' :
                                                            role === UserRole.LECTURER ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                                            'bg-emerald-50 border-emerald-100 text-emerald-600'
                                                        }`}>
                                                            {role}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-8 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${login.active ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-slate-200'}`}></div>
                                                    <div className="flex flex-col">
                                                        <span className={`text-[11px] font-bold ${login.active ? 'text-emerald-600' : 'text-slate-600'}`}>{login.label}</span>
                                                        {login.active && <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest mt-0.5">Active Pulse</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-8 px-4 text-right">
                                                <div className="flex justify-end gap-3">
                                                    <button 
                                                        onClick={() => { setViewingUser(u); setIsRoleModalOpen(true); }}
                                                        className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-95"
                                                    >
                                                        Authority
                                                    </button>
                                                    <button 
                                                        onClick={() => deleteUser(u.$id)}
                                                        className="px-6 py-2.5 rounded-xl bg-white border border-slate-100 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"
                                                    >
                                                        Purge
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredUsers.length === 0 && (
                            <div className="py-32 text-center space-y-4">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No entries matching search vector</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Authority Management Modal */}
      {isRoleModalOpen && viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={() => setIsRoleModalOpen(false)}>
            <div className="w-full max-w-xl bg-white rounded-[4rem] p-16 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.4)] border border-slate-100 animate-slide-up relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-50 rounded-full blur-[80px] opacity-40"></div>
                
                <div className="relative z-10 flex justify-between items-start mb-12">
                    <div className="space-y-2">
                        <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Authority<br/>Framework</h3>
                        <p className="text-slate-500 font-medium text-sm">Synchronizing access for <span className="text-indigo-600 font-black">{viewingUser.name}</span></p>
                    </div>
                    <button onClick={() => setIsRoleModalOpen(false)} className="p-3 text-slate-300 hover:text-slate-900 transition-colors">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <div className="space-y-4 mb-12 relative z-10">
                    {[
                        { id: UserRole.STUDENT, label: 'Student Access', desc: 'Permit spatial presence verification.', color: 'emerald' },
                        { id: UserRole.LECTURER, label: 'Faculty Oversight', desc: 'Manage courses and broadcast sessions.', color: 'indigo' },
                        { id: UserRole.ADMIN, label: 'Core Administrator', desc: 'Full registry and telemetry authority.', color: 'rose' }
                    ].map(role => {
                        const hasRole = viewingUser.roles.includes(role.id);
                        return (
                            <button 
                                key={role.id}
                                disabled={isUpdatingRoles}
                                onClick={() => handleToggleRole(role.id)}
                                className={`w-full p-8 rounded-[2.5rem] border transition-all text-left flex items-center justify-between group relative overflow-hidden ${
                                    hasRole 
                                    ? `bg-${role.color}-600 border-${role.color}-600 text-white shadow-2xl shadow-${role.color}-600/30` 
                                    : 'bg-slate-50 border-slate-100 hover:border-indigo-200'
                                }`}
                            >
                                <div className="relative z-10">
                                    <h4 className={`text-xl font-black tracking-tight ${hasRole ? 'text-white' : 'text-slate-900'}`}>{role.label}</h4>
                                    <p className={`text-[11px] font-medium mt-1 leading-relaxed ${hasRole ? 'text-white/80' : 'text-slate-500'}`}>{role.desc}</p>
                                </div>
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all relative z-10 ${
                                    hasRole ? 'border-white bg-white/20' : 'border-slate-200 bg-white'
                                }`}>
                                    {hasRole && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg>}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={() => setIsRoleModalOpen(false)}
                    className="w-full bg-slate-950 text-white font-black py-6 rounded-[2rem] hover:bg-indigo-600 transition-all uppercase tracking-[0.3em] text-[10px] shadow-2xl active:scale-95"
                >
                    Establish Final Configuration
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
