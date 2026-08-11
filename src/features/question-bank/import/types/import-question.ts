import type {
  CreateQuestionInput,
} from "../../repositories";

export type ImportAnswerSource =
  | "pdf_color"
  | "manual_required";

export type ImportQuestionWarning = {
  questionNumber?: number;
  message: string;
};

export type ParsedImportQuestion = {
  importId: string;
  sourceNumber: number;
  question: CreateQuestionInput;
  answerSource?: ImportAnswerSource;
  answer_source?: ImportAnswerSource;
  needsManualReview?: boolean;
  needs_manual_review?: boolean;
  reviewReason?: string;
  recognitionConfidence?: number;
  visualFallbackRecommended?: boolean;
};

export type ImportQuestionsResponse = {
  fileName: string;
  totalDetected: number;
  questions: ParsedImportQuestion[];
  warnings: ImportQuestionWarning[];
};

export type ImportQuestionsErrorResponse = {
  message: string;
};
