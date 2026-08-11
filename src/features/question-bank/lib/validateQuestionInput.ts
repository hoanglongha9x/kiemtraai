import type {
  CreateQuestionInput,
} from "../repositories";

export type QuestionValidationResult =
  {
    valid: boolean;
    errors: string[];
  };

function hasDuplicateValues(
  values: string[]
): boolean {
  const normalizedValues =
    values.map((value) =>
      value.trim().toLowerCase()
    );

  return (
    new Set(normalizedValues).size !==
    normalizedValues.length
  );
}

export function validateQuestionInput(
  question: CreateQuestionInput
): QuestionValidationResult {
  const errors: string[] = [];

  if (!question.content.trim()) {
    errors.push(
      "Nội dung câu hỏi không được để trống."
    );
  }

  if (!question.subject.trim()) {
    errors.push(
      "Môn học không được để trống."
    );
  }

  if (!question.grade.trim()) {
    errors.push(
      "Khối lớp không được để trống."
    );
  }

  if (
    question.tags &&
    hasDuplicateValues(
      question.tags
    )
  ) {
    errors.push(
      "Danh sách thẻ không được chứa giá trị trùng."
    );
  }

  if (
    question.type ===
    "single_choice"
  ) {
    if (
      question.options.length !==
      4
    ) {
      errors.push(
        "Câu hỏi trắc nghiệm phải có đúng 4 phương án."
      );
    }

    const expectedOptionIds = [
      "A",
      "B",
      "C",
      "D",
    ];

    const optionIds =
      question.options.map(
        (option) =>
          option.id
      );

    const hasAllOptionIds =
      expectedOptionIds.every(
        (optionId) =>
          optionIds.includes(
            optionId as
              | "A"
              | "B"
              | "C"
              | "D"
          )
      );

    if (!hasAllOptionIds) {
      errors.push(
        "Các phương án phải có đủ ID A, B, C và D."
      );
    }

    const hasEmptyOption =
      question.options.some(
        (option) =>
          !option.content.trim() &&
          !option.imageUrl?.trim() &&
          !option.imageId?.trim()
      );

    if (hasEmptyOption) {
      errors.push(
        "Phương án phải có nội dung hoặc ảnh công thức."
      );
    }

    const correctOptionExists =
      question.options.some(
        (option) =>
          option.id ===
          question.correctOptionId
      );

    if (!correctOptionExists) {
      errors.push(
        "Đáp án đúng không tồn tại trong danh sách phương án."
      );
    }
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    if (
      question.statements.length !==
      4
    ) {
      errors.push(
        "Câu hỏi đúng/sai phải có đúng 4 mệnh đề."
      );
    }

    const expectedStatementIds = [
      "A",
      "B",
      "C",
      "D",
    ];

    const statementIds =
      question.statements.map(
        (statement) =>
          statement.id
      );

    const hasAllStatementIds =
      expectedStatementIds.every(
        (statementId) =>
          statementIds.includes(
            statementId as
              | "A"
              | "B"
              | "C"
              | "D"
          )
      );

    if (!hasAllStatementIds) {
      errors.push(
        "Các mệnh đề phải có đủ ID A, B, C và D."
      );
    }

    const hasEmptyStatement =
      question.statements.some(
        (statement) =>
          !statement.content.trim()
      );

    if (hasEmptyStatement) {
      errors.push(
        "Nội dung mệnh đề không được để trống."
      );
    }
  }

  if (
    question.type ===
    "short_answer"
  ) {
    if (
      question.acceptedAnswers.length ===
      0
    ) {
      errors.push(
        "Câu hỏi trả lời ngắn phải có ít nhất một đáp án được chấp nhận."
      );
    }

    const hasEmptyAnswer =
      question.acceptedAnswers.some(
        (answer) =>
          !answer.trim()
      );

    if (hasEmptyAnswer) {
      errors.push(
        "Đáp án được chấp nhận không được để trống."
      );
    }

    if (
      hasDuplicateValues(
        question.acceptedAnswers
      )
    ) {
      errors.push(
        "Các đáp án được chấp nhận không được trùng nhau."
      );
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
  valid: true,
  errors: [],
};
}

export function assertValidQuestionInput(
  question: CreateQuestionInput
): void {
  const result =
    validateQuestionInput(
      question
    );

  if (result.valid) {
  return;
}

throw new Error(
  result.errors.join(" ")
);
}
