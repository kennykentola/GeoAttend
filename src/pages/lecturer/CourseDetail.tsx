import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { databases, functions, storage } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { 
  DATABASE_ID, 
  SESSIONS_COLLECTION_ID, 
  COURSES_COLLECTION_ID, 
  BULK_IMPORT_FUNCTION_ID,
  NOTES_COLLECTION_ID,
  USERS_COLLECTION_ID,
  STORAGE_BUCKET_ID 
} from '../../config/constants';
import { AttendanceSession, Course, LectureNote, UserProfile } from '../../../types';
import { ID, Query } from 'appwrite';
import { useToast } from '../../context/ToastContext';
import CreateCourseModal from '../../components/lecturer/CreateCourseModal';

const CourseDetail: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [notes, setNotes] = useState<LectureNote[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]); 
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false); 
  const [creatingSession, setCreatingSession] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadingNote, setUploadingNote] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
        const response = await databases.listDocuments(
            DATABASE_ID,
            USERS_COLLECTION_ID,
            [Query.equal('role', 'student'), Query.limit(100)]
        );
        // Fixed mapping to roles array to match UserProfile type
        const mappedStudents = response.documents.map(doc => ({
            $id: doc.$id,
            name: doc.name,
            email: doc.email,
            roles: [doc.role]
        })) as unknown as UserProfile[];
        setStudents(mappedStudents);
    } catch (error: any) {
        console.error("Failed to fetch students", error);
    } finally {
        setLoadingStudents(false);
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          COURSES_COLLECTION_ID,
          []
        );
        const mappedCourses = response.documents.map(doc => ({
          $id: doc.$id,
          name: doc.name,
          code: doc.code,
          description: doc.description
        })) as Course[];
        setCourses(mappedCourses);
        if (mappedCourses.length > 0) {
          setSelectedCourseId(mappedCourses[0].$id);
        }
      } catch (error: any) {
        console.error("Failed to fetch courses", error);
        addToast(`Error loading courses: ${error.message || 'Connection failed'}`, 'error');
      }
    };
    fetchCourses();
    fetchStudents();
  }, [addToast]);

  useEffect(() => {
    if (!selectedCourseId) return;

    const fetchSessions = async () => {
      setLoading(true);
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          SESSIONS_COLLECTION_ID,
          [Query.equal('courseId', selectedCourseId), Query.orderDesc('$createdAt')]
        );
        const mappedSessions = response.documents.map(doc => ({
          $id: doc.$id,
          courseId: doc.courseId,
          courseName: doc.courseName,
          lectureStartTime: doc.lectureStartTime,
          endTime: doc.endTime,
          venueLat: doc.venueLat,
          venueLon: doc.venueLon,
          isActive: doc.isActive
        }));
        setSessions(mappedSessions);
      } catch (error: any) {
        console.error("Failed to fetch sessions", error);
        addToast(`Error loading sessions: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    const fetchNotes = async () => {
      setLoadingNotes(true);
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          NOTES_COLLECTION_ID,
          [Query.equal('courseId', selectedCourseId), Query.orderDesc('$createdAt')]
        );
        const mappedNotes = response.documents.map(doc => ({
          $id: doc.$id,
          courseId: doc.courseId,
          title: doc.title,
          fileId: doc.fileId,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          size: doc.size,
          $createdAt: doc.$createdAt
        })) as LectureNote[];
        setNotes(mappedNotes);
      } catch (error) {
        console.warn("Notes fetching issue", error);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchSessions();
    fetchNotes();
  }, [selectedCourseId, addToast]);

  const handleNoteUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCourseId) return;

    if (file.size > 15 * 1024 * 1024) { 
        addToast("File is too large. Max size is 15MB.", 'error');
        return;
    }

    setUploadingNote(true);
    try {
        // 1. Upload file to Appwrite Storage
        const uploadedFile = await storage.createFile(
            STORAGE_BUCKET_ID,
            ID.unique(),
            file
        );

        // 2. Save metadata to Databases
        const noteDoc = await databases.createDocument(
            DATABASE_ID,
            NOTES_COLLECTION_ID,
            ID.unique(),
            {
                courseId: selectedCourseId,
                title: file.name,
                fileId: uploadedFile.$id,
                fileName: file.name,
                mimeType: file.type,
                size: file.size
            }
        );

        const newNote: LectureNote = {
            $id: noteDoc.$id,
            courseId: noteDoc.courseId,
            title: noteDoc.title,
            fileId: noteDoc.fileId,
            fileName: noteDoc.fileName,
            mimeType: noteDoc.mimeType,
            size: noteDoc.size,
            $createdAt: noteDoc.$createdAt
        };

        setNotes(prev => [newNote, ...prev]);
        addToast(`"${file.name}" uploaded successfully.`, 'success');

    } catch (error: any) {
        console.error("Note upload failed", error);
        addToast(`Upload failed: ${error.message}`, 'error');
    } finally {
        setUploadingNote(false);
        if (noteInputRef.current) {
            noteInputRef.current.value = '';
        }
    }
  };

  const handleDeleteNote = async (note: LectureNote) => {
      if (!window.confirm(`Delete "${note.title}"? This will permanently remove the file.`)) return;

      try {
          // Remove from Storage first
          await storage.deleteFile(STORAGE_BUCKET_ID, note.fileId);
          // Then remove from Database
          await databases.deleteDocument(DATABASE_ID, NOTES_COLLECTION_ID, note.$id);

          setNotes(prev => prev.filter(n => n.$id !== note.$id));
          addToast("Resource removed.", 'info');
      } catch (error: any) {
          console.error("Delete failed", error);
          addToast(`Failed to delete: ${error.message}`, 'error');
      }
  };

  const getFileIcon = (mimeType?: string) => {
      if (!mimeType) return '📄';
      const m = mimeType.toLowerCase();
      if (m.includes('pdf')) return '📕';
      if (m.includes('word') || m.includes('officedocument.word')) return '📘';
      if (m.includes('presentation') || m.includes('powerpoint')) return '📙';
      if (m.includes('spreadsheet') || m.includes('excel')) return '📗';
      if (m.includes('image')) return '🖼️';
      if (m.includes('zip') || m.includes('rar')) return '📦';
      return '📄';
  };

  const getDownloadUrl = (fileId: string) => {
      // Fix: Removing .href because getFileDownload returns a string in this context
      return storage.getFileDownload(STORAGE_BUCKET_ID, fileId);
  };

  // Rest of existing logic for course and session management
  const handleCourseCreated = (newCourse: Course) => {
    setCourses(prev => [...prev, newCourse]);
    setSelectedCourseId(newCourse.$id);
    setShowCourseModal(false);
  };

  const handleDeleteCourse = async (e: React.MouseEvent, course: Course) => {
      e.stopPropagation();
      if (!window.confirm(`Delete course "${course.name}"?`)) return;
      try {
          await databases.deleteDocument(DATABASE_ID, COURSES_COLLECTION_ID, course.$id);
          setCourses(prev => prev.filter(c => c.$id !== course.$id));
          if (selectedCourseId === course.$id) setSelectedCourseId('');
          addToast("Course deleted.", "success");
      } catch (error: any) { addToast(error.message, "error"); }
  };

  const handleCreateSession = () => {
    setCreatingSession(true);
    if (!navigator.geolocation) {
      addToast("Geolocation is required.", "error");
      setCreatingSession(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const course = courses.find(c => c.$id === selectedCourseId);
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
        const newSession = await databases.createDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, ID.unique(), {
            courseId: selectedCourseId,
            courseName: course?.name || 'Unknown',
            lectureStartTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            venueLat: position.coords.latitude,
            venueLon: position.coords.longitude,
            isActive: true
        });
        setSessions(prev => [newSession as any, ...prev]);
        addToast(`New session started!`, 'success');
      } catch (error) { addToast("Failed to create session.", 'error'); }
      finally { setCreatingSession(false); }
    }, () => {
      addToast("Location access denied.", 'error');
      setCreatingSession(false);
    });
  };

  const toggleSessionStatus = async (session: AttendanceSession) => {
    try {
      await databases.updateDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, session.$id, { isActive: !session.isActive });
      setSessions(prev => prev.map(s => s.$id === session.$id ? { ...s, isActive: !s.isActive } : s));
      addToast(`Session ${!session.isActive ? 'opened' : 'closed'}`, 'info');
    } catch (error) { console.error(error); }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      setIsImporting(true);
      try {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const users = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = line.split(',');
          const userObj: any = {};
          headers.forEach((h, idx) => { if (values[idx]) userObj[h] = values[idx].trim(); });
          if (userObj.email && userObj.password) users.push(userObj);
        }
        const execution = await functions.createExecution(BULK_IMPORT_FUNCTION_ID, JSON.stringify({ users }), false);
        const res = JSON.parse(execution.responseBody);
        if (res.success) { addToast(`Imported ${res.data.success} students`, 'success'); fetchStudents(); }
        else addToast(res.message, 'error');
      } catch (err) { addToast("Import failed", 'error'); }
      finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen relative flex flex-col font-sans text-gray-100 overflow-x-hidden bg-gray-900">
       <div className="fixed inset-0 z-0 pointer-events-none">
          <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover opacity-20" alt="bg"/>
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900/90 to-indigo-900/80"></div>
       </div>

       <nav className="w-full bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 flex justify-between items-center z-20 sticky top-0 shadow-lg">
        <div className="flex items-center gap-2">
            <span className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-400"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.216 50.59 50.59 0 00-2.658.812m-15.482 0a50.57 50.57 0 012.658.812m12.824 0a50.57 50.57 0 002.658-.812" /></svg>
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Lecturer Portal</h1>
        </div>
        <div className="flex items-center gap-4">
          <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload}/>
          <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="text-sm bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 px-4 py-2 rounded-lg transition-all backdrop-blur-sm hidden md:block">{isImporting ? 'Importing...' : 'Import Students (CSV)'}</button>
          <button onClick={() => logout()} className="text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-2 rounded-lg transition-all backdrop-blur-sm">Logout</button>
        </div>
      </nav>

      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full z-10">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white drop-shadow-sm">My Courses</h2>
          <button onClick={() => setShowCourseModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg shadow-lg font-medium flex items-center gap-2 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> New Course
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {courses.map(c => (
                <div key={c.$id} onClick={() => setSelectedCourseId(c.$id)} className={`relative p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-40 group ${selectedCourseId === c.$id ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg backdrop-blur-md' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 backdrop-blur-md'}`}>
                     <div>
                        <div className="flex justify-between items-start">
                            <h3 className={`font-bold text-xl truncate pr-8 ${selectedCourseId === c.$id ? 'text-indigo-200' : 'text-white'}`}>{c.name}</h3>
                            <button onClick={(e) => handleDeleteCourse(e, c)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-all absolute top-4 right-4"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
                        </div>
                        <p className={`text-sm font-mono mt-1 ${selectedCourseId === c.$id ? 'text-indigo-300' : 'text-gray-400'}`}>{c.code}</p>
                     </div>
                     <div className="flex justify-between items-end">
                        <span className="text-xs text-gray-500 line-clamp-1 max-w-[70%]">{c.description || 'No description'}</span>
                        <div className="flex flex-col items-end">
                             <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Students</span>
                             <span className={`text-2xl font-black ${selectedCourseId === c.$id ? 'text-indigo-400' : 'text-gray-200'}`}>{students.length}</span>
                        </div>
                     </div>
                </div>
            ))}
        </div>

        {selectedCourseId && (
        <div className="space-y-8 animate-fade-in">
          {/* Sessions Card */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-bold text-white flex items-center gap-2"><span className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-300"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span> Active Sessions</h3>
               <button onClick={handleCreateSession} disabled={creatingSession} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 font-medium text-sm border border-green-500/30 shadow-lg">{creatingSession ? 'Creating...' : '+ Start New Session'}</button>
            </div>
            {sessions.length === 0 ? (
               <div className="text-center py-10 bg-black/20 rounded-xl border border-dashed border-white/10"><p className="text-gray-400 font-medium">No sessions found.</p></div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-left">
                  <thead className="bg-black/30"><tr><th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider">Session ID</th><th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider">Time</th><th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider">Status</th><th className="px-6 py-4 text-xs text-gray-400 uppercase tracking-wider">Action</th></tr></thead>
                  <tbody className="divide-y divide-white/10 bg-black/10">
                    {sessions.map((s) => (
                      <tr key={s.$id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-indigo-300 font-mono">{s.$id}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{new Date(s.lectureStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${s.isActive ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>{s.isActive ? 'Active' : 'Closed'}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400 flex gap-4">
                          <button onClick={() => navigate(`/lecturer/session/${s.$id}`)} className="text-indigo-400 hover:text-indigo-300 font-medium">View</button>
                          <button onClick={() => toggleSessionStatus(s)} className={`${s.isActive ? 'text-orange-400 hover:text-orange-300' : 'text-green-400 hover:text-green-300'} font-medium`}>{s.isActive ? 'Close' : 'Re-open'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lecture Notes Section */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-bold text-white flex items-center gap-2"><span className="bg-purple-500/20 p-1.5 rounded-lg border border-purple-500/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-300"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg></span> Notes & Resources</h3>
               <div className="flex gap-2">
                   <input type="file" ref={noteInputRef} className="hidden" onChange={handleNoteUpload}/>
                   <button onClick={() => noteInputRef.current?.click()} disabled={uploadingNote} className={`bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/30 px-4 py-2 rounded-lg transition shadow-lg font-medium text-sm flex items-center gap-2 ${uploadingNote ? 'animate-pulse' : ''}`}>
                     {uploadingNote ? 'Uploading...' : 'Upload Note'}
                   </button>
               </div>
            </div>
            {loadingNotes ? (
               <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div></div>
            ) : notes.length === 0 ? (
               <div className="text-center py-8 bg-black/20 rounded-xl border border-dashed border-white/10"><p className="text-gray-400 font-medium">No notes uploaded yet.</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {notes.map(n => (
                        <div key={n.$id} className="border border-white/10 bg-white/5 rounded-xl p-4 hover:bg-white/10 transition flex flex-col justify-between group">
                            <div className="flex items-start gap-3 mb-3">
                                <span className="text-2xl opacity-80" role="img" aria-label="file icon">{getFileIcon(n.mimeType)}</span>
                                <div className="overflow-hidden">
                                    <h4 className="font-medium text-white truncate" title={n.title}>{n.title}</h4>
                                    <p className="text-[10px] text-gray-500">{new Date(n.$createdAt).toLocaleDateString()} • {(n.size ? (n.size / 1024 / 1024).toFixed(2) + ' MB' : '0 MB')}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-1">
                                <a href={getDownloadUrl(n.fileId)} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 transition-colors">Download</a>
                                <button onClick={() => handleDeleteNote(n)} className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300 transition-colors">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
        )}
      </div>

      <CreateCourseModal isOpen={showCourseModal} onClose={() => setShowCourseModal(false)} onCourseCreated={handleCourseCreated}/>
    </div>
  );
};

export default CourseDetail;