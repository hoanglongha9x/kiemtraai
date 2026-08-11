import {
  roundGradingScore,
} from "./normalize";

import type {
  GradingScoreConfig,
  GradingScoreResult,
} from "./types";

function normalizeTotalScore(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 10;
  }

  return value;
}

export function calculateGradingScore(
  config: GradingScoreConfig
): GradingScoreResult {
  const totalScore =
    normalizeTotalScore(
      config.assignmentTotalScore
    );

  let percentage = 0;

  if (
    config.maximumRawScore > 0
  ) {
    percentage =
      config.earnedRawScore /
      config.maximumRawScore;
  } else if (
    config.totalQuestions > 0
  ) {
    percentage =
      config.correctQuestionCount /
      config.totalQuestions;
  }

  const safePercentage =
    Math.min(
      1,
      Math.max(0, percentage)
    );

  return {
    score:
      roundGradingScore(
        safePercentage *
          totalScore,
        2
      ),

    totalScore,

    percentage:
      roundGradingScore(
        safePercentage * 100,
        2
      ),
  };
}