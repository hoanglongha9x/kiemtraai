import {
  ApiError,
} from "@/server/http/apiError";

import {
  normalizeBoolean,
  normalizeNumber,
  normalizeStringArray,
  safeLower,
  safeString,
} from "@/server/shared/normalize";

import type {
  AnswerKey,
  CognitiveLevel,
  NormalizedQuestion,
  NormalizedTrueFalseStatement,
  QuestionDifficulty,
  QuestionInput,
  QuestionType,
  TestSectionId,
  TrueFalseStatementInput,
} from "./testTypes";

function normalizeAnswerKey(
  value: unknown
): AnswerKey | "" {
  const answer =
    safeString(
      value
    ).toUpperCase();

  if (
    answer === "A" ||
    answer === "B" ||
    answer === "C" ||
    answer === "D"
  ) {
    return answer;
  }

  return "";
}

function normalizeQuestionType(
  value: unknown
): QuestionType {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized ===
      "true_false_group" ||
    normalized ===
      "true-false-group" ||
    normalized ===
      "true_false" ||
    normalized ===
      "true-false"
  ) {
    return "true_false_group";
  }

  if (
    normalized ===
      "short_answer" ||
    normalized ===
      "short-answer" ||
    normalized ===
      "shortanswer"
  ) {
    return "short_answer";
  }

  return "single_choice";
}

function normalizeSection(
  value: unknown,
  questionType: QuestionType
): TestSectionId {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized === "part_1" ||
    normalized === "part1" ||
    normalized === "1"
  ) {
    return "part_1";
  }

  if (
    normalized === "part_2" ||
    normalized === "part2" ||
    normalized === "2"
  ) {
    return "part_2";
  }

  if (
    normalized === "part_3" ||
    normalized === "part3" ||
    normalized === "3"
  ) {
    return "part_3";
  }

  if (
    questionType ===
    "true_false_group"
  ) {
    return "part_2";
  }

  if (
    questionType ===
    "short_answer"
  ) {
    return "part_3";
  }

  return "part_1";
}

function normalizeCognitiveLevel(
  value: unknown
): CognitiveLevel {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized ===
      "recognition" ||
    normalized ===
      "understanding" ||
    normalized ===
      "application" ||
    normalized ===
      "high_application"
  ) {
    return normalized;
  }

  return "understanding";
}

function normalizeDifficulty(
  value: unknown
): QuestionDifficulty {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized === "easy" ||
    normalized === "medium" ||
    normalized === "hard"
  ) {
    return normalized;
  }

  return "medium";
}

function normalizeStatementLabel(
  value: unknown,
  index: number
):
  | "a"
  | "b"
  | "c"
  | "d" {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized === "a" ||
    normalized === "b" ||
    normalized === "c" ||
    normalized === "d"
  ) {
    return normalized;
  }

  return (
    [
      "a",
      "b",
      "c",
      "d",
    ][index] ?? "a"
  ) as
    | "a"
    | "b"
    | "c"
    | "d";
}

function normalizeAcceptedAnswers(
  value: unknown,
  expectedAnswer: string
): string[] {
  const sourceValues =
    Array.isArray(
      value
    )
      ? value
      : safeString(
            value
          )
        ? safeString(
            value
          ).split(",")
        : [];

  const answers =
    sourceValues
      .map(
        (
          item
        ) =>
          safeString(
            item
          )
      )
      .filter(
        Boolean
      );

  if (
    expectedAnswer
  ) {
    answers.unshift(
      expectedAnswer
    );
  }

  return Array.from(
    new Set(
      answers
    )
  );
}

function normalizeTrueFalseStatements(
  value: unknown,
  questionIndex: number
): NormalizedTrueFalseStatement[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    throw new ApiError(
      `Câu ${questionIndex + 1} chưa có các phát biểu đúng/sai.`,
      400
    );
  }

  if (
    value.length !== 4
  ) {
    throw new ApiError(
      `Câu ${questionIndex + 1} phải có đúng 4 phát biểu a, b, c, d.`,
      400
    );
  }

  const statements =
    value.map(
      (
        rawItem,
        statementIndex
      ) => {
        const item =
          rawItem as
            TrueFalseStatementInput;

        const statement =
          safeString(
            item.statement
          ) ||
          safeString(
            item.text
          ) ||
          safeString(
            item.content
          );

        if (
          !statement
        ) {
          throw new ApiError(
            `Câu ${questionIndex + 1}, phát biểu ${statementIndex + 1} chưa có nội dung.`,
            400
          );
        }

        const label =
          normalizeStatementLabel(
            item.label,
            statementIndex
          );

        return {
          id:
            safeString(
              item.id
            ) ||
            `${questionIndex + 1}-${label}`,

          label,

          statement,

          statementImageId:
            safeString(
              item.statementImageId
            ),

          statementImageUrl:
            safeString(
              item.statementImageUrl
            ),

          correct:
            normalizeBoolean(
              item.correct,
              false
            ),
        };
      }
    );

  const uniqueLabels =
    new Set(
      statements.map(
        (
          statement
        ) =>
          statement.label
      )
    );

  if (
    uniqueLabels.size !==
    statements.length
  ) {
    throw new ApiError(
      `Câu ${questionIndex + 1} có nhãn phát biểu bị trùng.`,
      400
    );
  }

  return statements;
}

