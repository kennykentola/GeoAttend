import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { databases, functions } from '../../config/appwriteConfig';
import { useAuth } from '../../context/AuthContext';
import { DATABASE_ID, SESSIONS_COLLECTION_ID, COURSES_COLLECTION_ID, BULK_IMPORT_FUNCTION_ID } from '../../config/constants';
import { AttendanceSession, Course } from '../../../types';
import { ID, Query } from 'appwrite';

const CourseDetail: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch courses on mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await databases.listDocuments(
          DATABASE_ID,
          COURSES_COLLECTION_ID,
          // In a real app, filter by lecturer ID to show only their courses
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
      } catch (error) {
        console.error("Failed to fetch courses", error);
      }
    };
    fetchCourses();
  }, []);

  // Fetch sessions when course changes
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
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [selectedCourseId]);

  const handleCreateSession = () => {
    setCreatingSession(true);
    if (!navigator.geolocation) {
      alert("Geolocation is needed to set the venue location.");
      setCreatingSession(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const course = courses.find(c => c.$id === selectedCourseId);
        
        const startTime = new Date();
        // Set End Time to 2 hours from now by default
        const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

        const newSession = await databases.createDocument(
          DATABASE_ID,
          SESSIONS_COLLECTION_ID,
          ID.unique(),
          {
            courseId: selectedCourseId,
            courseName: course?.name || 'Unknown Course',
            lectureStartTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            venueLat: position.coords.latitude,
            venueLon: position.coords.longitude,
            isActive: true
          }
        );

        setSessions(prev => [{
            $id: newSession.$id,
            courseId: newSession.courseId,
            courseName: newSession.courseName,
            lectureStartTime: newSession.lectureStartTime,
            endTime: newSession.endTime,
            venueLat: newSession.venueLat,
            venueLon: newSession.venueLon,
            isActive: newSession.isActive
        }, ...prev]);
        
        alert(`Session created! Code: ${newSession.$id}\nAuto-closes at: ${endTime.toLocaleTimeString()}`);
      } catch (error) {
        console.error("Error creating session", error);
        alert("Failed to create session.");
      } finally {
        setCreatingSession(false);
      }
    }, (error) => {
      console.error(error);
      alert("Could not get location for venue.");
      setCreatingSession(false);
    });
  };

  const toggleSessionStatus = async (session: AttendanceSession) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        SESSIONS_COLLECTION_ID,
        session.$id,
        {
          isActive: !session.isActive
        }
      );
      // Optimistic update
      setSessions(prev => prev.map(s => s.$id === session.$id ? { ...s, isActive: !s.isActive } : s));
    } catch (error) {
      console.error("Failed to update status", error);
    }
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
        // Simple CSV Parser
        // Assumption: Headers are name,email,password (case insensitive)
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace('\r', ''));
        const users = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(',');
          const userObj: any = {};
          
          headers.forEach((header, index) => {
            if (values[index]) {
                userObj[header] = values[index].trim().replace('\r', '');
            }
          });

          if (userObj.email && userObj.password && userObj.name) {
            users.push(userObj);
          }
        }

        if (users.length === 0) {
            alert('No valid users found in CSV. Please ensure headers are: name,email,password');
            setIsImporting(false);
            return;
        }

        const payload = JSON.stringify({ users });
        const execution = await functions.createExecution(BULK_IMPORT_FUNCTION_ID, payload, false);
        
        const response = JSON.parse(execution.responseBody);
        
        if (execution.status === 'completed' && response.success) {
            alert(`Import Complete!\nSuccess: ${response.data.success}\nFailed: ${response.data.failed}\n${response.data.errors.length > 0 ? 'Errors:\n' + response.data.errors.slice(0, 3).join('\n') + (response.data.errors.length > 3 ? '...' : '') : ''}`);
        } else {
            alert(`Import Failed: ${response.message || 'Unknown error'}`);
        }

      } catch (error) {
        console.error("CSV Import Error", error);
        alert("Failed to process CSV file.");
      } finally {
        setIsImporting(false);
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       <nav className="w-full bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600">GeoAttend - Lecturer</h1>
        <div className="flex items-center gap-4">
          
          {/* Hidden File Input for CSV Import */}
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".csv" 
            className="hidden" 
            onChange={handleFileUpload}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-100 disabled:opacity-50"
          >
            {isImporting ? 'Importing...' : 'Import Students (CSV)'}
          </button>

          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={() => logout()} className="text-sm text-red-500 hover:text-red-700">Logout</button>
        </div>
      </nav>

      <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">My Courses</h2>
          <div className="w-64">
            <select 
              className="w-full border-gray-300 rounded-md shadow-sm p-2"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {courses.map(c => (
                <option key={c.$id} value={c.$id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-medium">Active Sessions</h3>
             <button
                onClick={handleCreateSession}
                disabled={creatingSession}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
             >
               {creatingSession ? 'Creating...' : '+ New Session (2 Hours)'}
             </button>
          </div>

          {loading ? (
             <p className="text-gray-500">Loading sessions...</p>
          ) : sessions.length === 0 ? (
             <p className="text-gray-400 italic">No sessions found for this course.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Auto-End Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Venue (Lat, Lon)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.$id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{session.$id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(session.lectureStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {session.endTime ? new Date(session.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {session.venueLat.toFixed(4)}, {session.venueLon.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${session.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {session.isActive ? 'Active' : 'Manually Closed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2">
                        <button 
                          onClick={() => navigate(`/lecturer/session/${session.$id}`)}
                          className="flex items-center text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                        <span className="text-gray-300">|</span>
                        <button 
                          onClick={() => toggleSessionStatus(session)}
                          className="text-gray-600 hover:text-red-600"
                        >
                          {session.isActive ? 'Close' : 'Re-open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;