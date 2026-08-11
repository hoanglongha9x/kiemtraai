import {
  TEST_MAX_DURATION_MINUTES,
  TEST_MAX_QUESTION_SCORE,
  TEST_MIN_DURATION_MINUTES,
  TEST_MIN_QUESTION_SCORE,
  TEST_TITLE_MAX_LENGTH,
} from "../constants";

import type {
  TestData,
  TestQuestionItem,
  TestValidationIssue,
  TestValidationResult,
} from "../types";

function createIssue(
  issue: TestValidationIssue
): TestValidationIssue {
  return issue;
}

function validateQuestionContent(
  question: TestQuestionItem,
  sectionId: string
): TestValidationIssue[] {
  const issues:
    TestValidationIssue[] = [];

  const {
    snapshot,
  } = question;

  if (
    !snapshot.content.trim()
  ) {
    issues.push(
      createIssue({
        code:
          "missing_question",

        severity:
          "error",

        message:
          "Câu hỏi chưa có nội dung.",

        sectionId,

        questionId:
          question.id,
      })
    );
  }

  if (
    !Number.isFinite(
      question.score
    ) ||
    question.score <
      TEST_MIN_QUESTION_SCORE ||
    question.score >
      TEST_MAX_QUESTION_SCORE
  ) {
    issues.push(
      createIssue({
        code:
          "invalid_question_score",

        severity:
          "error",

        message:
          `Điểm câu hỏi phải nằm trong khoảng ${TEST_MIN_QUESTION_SCORE} đến ${TEST_MAX_QUESTION_SCORE}.`,

        sectionId,

        questionId:
          question.id,
      })
    );
  }

  if (
    snapshot.type ===
    "single_choice"
  ) {
    const optionIds =
      new Set(
        snapshot.options.map(
          (option) =>
            option.id
        )
      );

    const hasFourOptions =
      snapshot.options.length ===
        4 &&
      optionIds.size === 4;

    const allOptionsHaveContent =
      snapshot.options.every(
        (option) =>
          Boolean(
            option.content.trim()
          )
      );

    const hasCorrectOption =
      optionIds.has(
        snapshot.correctOptionId
      );

    if (
      !hasFourOptions ||
      !allOptionsHaveContent ||
      !hasCorrectOption
    ) {
      issues.push(
        createIssue({
          code:
            "invalid_single_choice",

          severity:
            "error",

          message:
            "Câu trắc nghiệm phải có đủ bốn phương án A, B, C, D và một đáp án đúng hợp lệ.",

          sectionId,

          questionId:
            question.id,
        })
      );
    }
  }

  if (
    snapshot.type ===
    "true_false_group"
  ) {
    const statementIds =
      new Set(
        snapshot.statements.map(
          (statement) =>
            statement.id
        )
      );

    const hasFourStatements =
      snapshot.statements.length ===
        4 &&
      statementIds.size === 4;

    const allStatementsHaveContent =
      snapshot.statements.every(
        (statement) =>
          Boolean(
            statement.content.trim()
          )
      );

    if (
      !hasFourStatements ||
      !allStatementsHaveContent
    ) {
      issues.push(
        createIssue({
          code:
            "invalid_true_false_group",

          severity:
            "error",

          message:
            "Câu đúng/sai phải có đủ bốn mệnh đề A, B, C và D.",

          sectionId,

          questionId:
            question.id,
        })
      );
    }
  }

  if (
    snapshot.type ===
    "short_answer"
  ) {
    const hasAcceptedAnswer =
      snapshot.acceptedAnswers.some(
        (answer) =>
          Boolean(
            answer.trim()
          )
      );

    if (!hasAcceptedAnswer) {
      issues.push(
        createIssue({
          code:
            "invalid_short_answer",

          severity:
            "error",

          message:
            "Câu trả lời ngắn phải có ít nhất một đáp án được chấp nhận.",

          sectionId,

          questionId:
            question.id,
        })
      );
    }
  }

  return issues;
}

