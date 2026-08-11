import { describe, expect, it } from "vitest";

import { getLearningAssessment } from "./learningAssessment";

describe("getLearningAssessment", () => {
  it("không kết luận năng lực khi có dưới ba câu hỏi", () => {
    const assessment = getLearningAssessment({
      correctRate: 0,
      questionCount: 2,
      responseCount: 40,
    });

    expect(assessment.level).toBe("no_data");
    expect(assessment.eligible).toBe(false);
    expect(assessment.confidence).toBe("insufficient");
  });

  it.each([
    [39, "very_weak"],
    [40, "weak"],
    [59, "weak"],
    [60, "average"],
    [79, "average"],
    [80, "good"],
  ] as const)("phân loại tỷ lệ %s thành %s", (correctRate, level) => {
    const assessment = getLearningAssessment({
      correctRate,
      questionCount: 5,
      responseCount: 20,
    });

    expect(assessment.level).toBe(level);
    expect(assessment.eligible).toBe(true);
  });

  it("nâng độ tin cậy khi có đủ câu hỏi và lượt trả lời", () => {
    expect(
      getLearningAssessment({
        correctRate: 75,
        questionCount: 3,
        responseCount: 10,
      }).confidence
    ).toBe("low");

    expect(
      getLearningAssessment({
        correctRate: 75,
        questionCount: 5,
        responseCount: 12,
      }).confidence
    ).toBe("medium");

    expect(
      getLearningAssessment({
        correctRate: 75,
        questionCount: 8,
        responseCount: 30,
      }).confidence
    ).toBe("high");
  });
});
