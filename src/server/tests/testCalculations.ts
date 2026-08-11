import type {
  NormalizedQuestion,
  QuestionTypeCounts,
  SectionCounts,
  TestSection,
  TestSectionId,
} from "./testTypes";

export function calculateQuestionTypeCounts(
  questions:
    NormalizedQuestion[]
): QuestionTypeCounts {
  return questions.reduce(
    (
      result,
      question
    ) => {
      result[
        question.questionType
      ] += 1;

      return result;
    },
    {
      single_choice: 0,

      true_false_group: 0,

      short_answer: 0,
    }
  );
}

export function calculateSectionCounts(
  questions:
    NormalizedQuestion[]
): SectionCounts {
  return questions.reduce(
    (
      result,
      question
    ) => {
      result[
        question.section
      ] += 1;

      return result;
    },
    {
      part_1: 0,

      part_2: 0,

      part_3: 0,
    }
  );
}

export function calculateTotalScore(
  questions:
    NormalizedQuestion[]
): number {
  return Number(
    questions
      .reduce(
        (
          total,
          question
        ) =>
          total +
          Number(
            question.score ||
              0
          ),
        0
      )
      .toFixed(
        2
      )
  );
}

function getSectionTitle(
  sectionId:
    TestSectionId
): string {
  if (
    sectionId ===
    "part_2"
  ) {
    return "Phần II. Câu hỏi đúng/sai";
  }

  if (
    sectionId ===
    "part_3"
  ) {
    return "Phần III. Câu trả lời ngắn";
  }

  return "Phần I. Câu hỏi trắc nghiệm";
}

function getSectionInstructions(
  sectionId:
    TestSectionId
): string {
  if (
    sectionId ===
    "part_2"
  ) {
    return "Với mỗi phát biểu a, b, c, d, học sinh chọn Đúng hoặc Sai.";
  }

  if (
    sectionId ===
    "part_3"
  ) {
    return "Học sinh nhập câu trả lời ngắn cho từng câu hỏi.";
  }

  return "Học sinh chọn một đáp án đúng trong bốn phương án A, B, C, D.";
}

export function buildTestSections(
  questions:
    NormalizedQuestion[]
): TestSection[] {
  const sectionIds:
    TestSectionId[] = [
      "part_1",
      "part_2",
      "part_3",
    ];

  return sectionIds
    .map(
      (
        sectionId
      ) => ({
        id:
          sectionId,

        title:
          getSectionTitle(
            sectionId
          ),

        instructions:
          getSectionInstructions(
            sectionId
          ),

        questions:
          questions.filter(
            (
              question
            ) =>
              question.section ===
              sectionId
          ),
      })
    )
    .filter(
      (
        section
      ) =>
        section.questions.length >
        0
    );
}

export function countSectionQuestions(
  sections:
    TestSection[]
): number {
  return sections.reduce(
    (
      total,
      section
    ) =>
      total +
      section.questions.length,
    0
  );
}