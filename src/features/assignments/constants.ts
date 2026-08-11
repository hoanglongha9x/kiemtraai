import type {
  AssignmentExamSettings,
  AssignmentResultVisibility,
} from "./types";

export const ASSIGNMENTS_COLLECTION =
  "testAssignments";

export const DEFAULT_ASSIGNMENT_DURATION_MINUTES =
  45;

export const DEFAULT_ASSIGNMENT_MAX_ATTEMPTS =
  1;

export const MAX_ASSIGNMENT_ATTEMPTS =
  20;

export const MAX_ASSIGNMENT_CLASSES =
  50;

export const ASSIGNMENT_CODE_PREFIX =
  "KT";

export const ASSIGNMENT_CODE_RANDOM_LENGTH =
  6;

export const ASSIGNMENT_CODE_MAX_GENERATION_ATTEMPTS =
  10;

export const DEFAULT_RESULT_VISIBILITY:
  AssignmentResultVisibility =
    "immediately";

export const DEFAULT_ASSIGNMENT_EXAM_SETTINGS:
  AssignmentExamSettings = {
    shuffleQuestions:
      false,

    shuffleOptions:
      false,

    allowBackNavigation:
      true,

    showQuestionNumbers:
      true,

    showProgress:
      true,

    autosaveAnswers:
      true,

    resultVisibility:
      DEFAULT_RESULT_VISIBILITY,

    showCorrectAnswers:
      false,
  };