import type {
  PreparedSubmit,
  SubmitAnswerReviewItem,
  SubmitSummaryResponse,
  SubmitTransactionResult,
} from "./submit-types";

export type SubmitSuccessResponse = {
  status: "success";

  resultId: string;

  alreadySubmitted:
    boolean;

  summary:
    SubmitSummaryResponse | null;

  answerReview?:
    SubmitAnswerReviewItem[];

  message:
    string;
};

export type AlreadySubmittedResponse = {
  status: "success";

  resultId: string;

  alreadySubmitted: true;

  message: string;
};

export function buildAlreadySubmittedResponse(
  resultId: string
): AlreadySubmittedResponse {
  return {
    status:
      "success",

    resultId,

    alreadySubmitted:
      true,

    message:
      "Bài làm này đã được nộp trước đó.",
  };
}

export function buildSubmitSuccessResponse({
  transactionResult,
  preparedSubmit,
}: {
  transactionResult:
    SubmitTransactionResult;

  preparedSubmit:
    PreparedSubmit;
}): SubmitSuccessResponse {
  const {
    gradingSummary,
    gradingScore,
    assignmentSettings,
  } = preparedSubmit;

  const canShowResult =
    assignmentSettings
      .resultVisibility ===
    "immediately";

  const canShowCorrectAnswers =
    canShowResult &&
    assignmentSettings
      .showCorrectAnswers;

  return {
    status:
      "success",

    resultId:
      transactionResult
        .resultId,

    alreadySubmitted:
      transactionResult
        .alreadySubmitted,

    summary: canShowResult
      ? {
          score:
            gradingScore.score,

          totalScore:
            gradingScore.totalScore,

          percentage:
            gradingScore.percentage,

          totalQuestions:
            gradingSummary
              .totalQuestions,

          answeredQuestionCount:
            gradingSummary
              .answeredQuestionCount,

          correctQuestionCount:
            gradingSummary
              .correctQuestionCount,

          answeredStatementCount:
            gradingSummary
              .answeredStatementCount,

          correctStatementCount:
            gradingSummary
              .correctStatementCount,

          totalStatementCount:
            gradingSummary
              .totalStatementCount,
        }
      : null,

    ...(canShowCorrectAnswers
      ? {
          answerReview:
            gradingSummary.detail.map(
              (item): SubmitAnswerReviewItem => {
                if (
                  item.type ===
                  "single_choice"
                ) {
                  return {
                    questionId:
                      item.questionId,
                    questionNumber:
                      item.questionNumber,
                    sectionTitle:
                      item.sectionTitle,
                    type:
                      item.type,
                    studentAnswer:
                      item.studentAnswer,
                    correctAnswer:
                      item.correctAnswer,
                    isCorrect:
                      item.isCorrect,
                    score:
                      item.score,
                    maxScore:
                      item.maxScore,
                  };
                }

                if (
                  item.type ===
                  "true_false_group"
                ) {
                  return {
                    questionId:
                      item.questionId,
                    questionNumber:
                      item.questionNumber,
                    sectionTitle:
                      item.sectionTitle,
                    type:
                      item.type,
                    studentAnswer:
                      item.studentAnswer,
                    correctAnswer:
                      item.correctAnswer,
                    isCorrect:
                      item.isCorrect,
                    score:
                      item.score,
                    maxScore:
                      item.maxScore,
                  };
                }

                return {
                  questionId:
                    item.questionId,
                  questionNumber:
                    item.questionNumber,
                  sectionTitle:
                    item.sectionTitle,
                  type:
                    item.type,
                  studentAnswer:
                    item.studentAnswer,
                  acceptedAnswers:
                    item.acceptedAnswers,
                  isCorrect:
                    item.isCorrect,
                  score:
                    item.score,
                  maxScore:
                    item.maxScore,
                };
              }
            ),
        }
      : {}),

    message:
      transactionResult
        .alreadySubmitted
        ? "Bài làm này đã được nộp trước đó."
        : "Đã nộp bài thành công.",
  };
}
