import { asRecord, safeString } from "@/features/exam/utils";
import type {
  SubmitAnswerReviewItem,
  SubmitSummaryResponse,
  SubmitTransactionResult,
} from "./submit-types";

export type SubmitSuccessResponse = {
  status: "success";
  resultId: string;
  alreadySubmitted: boolean;
  summary: SubmitSummaryResponse | null;
  answerReview?: SubmitAnswerReviewItem[];
  message: string;
};

export type AlreadySubmittedResponse = {
  status: "success";
  resultId: string;
  alreadySubmitted: true;
  message: string;
};

export function buildAlreadySubmittedResponse(resultId: string): AlreadySubmittedResponse {
  return { status: "success", resultId, alreadySubmitted: true, message: "Bài làm này đã được nộp trước đó." };
}

function readStoredSummary(result: Record<string, unknown>): SubmitSummaryResponse | null {
  const keys = [
    "score", "totalScore", "percentage", "totalQuestions", "answeredQuestionCount",
    "correctQuestionCount", "answeredStatementCount", "correctStatementCount", "totalStatementCount",
  ] as const;
  // An incomplete legacy result must not acquire fabricated/recomputed scores.
  if (keys.some((key) => typeof result[key] !== "number" || !Number.isFinite(result[key]))) {
    return null;
  }
  return Object.fromEntries(keys.map((key) => [key, result[key]])) as SubmitSummaryResponse;
}

function readStoredReview(result: Record<string, unknown>): SubmitAnswerReviewItem[] {
  if (!Array.isArray(result.detail)) return [];
  return result.detail.flatMap((rawItem): SubmitAnswerReviewItem[] => {
    const item = asRecord(rawItem);
    if (item.type !== "single_choice" && item.type !== "true_false_group" && item.type !== "short_answer") return [];
    if (typeof item.questionNumber !== "number" || typeof item.score !== "number" || typeof item.maxScore !== "number") return [];
    // Explicit DTO: never spread the result document into the public response.
    return [{
      questionId: safeString(item.questionId),
      questionNumber: item.questionNumber,
      sectionTitle: safeString(item.sectionTitle),
      type: item.type,
      studentAnswer: item.studentAnswer,
      isCorrect: item.isCorrect === true,
      score: item.score,
      maxScore: item.maxScore,
      ...(item.type === "short_answer"
        ? { acceptedAnswers: Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers.filter((v): v is string => typeof v === "string") : [] }
        : { correctAnswer: item.correctAnswer }),
    }];
  });
}

export function buildSubmitSuccessResponse({ transactionResult }: {
  transactionResult: SubmitTransactionResult;
}): SubmitSuccessResponse {
  const { result, assignmentSettings, resultId, alreadySubmitted } = transactionResult;
  // Preserve the current release policy in this PR; its three-state fix is
  // a separate task. Missing assignment means no permission to reveal data.
  const canShowResult = assignmentSettings?.resultVisibility === "immediately";
  const canShowCorrectAnswers = canShowResult && assignmentSettings?.showCorrectAnswers;
  return {
    status: "success", resultId, alreadySubmitted,
    summary: canShowResult ? readStoredSummary(result) : null,
    ...(canShowCorrectAnswers ? { answerReview: readStoredReview(result) } : {}),
    message: alreadySubmitted ? "Bài làm này đã được nộp trước đó." : "Đã nộp bài thành công.",
  };
}
