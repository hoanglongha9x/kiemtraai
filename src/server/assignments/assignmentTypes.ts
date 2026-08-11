import type {
  PublishedTestSection,
  TestMetadata,
  TestOwner,
  TestSettings,
} from "@/server/tests/testTypes";

export type AssignmentStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "closed"
  | "locked"
  | "archived";

export type AssignmentAccessState =
  | "available"
  | "scheduled"
  | "closed"
  | "locked"
  | "archived";

export type AssignmentResultVisibility =
  | "immediately"
  | "after_close"
  | "hidden";

export type AssignmentClassSnapshot = {
  id: string;

  name: string;

  code?: string;

  schoolId?: string;

  studentCount?: number;
};

export type AssignmentCreator = {
  uid: string;

  email: string;

  name: string;

  role:
    | "admin"
    | "teacher";

  schoolId: string;
};

export type AssignmentTestSnapshot = {
  snapshotId: string;

  testId: string;

  title: string;

  description: string;

  instructions: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  maxAttempts: number;

  owner: TestOwner;

  metadata: TestMetadata;

  sections: PublishedTestSection[];

  settings: TestSettings;

  versionNumber: number;

  schemaVersion: number;

  publishedAt: string;
};

export type TeacherAssignmentDocument = {
  id: string;

  assignmentCode: string;

  title: string;

  description: string;

  testId: string;

  testTitle: string;

  testSnapshotId: string;

  testVersionNumber: number;

  testSnapshot: AssignmentTestSnapshot;

  creator: AssignmentCreator;

  classIds: string[];

  classNames: string[];

  classSnapshots: AssignmentClassSnapshot[];

  classCount: number;

  subject: string;

  grade: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  maxAttempts: number;

  startTime?: string;

  endTime?: string;

  status: AssignmentStatus;

  accessState: AssignmentAccessState;

  hasPassword: boolean;

  passwordHash?: string;

  resultVisibility: AssignmentResultVisibility;

  showCorrectAnswers: boolean;

  shuffleQuestions: boolean;

  shuffleOptions: boolean;

  createdAt: string;

  updatedAt: string;

  publishedAt?: string;

  closedAt?: string;
};

export type StoredAssignmentDocument = {
  id: string;

  data: Record<string, unknown>;
};

export type CreateAssignmentInput = {
  testId?: unknown;

  title?: unknown;

  description?: unknown;

  classIds?: unknown;

  classNames?: unknown;

  classSnapshots?: unknown;

  durationMinutes?: unknown;

  maxAttempts?: unknown;

  startTime?: unknown;

  endTime?: unknown;

  password?: unknown;

  resultVisibility?: unknown;

  showCorrectAnswers?: unknown;

  shuffleQuestions?: unknown;

  shuffleOptions?: unknown;

  status?: unknown;
};