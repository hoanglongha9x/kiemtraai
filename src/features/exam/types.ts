import type {
  QuestionContentBlock,
} from "@/types/question-content";

export type ExamAnswerKey =
  | "A"
  | "B"
  | "C"
  | "D";

export type ExamQuestionType =
  | "single_choice"
  | "true_false_group"
  | "short_answer";

export type ExamAssignmentStatus =
  | "scheduled"
  | "active"
  | "closed"
  | "locked"
  | "archived";

export type ExamAccessState =
  | "available"
  | "scheduled"
  | "closed"
  | "locked"
  | "archived";

export type ExamAttemptStatus =
  | "in_progress"
  | "submitted"
  | "expired";

export type ExamResultVisibility =
  | "immediately"
  | "after_close";

export type ExamSuspiciousEventType =
  | "visibility_hidden"
  | "window_blur";

export type ExamSuspiciousEvent = {
  type: ExamSuspiciousEventType;
  at: string;
};

export type ExamSingleChoiceOption = {
  id: ExamAnswerKey;
  content: string;
  imageUrl?: string;
};

export type ExamTrueFalseStatement = {
  id: ExamAnswerKey;
  content: string;
  imageUrl?: string;
};

export type ExamBaseQuestion = {
  id: string;

  type: ExamQuestionType;

  questionNumber: number;

  sectionId: string;

  sectionTitle: string;

  content: string;

  contentBlocks?:
    QuestionContentBlock[];

  imageUrl?: string;

  score: number;
};

export type ExamSingleChoiceQuestion =
  ExamBaseQuestion & {
    type: "single_choice";

    options:
      ExamSingleChoiceOption[];
  };

export type ExamTrueFalseQuestion =
  ExamBaseQuestion & {
    type: "true_false_group";

    statements:
      ExamTrueFalseStatement[];
  };

export type ExamShortAnswerQuestion =
  ExamBaseQuestion & {
    type: "short_answer";
  };

export type ExamQuestion =
  | ExamSingleChoiceQuestion
  | ExamTrueFalseQuestion
  | ExamShortAnswerQuestion;

export type ExamSingleChoiceAnswer =
  ExamAnswerKey;

export type ExamTrueFalseAnswer =
  Partial<
    Record<
      ExamAnswerKey,
      boolean
    >
  >;

export type ExamShortAnswer =
  string;

export type ExamStudentAnswer =
  | ExamSingleChoiceAnswer
  | ExamTrueFalseAnswer
  | ExamShortAnswer;

export type ExamAnswers =
  Record<
    string,
    ExamStudentAnswer
  >;

export type ExamOptionOrders =
  Record<
    string,
    ExamAnswerKey[]
  >;

export type ExamClassSnapshot = {
  id: string;

  className: string;

  grade: string;

  schoolYear: string;

  studentCount: number;
};

export type ExamAssignmentInfo = {
  id: string;

  assignmentCode: string;

  status:
    ExamAssignmentStatus;

  accessState:
    ExamAccessState;

  accessMessage: string;

  testId: string;

  testTitle: string;

  subject: string;

  grade: string;

  description: string;

  instructions: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  versionNumber: number;

  classIds: string[];

  classNames: string[];

  classSnapshots:
    ExamClassSnapshot[];

  maxAttempts: number;

  hasPassword: boolean;

  startTime?: string;

  endTime?: string;

  shuffleQuestions: boolean;

  shuffleOptions: boolean;

  resultVisibility:
    ExamResultVisibility;

  showCorrectAnswers: boolean;
};

export type ExamStudentInfo = {
  id: string;

  studentCode: string;

  studentName: string;

  gender?: string;

  classId: string;

  className: string;

  status:
    | "active"
    | "locked";
};

export type ExamAntiCheatState = {
  visibilityLostCount: number;

  focusLostCount: number;

  suspiciousEvents:
    ExamSuspiciousEvent[];
};

export type ExamAttempt = {
  id: string;

  status:
    ExamAttemptStatus;

  attemptNumber: number;

  startedAt: string;

  expiresAt: string;

  remainingSeconds: number;

  answers:
    ExamAnswers;

  bookmarkedQuestionIds:
    string[];

  currentQuestionIndex: number;

  questionOrder:
    string[];

  optionOrders:
    ExamOptionOrders;

  antiCheat:
    ExamAntiCheatState;
};

export type AssignmentInfoResponse = {
  status: "success";

  assignment:
    ExamAssignmentInfo;
};

export type StartExamResponse = {
  status: "success";

  resumed: boolean;

  assignment:
    ExamAssignmentInfo;

  student:
    ExamStudentInfo;

  attempt:
    ExamAttempt;

  questions:
    ExamQuestion[];
};

export type ExamErrorResponse = {
  status: "error";

  message: string;
};

export type StartExamApiResponse =
  | StartExamResponse
  | ExamErrorResponse;

export type AssignmentInfoApiResponse =
  | AssignmentInfoResponse
  | ExamErrorResponse;

export function isSingleChoiceQuestion(
  question: ExamQuestion
): question is ExamSingleChoiceQuestion {
  return (
    question.type ===
    "single_choice"
  );
}

export function isTrueFalseQuestion(
  question: ExamQuestion
): question is ExamTrueFalseQuestion {
  return (
    question.type ===
    "true_false_group"
  );
}

export function isShortAnswerQuestion(
  question: ExamQuestion
): question is ExamShortAnswerQuestion {
  return (
    question.type ===
    "short_answer"
  );
}
