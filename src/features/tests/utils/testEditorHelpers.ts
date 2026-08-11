import type {
  TestData,
  TestQuestionItem,
  TestQuestionSnapshot,
  TestSection,
} from "../types";

export function calculateSectionScore(
  section: TestSection
): number {
  return section.questions.reduce(
    (total, question) =>
      total +
      Number(
        question.score || 0
      ),
    0
  );
}

export function calculateTestTotals(
  sections: TestSection[]
): {
  totalQuestions: number;
  totalScore: number;
} {
  return sections.reduce(
    (summary, section) => {
      summary.totalQuestions +=
        section.questions.length;

      summary.totalScore +=
        calculateSectionScore(
          section
        );

      return summary;
    },
    {
      totalQuestions: 0,
      totalScore: 0,
    }
  );
}

export function synchronizeTestTotals(
  test: TestData
): TestData {
  const totals =
    calculateTestTotals(
      test.sections
    );

  return {
    ...test,

    totalQuestions:
      totals.totalQuestions,

    totalScore:
      totals.totalScore,
  };
}

export function replaceTestSection(
  test: TestData,
  updatedSection: TestSection
): TestData {
  const nextTest = {
    ...test,

    sections:
      test.sections.map(
        (section) =>
          section.id ===
          updatedSection.id
            ? updatedSection
            : section
      ),
  };

  return synchronizeTestTotals(
    nextTest
  );
}

export function updateTestSection(
  test: TestData,
  sectionId: string,
  changes: Partial<
    Omit<
      TestSection,
      "id"
    >
  >
): TestData {
  const nextSections =
    test.sections.map(
      (section) =>
        section.id ===
        sectionId
          ? {
              ...section,
              ...changes,

              id:
                section.id,
            }
          : section
    );

  return synchronizeTestTotals({
    ...test,

    sections:
      nextSections,
  });
}

export function updateTestQuestion(
  test: TestData,
  sectionId: string,
  testQuestionId: string,
  changes: Partial<
    Omit<
      TestQuestionItem,
      "id" | "snapshot"
    >
  >
): TestData {
  const nextSections =
    test.sections.map(
      (section) => {
        if (
          section.id !==
          sectionId
        ) {
          return section;
        }

        return {
          ...section,

          questions:
            section.questions.map(
              (question) =>
                question.id ===
                testQuestionId
                  ? {
                      ...question,
                      ...changes,

                      id:
                        question.id,

                      snapshot:
                        question.snapshot,
                    }
                  : question
            ),
        };
      }
    );

  return synchronizeTestTotals({
    ...test,

    sections:
      nextSections,
  });
}

export function updateTestQuestionSnapshot(
  test: TestData,
  sectionId: string,
  testQuestionId: string,
  snapshot: TestQuestionSnapshot
): TestData {
  const nextSections =
    test.sections.map(
      (section) => {
        if (
          section.id !==
          sectionId
        ) {
          return section;
        }

        return {
          ...section,

          questions:
            section.questions.map(
              (question) =>
                question.id ===
                testQuestionId
                  ? {
                      ...question,
                      snapshot: {
                        ...snapshot,
                        snapshotCreatedAt:
                          new Date().toISOString(),
                      },
                    }
                  : question
            ),
        };
      }
    );

  return synchronizeTestTotals({
    ...test,

    sections:
      nextSections,
  });
}

export function updateTestTitle(
  test: TestData,
  title: string
): TestData {
  return {
    ...test,

    title,
  };
}

export function updateTestDescription(
  test: TestData,
  description: string
): TestData {
  return {
    ...test,

    description:
      description || undefined,
  };
}

export function updateTestInstructions(
  test: TestData,
  instructions: string
): TestData {
  return {
    ...test,

    instructions:
      instructions || undefined,
  };
}

export function updateTestDuration(
  test: TestData,
  durationMinutes: number
): TestData {
  const normalizedDuration =
    Number(durationMinutes);

  return {
    ...test,

    durationMinutes:
      Number.isFinite(
        normalizedDuration
      )
        ? normalizedDuration
        : 0,
  };
}

export function updateTestSubject(
  test: TestData,
  subject: string
): TestData {
  return {
    ...test,

    metadata: {
      ...test.metadata,

      subject,
    },
  };
}

export function updateTestGrade(
  test: TestData,
  grade: string
): TestData {
  return {
    ...test,

    metadata: {
      ...test.metadata,

      grade,
    },
  };
}
