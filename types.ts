export enum UserRole {
  STUDENT = 'student',
  LECTURER = 'lecturer',
}

export interface UserProfile {
  $id: string;
  name: string;
  email: string;
  role: UserRole;
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
  courseName: string; // Denormalized for display convenience
  lectureStartTime: string; // ISO date string
  endTime: string; // ISO date string - Automatic expiration time
  venueLat: number;
  venueLon: number;
  isActive: boolean;
}

export interface AttendanceRecord {
  $id: string;
  sessionId: string;
  studentId: string;
  timestamp: string;
  status: 'present' | 'absent';
}