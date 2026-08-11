import type {
  CognitiveLevel,
  QuestionDifficulty,
  QuestionType,
} from "@/components/question-bank/types";

import type {
  TestSection,
  TestSummary,
} from "../types";

function createQuestionTypeCount(): Record<
  QuestionType,
  number
> {
  return {
    single_choice: 0,

    true_false_group: 0,

    short_answer: 0,
  };
}

function createDifficultyCount(): Record<
  QuestionDifficulty,
  number
> {
  return {
    easy: 0,

    medium: 0,

    hard: 0,
  };
}

function createCognitiveLevelCount(): Record<
  CognitiveLevel,
  number
> {
  return {
    recognition: 0,

    understanding: 0,

    application: 0,

    high_application: 0,
  };
}

function roundScore(
  value: number
): number {
  return Number(
    value.toFixed(4)
  );
}

export function calculateTestSummary(
  sections:
    TestSection[]
): TestSummary {
  const summary:
    TestSummary = {
      totalSections:
        sections.length,

      totalQuestions: 0,

      totalScore: 0,

      questionCountByType:
        createQuestionTypeCount(),

      questionCountByDifficulty:
        createDifficultyCount(),

      questionCountByCognitiveLevel:
        createCognitiveLevelCount(),
    };

  sections.forEach(
    (section) => {
      section.questions.forEach(
        (question) => {
          const {
            snapshot,
          } = question;

          summary.totalQuestions +=
            1;

          summary.totalScore +=
            question.score;

          summary
            .questionCountByType[
            snapshot.type
          ] += 1;

          summary
            .questionCountByDifficulty[
            snapshot.difficulty
          ] += 1;

          summary
            .questionCountByCognitiveLevel[
            snapshot.cognitiveLevel
          ] += 1;
        }
      );
    }
  );

  summary.totalScore =
    roundScore(
      summary.totalScore
    );

  return summary;
}