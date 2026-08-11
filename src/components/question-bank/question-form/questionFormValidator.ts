import type {
  QuestionFormErrors,
  QuestionFormValues,
} from "./questionFormTypes";

export function validateQuestionForm(
  values:
    QuestionFormValues
): QuestionFormErrors {
  const errors:
    QuestionFormErrors = {};

  if (
    !values.content.trim()
  ) {
    errors.content =
      "Vui lòng nhập nội dung câu hỏi.";
  }

  if (
    !values.subject.trim()
  ) {
    errors.subject =
      "Vui lòng nhập môn học.";
  }

  if (
    !values.grade.trim()
  ) {
    errors.grade =
      "Vui lòng chọn khối lớp.";
  }

  if (
    values.type ===
    "single_choice"
  ) {
    if (
      !values.optionA.trim() &&
      !values.optionAImageUrl.trim() &&
      !values.optionAImageId.trim()
    ) {
      errors.optionA =
        "Vui lòng nhập phương án A.";
    }

    if (
      !values.optionB.trim() &&
      !values.optionBImageUrl.trim() &&
      !values.optionBImageId.trim()
    ) {
      errors.optionB =
        "Vui lòng nhập phương án B.";
    }

    if (
      !values.optionC.trim() &&
      !values.optionCImageUrl.trim() &&
      !values.optionCImageId.trim()
    ) {
      errors.optionC =
        "Vui lòng nhập phương án C.";
    }

    if (
      !values.optionD.trim() &&
      !values.optionDImageUrl.trim() &&
      !values.optionDImageId.trim()
    ) {
      errors.optionD =
        "Vui lòng nhập phương án D.";
    }
  }

  if (
    values.type ===
    "true_false_group"
  ) {
    if (
      !values.statementA.trim()
    ) {
      errors.statementA =
        "Vui lòng nhập mệnh đề A.";
    }

    if (
      !values.statementB.trim()
    ) {
      errors.statementB =
        "Vui lòng nhập mệnh đề B.";
    }

    if (
      !values.statementC.trim()
    ) {
      errors.statementC =
        "Vui lòng nhập mệnh đề C.";
    }

    if (
      !values.statementD.trim()
    ) {
      errors.statementD =
        "Vui lòng nhập mệnh đề D.";
    }
  }

  if (
    values.type ===
      "short_answer" &&
    !values.acceptedAnswers.trim()
  ) {
    errors.acceptedAnswers =
      "Vui lòng nhập ít nhất một đáp án.";
  }

  return errors;
}
