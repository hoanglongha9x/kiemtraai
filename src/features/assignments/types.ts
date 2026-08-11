import type {
  TestData,
  TestSettings,
  TestVisibility,
} from "@/features/tests/types";

export type AssignmentStatus =
  | "scheduled"
  | "active"
  | "closed"
  | "locked"
  | "archived";

export type AssignmentResultVisibility =
  | "immediately"
  | "after_close"
  | "manual"
  | "never";

export type AssignmentTeacher = {
  uid: string;

  email: string;

  name?: string;

  schoolId?: string;
};

export type AssignmentClassSnapshot = {
  id: string;

  className: string;

  grade: string;

  schoolYear: string;
};

export type AssignmentTestSnapshot = {
  id: string;

  title: string;

  description?: string;

  instructions?: string;

  subject: string;

  grade: string;

  metadata:
    TestData["metadata"];

  visibility:
    TestVisibility;

  versionNumber: number;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  settings:
    TestSettings;

  /**
   * Toàn bộ nội dung đề tại thời điểm giao bài.
   *
   * Student chỉ được đọc câu hỏi từ:
   * assignment.testSnapshot.sections
   */
  sections:
    TestData["sections"];

  publishedAt?: string;
};

export type AssignmentAccessSettings = {
  hasPassword: boolean;

  maxAttempts: number;

  startTime?: string;

  endTime?: string;
};

export type AssignmentExamSettings = {
  shuffleQuestions: boolean;

  shuffleOptions: boolean;

  allowBackNavigation: boolean;

  showQuestionNumbers: boolean;

  showProgress: boolean;

  autosaveAnswers: boolean;

  resultVisibility:
    AssignmentResultVisibility;

  showCorrectAnswers: boolean;
};

export type AssignmentData = {
  id: string;

  assignmentCode: string;

  testId: string;

  testVersionNumber: number;

  testSnapshot:
    AssignmentTestSnapshot;

  classIds: string[];

  classSnapshots:
    AssignmentClassSnapshot[];

  classCount: number;

  access:
    AssignmentAccessSettings;

  settings:
    AssignmentExamSettings;

  teacher:
    AssignmentTeacher;

  status:
    AssignmentStatus;

  createdAt: string;

  updatedAt: string;

  lockedAt?: string;

  archivedAt?: string;

  createdBy: string;

  updatedBy: string;
};

export type AssignmentListItem = {
  id: string;

  assignmentCode: string;

  testId: string;

  testTitle: string;

  subject: string;

  grade: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  classIds: string[];

  classNames: string[];

  classCount: number;

  maxAttempts: number;

  hasPassword: boolean;

  startTime?: string;

  endTime?: string;

  status:
    AssignmentStatus;

  createdAt: string;

  updatedAt: string;

  link: string;
};

export type CreateAssignmentInput = {
  testId: string;

  classIds: string[];

  password?: string;

  maxAttempts?: number;

  startTime?: string;

  endTime?: string;

  shuffleQuestions?: boolean;

  shuffleOptions?: boolean;

  allowBackNavigation?: boolean;

  showQuestionNumbers?: boolean;

  showProgress?: boolean;

  autosaveAnswers?: boolean;

  resultVisibility?:
    AssignmentResultVisibility;

  showCorrectAnswers?: boolean;
};

export type CreateAssignmentValidationIssue = {
  field:
    | "testId"
    | "classIds"
    | "password"
    | "maxAttempts"
    | "startTime"
    | "endTime"
    | "resultVisibility";

  message: string;
};

export type CreateAssignmentValidationResult = {
  valid: boolean;

  issues:
    CreateAssignmentValidationIssue[];
};

export type AssignmentAction =
  | "lock"
  | "unlock"
  | "archive"
  | "restore";

export type AssignmentMessageVariant =
  | "success"
  | "error"
  | "loading"
  | "info";

export type AssignmentFeedback = {
  variant:
    AssignmentMessageVariant;

  message: string;
};

export type UseAssignmentsResult = {
  assignments:
    AssignmentListItem[];

  loading: boolean;

  mutating: boolean;

  initialized: boolean;

  error:
    string | null;

  feedback:
    AssignmentFeedback | null;

  loadAssignments:
    () => Promise<void>;

  refresh:
    () => Promise<void>;

  createAssignment:
    (
      input:
        CreateAssignmentInput
    ) => Promise<
      AssignmentListItem | null
    >;

  lockAssignment:
    (
      assignmentId:
        string
    ) => Promise<
      AssignmentListItem | null
    >;

  unlockAssignment:
    (
      assignmentId:
        string
    ) => Promise<
      AssignmentListItem | null
    >;

  archiveAssignment:
    (
      assignmentId:
        string
    ) => Promise<
      AssignmentListItem | null
    >;

  restoreAssignment:
    (
      assignmentId:
        string
    ) => Promise<
      AssignmentListItem | null
    >;

  clearFeedback:
    () => void;

  clearError:
    () => void;
};

export type AssignmentTestOption = {
  id: string;

  title: string;

  subject: string;

  grade: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  versionNumber: number;

  publishedAt?: string;
};

export type AssignmentClassOption = {
  id: string;

  className: string;

  grade: string;

  schoolYear: string;

  studentCount: number;
};

export type AssignmentOptions = {
  tests:
    AssignmentTestOption[];

  classes:
    AssignmentClassOption[];
};