export function validateTest(
  test: Pick<
    TestData,
    | "title"
    | "durationMinutes"
    | "metadata"
    | "sections"
    | "totalScore"
  >
): TestValidationResult {
  const issues:
    TestValidationIssue[] = [];

  const normalizedTitle =
    test.title.trim();

  if (!normalizedTitle) {
    issues.push(
      createIssue({
        code:
          "missing_title",

        severity:
          "error",

        message:
          "Vui lòng nhập tên đề kiểm tra.",
      })
    );
  } else if (
    normalizedTitle.length >
    TEST_TITLE_MAX_LENGTH
  ) {
    issues.push(
      createIssue({
        code:
          "missing_title",

        severity:
          "error",

        message:
          `Tên đề không được vượt quá ${TEST_TITLE_MAX_LENGTH} ký tự.`,
      })
    );
  }

  if (
    !test.metadata.subject.trim()
  ) {
    issues.push(
      createIssue({
        code:
          "missing_subject",

        severity:
          "error",

        message:
          "Vui lòng chọn môn học.",
      })
    );
  }

  if (
    !test.metadata.grade.trim()
  ) {
    issues.push(
      createIssue({
        code:
          "missing_grade",

        severity:
          "error",

        message:
          "Vui lòng chọn khối lớp.",
      })
    );
  }

  if (
    !Number.isInteger(
      test.durationMinutes
    ) ||
    test.durationMinutes <
      TEST_MIN_DURATION_MINUTES ||
    test.durationMinutes >
      TEST_MAX_DURATION_MINUTES
  ) {
    issues.push(
      createIssue({
        code:
          "invalid_duration",

        severity:
          "error",

        message:
          `Thời gian làm bài phải là số nguyên từ ${TEST_MIN_DURATION_MINUTES} đến ${TEST_MAX_DURATION_MINUTES} phút.`,
      })
    );
  }

  if (
    test.sections.length ===
    0
  ) {
    issues.push(
      createIssue({
        code:
          "missing_section",

        severity:
          "error",

        message:
          "Đề kiểm tra phải có ít nhất một phần thi.",
      })
    );
  }

  const totalQuestionCount =
    test.sections.reduce(
      (
        total,
        section
      ) =>
        total +
        section.questions.length,
      0
    );

  if (
    totalQuestionCount === 0
  ) {
    issues.push(
      createIssue({
        code:
          "missing_question",

        severity:
          "error",

        message:
          "Đề kiểm tra phải có ít nhất một câu hỏi.",
      })
    );
  }

  const questionKeys =
    new Set<string>();

  test.sections.forEach(
    (section) => {
      if (
        section.questions.length ===
        0
      ) {
        issues.push(
          createIssue({
            code:
              "empty_section",

            severity:
              "warning",

            message:
              `Phần “${section.title}” chưa có câu hỏi.`,

            sectionId:
              section.id,
          })
        );
      }

      section.questions.forEach(
        (question) => {
          if (
            question.snapshot.type !==
            section.type
          ) {
            issues.push(
              createIssue({
                code:
                  "section_type_mismatch",

                severity:
                  "error",

                message:
                  "Loại câu hỏi không phù hợp với loại của phần thi.",

                sectionId:
                  section.id,

                questionId:
                  question.id,
              })
            );
          }

          const duplicateKey =
            question.questionBankId ??
            question.snapshot
              .originalQuestionId;

          if (duplicateKey) {
            if (
              questionKeys.has(
                duplicateKey
              )
            ) {
              issues.push(
                createIssue({
                  code:
                    "duplicate_question",

                  severity:
                    "error",

                  message:
                    "Câu hỏi này xuất hiện nhiều lần trong đề.",

                  sectionId:
                    section.id,

                  questionId:
                    question.id,
                })
              );
            } else {
              questionKeys.add(
                duplicateKey
              );
            }
          }

          issues.push(
            ...validateQuestionContent(
              question,
              section.id
            )
          );

          const missingLearningMetadata = [
            ["chủ đề", question.snapshot.topic],
            ["đơn vị kiến thức", question.snapshot.knowledgeUnit],
            ["kỹ năng", question.snapshot.skill],
            ["yêu cầu cần đạt", question.snapshot.learningOutcome],
          ]
            .filter(([, value]) => !String(value || "").trim())
            .map(([label]) => label);

          if (missingLearningMetadata.length > 0) {
            issues.push(
              createIssue({
                code: "missing_learning_metadata",
                severity: "warning",
                message: `Câu hỏi thiếu ${missingLearningMetadata.join(", ")}. Báo cáo năng lực có thể không đủ chính xác.`,
                sectionId: section.id,
                questionId: question.id,
              })
            );
          }
        }
      );
    }
  );

  const calculatedScore =
    test.sections.reduce(
      (
        total,
        section
      ) =>
        total +
        section.questions.reduce(
          (
            sectionTotal,
            question
          ) =>
            sectionTotal +
            question.score,
          0
        ),
      0
    );

  if (
    !Number.isFinite(
      calculatedScore
    ) ||
    calculatedScore <= 0
  ) {
    issues.push(
      createIssue({
        code:
          "invalid_total_score",

        severity:
          "error",

        message:
          "Tổng điểm của đề phải lớn hơn 0.",
      })
    );
  }

  if (
    Math.abs(
      calculatedScore -
        test.totalScore
    ) > 0.0001
  ) {
    issues.push(
      createIssue({
        code:
          "invalid_total_score",

        severity:
          "warning",

        message:
          "Tổng điểm đang lưu không khớp với tổng điểm được tính từ các câu hỏi.",
      })
    );
  }

  const errors =
    issues.filter(
      (issue) =>
        issue.severity ===
        "error"
    );

  const warnings =
    issues.filter(
      (issue) =>
        issue.severity ===
        "warning"
    );

  return {
    valid:
      errors.length === 0,

    errors,

    warnings,

    issues,
  };
}
