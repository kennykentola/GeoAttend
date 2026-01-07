
export enum UserRole {
  STUDENT = 'student',
  LECTURER = 'lecturer',
  ADMIN = 'admin',
}

export type Capability = 
  | 'COURSE_READ' 
  | 'COURSE_WRITE' 
  | 'SESSION_CONTROL' 
  | 'RECORDS_READ' 
  | 'RECORDS_WRITE' 
  | 'RECORDS_EXPORT'
  | 'USER_MANAGEMENT'
  | 'SYSTEM_TELEMETRY';

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  capabilities: Capability[];
  isSystem?: boolean;
}

export interface UserProfile {
  $id: string;
  name: string;
  email: string;
  roles: string[]; 
  lastLogin?: string; 
}

export interface Course {
  $id: string;
  name: string;
  code: string;
  description: string;
}

export interface AttendanceSession {
  $id: string;
  courseId: string;
  courseName: string;
  lectureStartTime: string;
  endTime: string;
  venueLat: number;
  venueLon: number;
  isActive: boolean;
  broadcastCode?: string; // New numeric code for easy input
}

export interface AttendanceRecord {
  $id: string;
  sessionId: string;
  studentId: string;
  timestamp: string;
  status: 'present' | 'absent';
  reason?: string;
}

export interface LectureNote {
  $id: string;
  courseId: string;
  title: string;
  fileId: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  $createdAt: string;
}
