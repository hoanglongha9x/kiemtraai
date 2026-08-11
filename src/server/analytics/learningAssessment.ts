export type LearningLevel =
  | "good"
  | "average"
  | "weak"
  | "very_weak"
  | "no_data";

export type EvidenceConfidence =
  | "insufficient"
  | "low"
  | "medium"
  | "high";

export type LearningAssessment = {
  level: LearningLevel;
  levelLabel: string;
  confidence: EvidenceConfidence;
  confidenceLabel: string;
  evidenceLabel: string;
  eligible: boolean;
};

const MIN_QUESTIONS_FOR_CLASSIFICATION = 3;

export function getLearningLevelLabel(level: LearningLevel): string {
  if (level === "good") return "Tốt";
  if (level === "average") return "Cần củng cố";
  if (level === "weak") return "Yếu";
  if (level === "very_weak") return "Rất yếu";
  return "Chưa đủ bằng chứng";
}

export function getLearningAssessment(params: {
  correctRate: number;
  questionCount: number;
  responseCount: number;
}): LearningAssessment {
  const questionCount = Math.max(0, Math.floor(params.questionCount));
  const responseCount = Math.max(0, Math.floor(params.responseCount));
  const correctRate = Math.max(0, Math.min(100, params.correctRate));
  const evidenceLabel = `${questionCount} câu, ${responseCount} lượt trả lời`;

  if (
    questionCount < MIN_QUESTIONS_FOR_CLASSIFICATION ||
    responseCount < MIN_QUESTIONS_FOR_CLASSIFICATION
  ) {
    return {
      level: "no_data",
      levelLabel: "Chưa đủ bằng chứng",
      confidence: "insufficient",
      confidenceLabel: "Chưa đủ dữ liệu",
      evidenceLabel,
      eligible: false,
    };
  }

  const level: LearningLevel =
    correctRate >= 80
      ? "good"
      : correctRate >= 60
        ? "average"
        : correctRate >= 40
          ? "weak"
          : "very_weak";

  const confidence: EvidenceConfidence =
    questionCount >= 8 && responseCount >= 30
      ? "high"
      : questionCount >= 5 && responseCount >= 12
        ? "medium"
        : "low";

  return {
    level,
    levelLabel: getLearningLevelLabel(level),
    confidence,
    confidenceLabel:
      confidence === "high"
        ? "Tin cậy cao"
        : confidence === "medium"
          ? "Tin cậy vừa"
          : "Tin cậy thấp",
    evidenceLabel,
    eligible: true,
  };
}
