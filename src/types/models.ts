export type TeacherRole = 'admin' | 'teacher';
export type AccountStatus = 'active' | 'locked';
export type TestStatus = 'draft' | 'published' | 'archived';
export type AssignmentStatus = 'active' | 'closed' | 'archived';
export type AnswerKey = 'A' | 'B' | 'C' | 'D';

export interface Teacher {
  teacherId: string;
  schoolId: string;
  email: string;
  name: string;
  role: TeacherRole;
  subjects: string[];
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface ClassRoom {
  classId: string;
  schoolId: string;
  teacherId: string;
  teacherEmail: string;
  className: string;
  grade: string;
  schoolYear: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface Student {
  studentId: string;
  schoolId: string;
  classId: string;
  className: string;
  studentCode: string;
  fullName: string;
  gender?: string;
  status: 'active' | 'locked' | 'transferred';
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionOption {
  text: string;
  imagePath?: string;
}

export interface Question {
  questionId: string;
  order: number;
  questionText: string;
  questionImagePath?: string;
  options: Record<AnswerKey, QuestionOption>;
  correctAnswer: AnswerKey;
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Test {
  testId: string;
  schoolId: string;
  teacherId: string;
  teacherEmail: string;
  title: string;
  subject: string;
  durationMinutes: number;
  totalScore: number;
  passwordHash?: string;
  maxAttempts: number;
  status: TestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  assignmentId: string;
  schoolId: string;
  testId: string;
  teacherId: string;
  classId: string;
  className: string;
  titleSnapshot: string;
  subjectSnapshot: string;
  durationMinutesSnapshot: number;
  totalScoreSnapshot: number;
  startAt?: Date;
  endAt?: Date;
  maxAttempts: number;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionAnswer {
  questionId: string;
  selected: AnswerKey | '';
  correct: AnswerKey;
  isCorrect: boolean;
}

export interface Submission {
  submissionId: string;
  schoolId: string;
  assignmentId: string;
  testId: string;
  classId: string;
  teacherId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  answers: SubmissionAnswer[];
  score: number;
  totalScore: number;
  submittedAt: Date;
  startedAt?: Date;
  durationSeconds?: number;
  attemptNo: number;
  status: 'submitted' | 'voided';
}