function buildCommonQuestionFields(
  input: QuestionInput,
  index: number,
  subject: string,
  grade: string
) {
  const questionType =
    normalizeQuestionType(
      input.questionType ??
        input.type
    );

  const section =
    normalizeSection(
      input.section,
      questionType
    );

  const question =
    safeString(
      input.question
    ) ||
    safeString(
      input.content
    ) ||
    safeString(
      input.text
    );

  if (
    !question
  ) {
    throw new ApiError(
      `Câu ${index + 1} chưa có nội dung câu hỏi.`,
      400
    );
  }

  return {
    id:
      safeString(
        input.id
      ),

    bankQuestionId:
      safeString(
        input.bankQuestionId
      ),

    questionType,

    section,

    question,

    questionImageId:
      safeString(
        input.questionImageId
      ),

    questionImageUrl:
      safeString(
        input.questionImageUrl
      ),

    explanation:
      safeString(
        input.explanation
      ),

    topic:
      safeString(
        input.topic
      ),

    knowledgeUnit:
      safeString(
        input.knowledgeUnit
      ),

    skill:
      safeString(
        input.skill
      ),

    learningOutcome:
      safeString(
        input.learningOutcome
      ),

    cognitiveLevel:
      normalizeCognitiveLevel(
        input.cognitiveLevel
      ),

    difficulty:
      normalizeDifficulty(
        input.difficulty
      ),

    tags:
      normalizeStringArray(
        input.tags
      ),

    subject,

    grade,
  };
}

export function normalizeQuestion(
  input: QuestionInput,
  index: number,
  subject: string,
  grade: string
): NormalizedQuestion {
  const common =
    buildCommonQuestionFields(
      input,
      index,
      subject,
      grade
    );

  if (
    common.questionType ===
    "single_choice"
  ) {
    const A =
      safeString(
        input.A
      );

    const B =
      safeString(
        input.B
      );

    const C =
      safeString(
        input.C
      );

    const D =
      safeString(
        input.D
      );

    if (
      !A ||
      !B ||
      !C ||
      !D
    ) {
      throw new ApiError(
        `Câu ${index + 1} chưa đủ đáp án A/B/C/D.`,
        400
      );
    }

    const correct =
      normalizeAnswerKey(
        input.correct
      );

    if (
      !correct
    ) {
      throw new ApiError(
        `Câu ${index + 1} chưa có đáp án đúng hợp lệ.`,
        400
      );
    }

    const score =
      normalizeNumber(
        input.score,
        0.25
      );

    if (
      score <= 0
    ) {
      throw new ApiError(
        `Điểm của câu ${index + 1} phải lớn hơn 0.`,
        400
      );
    }

    return {
      ...common,

      A,

      AImageId:
        safeString(
          input.AImageId
        ),

      AImageUrl:
        safeString(
          input.AImageUrl
        ),

      B,

      BImageId:
        safeString(
          input.BImageId
        ),

      BImageUrl:
        safeString(
          input.BImageUrl
        ),

      C,

      CImageId:
        safeString(
          input.CImageId
        ),

      CImageUrl:
        safeString(
          input.CImageUrl
        ),

      D,

      DImageId:
        safeString(
          input.DImageId
        ),

      DImageUrl:
        safeString(
          input.DImageUrl
        ),

      correct,

      statements: [],

      expectedAnswer: "",

      acceptedAnswers: [],

      answerTolerance: 0,

      score,
    };
  }

  if (
    common.questionType ===
    "true_false_group"
  ) {
    const statements =
      normalizeTrueFalseStatements(
        input.statements,
        index
      );

    const score =
      normalizeNumber(
        input.score,
        1
      );

    if (
      score <= 0
    ) {
      throw new ApiError(
        `Điểm của câu ${index + 1} phải lớn hơn 0.`,
        400
      );
    }

    return {
      ...common,

      A: "",

      AImageId: "",

      AImageUrl: "",

      B: "",

      BImageId: "",

      BImageUrl: "",

      C: "",

      CImageId: "",

      CImageUrl: "",

      D: "",

      DImageId: "",

      DImageUrl: "",

      correct: "",

      statements,

      expectedAnswer: "",

      acceptedAnswers: [],

      answerTolerance: 0,

      score,
    };
  }

  const expectedAnswer =
    safeString(
      input.expectedAnswer
    );

  const acceptedAnswers =
    normalizeAcceptedAnswers(
      input.acceptedAnswers,
      expectedAnswer
    );

  if (
    !expectedAnswer &&
    acceptedAnswers.length ===
      0
  ) {
    throw new ApiError(
      `Câu ${index + 1} chưa có đáp án trả lời ngắn.`,
      400
    );
  }

  const answerTolerance =
    Math.max(
      0,
      normalizeNumber(
        input.answerTolerance,
        0
      )
    );

  const score =
    normalizeNumber(
      input.score,
      0.5
    );

  if (
    score <= 0
  ) {
    throw new ApiError(
      `Điểm của câu ${index + 1} phải lớn hơn 0.`,
      400
    );
  }

  return {
    ...common,

    A: "",

    AImageId: "",

    AImageUrl: "",

    B: "",

    BImageId: "",

    BImageUrl: "",

    C: "",

    CImageId: "",

    CImageUrl: "",

    D: "",

    DImageId: "",

    DImageUrl: "",

    correct: "",

    statements: [],

    expectedAnswer:
      expectedAnswer ||
      acceptedAnswers[0] ||
      "",

    acceptedAnswers,

    answerTolerance,

    score,
  };
}

export function normalizeQuestions(
  value: unknown,
  subject: string,
  grade: string
): NormalizedQuestion[] {
  if (
    !Array.isArray(
      value
    ) ||
    value.length === 0
  ) {
    throw new ApiError(
      "Bài kiểm tra cần ít nhất 1 câu hỏi.",
      400
    );
  }

  if (
    value.length > 200
  ) {
    throw new ApiError(
      "Một bài kiểm tra không nên vượt quá 200 câu.",
      400
    );
  }

  return value.map(
    (
      item,
      index
    ) =>
      normalizeQuestion(
        item as QuestionInput,
        index,
        subject,
        grade
      )
  );
}