
import React, { useEffect, useState, useMemo } from 'react';
import { databases } from '../../config/appwriteConfig';
import { DATABASE_ID, USERS_COLLECTION_ID, COURSES_COLLECTION_ID } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, Course, UserRole } from '../../../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

interface SortConfig {
  key: keyof UserProfile | '';
  direction: 'asc' | 'desc';
}

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tabs
  const activeTab = searchParams.get('tab') || 'overview';

  // Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter/Sort/Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

  // Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersResponse, coursesResponse] = await Promise.all([
        databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID),
        databases.listDocuments(DATABASE_ID, COURSES_COLLECTION_ID)
      ]);

      const mappedUsers = usersResponse.documents.map(doc => ({
        $id: doc.$id,
        name: doc.name,
        email: doc.email,
        role: doc.role
      })) as UserProfile[];

      const mappedCourses = coursesResponse.documents.map(doc => ({
          $id: doc.$id,
          name: doc.name,
          code: doc.code,
          description: doc.description
      })) as Course[];

      setUsers(mappedUsers);
      setCourses(mappedCourses);
    } catch (error) {
      console.error("Admin fetch error", error);
      addToast("Failed to fetch system data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered and Sorted Users
  const processedUsers = useMemo(() => {
    let result = [...users];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.email.toLowerCase().includes(query)
      );
    }

    // Filter
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = String(a[sortConfig.key] || '').toLowerCase();
        const valB = String(b[sortConfig.key] || '').toLowerCase();
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, searchQuery, roleFilter, sortConfig]);

  const handleSort = (key: keyof UserProfile) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    // Confirmation Dialog before deletion
    const confirmed = window.confirm(`Are you sure you want to delete ${userName}? This action is permanent and will remove their system access.`);
    
    if (!confirmed) {
      return;
    }

    try {
      await databases.deleteDocument(DATABASE_ID, USERS_COLLECTION_ID, userId);
      setUsers(prev => prev.filter(u => u.$id !== userId));
      addToast(`User ${userName} deleted successfully.`, "success");
    } catch (error: any) {
      addToast(`Deletion failed: ${error.message}`, "error");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await databases.updateDocument(
        DATABASE_ID,
        USERS_COLLECTION_ID,
        editingUser.$id,
        {
          name: editingUser.name,
          role: editingUser.role
        }
      );
      
      setUsers(prev => prev.map(u => u.$id === editingUser.$id ? editingUser : u));
      setIsEditModalOpen(false);
      addToast("User updated successfully", "success");
    } catch (error: any) {
      addToast(`Update failed: ${error.message}`, "error");
    }
  };

  const stats = [
    { label: 'Total Users', value: users.length, color: 'bg-blue-500', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
    { label: 'Students', value: users.filter(u => u.role === UserRole.STUDENT).length, color: 'bg-teal-500', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
    { label: 'Lecturers', value: users.filter(u => u.role === UserRole.LECTURER).length, color: 'bg-purple-500', icon: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.216 50.59 50.59 0 00-2.658.812m-15.482 0a50.57 50.57 0 012.658.812m12.824 0a50.57 50.57 0 002.658-.812' },
    { label: 'Courses', value: courses.length, color: 'bg-indigo-500', icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605' },
  ];

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center gap-4">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
               <p className="text-gray-400 font-medium">Loading Dashboard...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-100 flex flex-col bg-gray-900">
        {/* Admin Navbar - Glass */}
        <nav className="w-full bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
            <div className="flex items-center gap-3">
                 <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/30 backdrop-blur-sm">
                     <span className="text-red-300 font-bold tracking-wider text-xs">ADMIN</span>
                 </div>
                 <h1 className="text-xl font-bold text-white drop-shadow-sm">Institution Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
                <button 
                    onClick={() => logout()}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm transition-all border border-red-500/20 backdrop-blur-sm shadow-sm"
                >
                    Logout
                </button>
            </div>
        </nav>

        <div className="flex flex-1 overflow-hidden relative">
            {/* Sidebar - Glass */}
            <aside className="w-64 bg-black/20 backdrop-blur-lg hidden md:flex flex-col border-r border-white/10 z-10">
                <div className="p-4 space-y-2 mt-4">
                    <button 
                        onClick={() => handleTabChange('overview')}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center gap-3 ${activeTab === 'overview' ? 'bg-indigo-600/80 border-indigo-500/50 text-white shadow-lg' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        Overview
                    </button>
                    <button 
                         onClick={() => handleTabChange('users')}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center gap-3 ${activeTab === 'users' ? 'bg-indigo-600/80 border-indigo-500/50 text-white shadow-lg' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 01-12 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        Users
                    </button>
                    <button 
                        onClick={() => handleTabChange('courses')}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center gap-3 ${activeTab === 'courses' ? 'bg-indigo-600/80 border-indigo-500/50 text-white shadow-lg' : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        Courses
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8">
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-white mb-6 drop-shadow-sm">System Health</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {stats.map((stat, idx) => (
                                <div key={idx} className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all shadow-xl group cursor-default">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${stat.color} bg-opacity-20 group-hover:bg-opacity-30 transition-all`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                                            </svg>
                                        </div>
                                    </div>
                                    <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                                    <p className="text-sm text-gray-400">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="animate-fade-in space-y-6">
                         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <h2 className="text-2xl font-bold text-white drop-shadow-sm">User Registry</h2>
                            
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        placeholder="Search by name or email..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="bg-white/5 border border-white/10 rounded-xl px-10 py-2.5 text-sm text-white w-full sm:w-64 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                    <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <select 
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                >
                                    <option value="all" className="bg-gray-800">All Roles</option>
                                    <option value={UserRole.STUDENT} className="bg-gray-800">Students</option>
                                    <option value={UserRole.LECTURER} className="bg-gray-800">Lecturers</option>
                                    <option value={UserRole.ADMIN} className="bg-gray-800">Admins</option>
                                </select>
                            </div>
                         </div>

                         <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="bg-black/40 text-gray-400 uppercase font-bold tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                                                <div className="flex items-center gap-1">
                                                    Name
                                                    {sortConfig.key === 'name' && (
                                                        <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('email')}>
                                                <div className="flex items-center gap-1">
                                                    Email
                                                    {sortConfig.key === 'email' && (
                                                        <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('role')}>
                                                <div className="flex items-center gap-1">
                                                    Role
                                                    {sortConfig.key === 'role' && (
                                                        <svg className={`w-4 h-4 transition-transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {processedUsers.map((u) => (
                                            <tr key={u.$id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4 font-semibold text-white">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-300 font-bold border border-indigo-500/30">
                                                            {u.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        {u.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400">{u.email}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                        u.role === 'admin' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                                        u.role === 'lecturer' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                                        'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                                    }`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setEditingUser({...u}); setIsEditModalOpen(true); }}
                                                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-indigo-500/20 hover:text-indigo-400 transition-all"
                                                            title="Edit User"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(u.$id, u.name)}
                                                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/20 hover:text-red-400 transition-all"
                                                            title="Delete User"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {processedUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                                                    No users found matching your criteria.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                         </div>
                    </div>
                )}

                {activeTab === 'courses' && (
                     <div className="animate-fade-in space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white drop-shadow-sm">Course Catalog</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {courses.map(course => (
                                <div key={course.$id} className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between shadow-lg group">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{course.name}</h3>
                                            <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg text-xs font-black border border-indigo-500/30 backdrop-blur-sm shadow-sm">{course.code}</span>
                                        </div>
                                        <p className="text-gray-400 text-sm mt-3 line-clamp-3 leading-relaxed">{course.description || 'No specialized description provided for this academic resource.'}</p>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-600 font-mono">
                                        <span>RESOURCE_ID: {course.$id}</span>
                                    </div>
                                </div>
                            ))}
                            {courses.length === 0 && (
                                <div className="col-span-full p-20 text-center bg-white/5 backdrop-blur-md rounded-2xl border border-dashed border-white/10">
                                    <p className="text-gray-500 font-medium">No courses have been established in the system.</p>
                                </div>
                            )}
                        </div>
                   </div>
                )}
            </main>
        </div>

        {/* Edit User Modal */}
        {isEditModalOpen && editingUser && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <h3 className="text-2xl font-bold text-white mb-2">Edit Account</h3>
                    <p className="text-gray-400 text-sm mb-8 font-mono">{editingUser.email}</p>
                    
                    <form onSubmit={handleUpdateUser} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Display Name</label>
                            <input 
                                type="text" 
                                value={editingUser.name}
                                onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">System Role</label>
                            <select 
                                value={editingUser.role}
                                onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            >
                                <option value={UserRole.STUDENT} className="bg-gray-900">Student</option>
                                <option value={UserRole.LECTURER} className="bg-gray-900">Lecturer</option>
                                <option value={UserRole.ADMIN} className="bg-gray-900">Administrator</option>
                            </select>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button 
                                type="button" 
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 py-3 border border-white/10 rounded-xl text-gray-300 font-bold hover:bg-white/5 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
