import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  QuestionCardData,
} from "../../../components/question-bank/types";

import {
  validateQuestionInput,
} from "./validateQuestionInput";

const question:
  QuestionCardData = {
  id: "physics-12",
  type: "single_choice",
  content:
    "Nhiệt lượng cần cung cấp là",
  subject: "Vật lý",
  grade: "12",
  difficulty: "medium",
  cognitiveLevel:
    "understanding",
  updatedAt:
    "2026-08-09T00:00:00.000Z",
  options: [
    {
      id: "A",
      content: "",
      imageId: "image-a",
      imageUrl:
        "https://example.com/a.png",
    },
    {
      id: "B",
      content:
        "\\(17\\cdot10^5\\,\\mathrm{J}\\)",
    },
    {
      id: "C",
      content:
        "\\(16\\cdot10^5\\,\\mathrm{J}\\)",
    },
    {
      id: "D",
      content:
        "\\(17{,}5\\cdot10^5\\,\\mathrm{J}\\)",
    },
  ],
  correctOptionId: "A",
};

describe("option image fallback", () => {
  it("rejects an image-only option", () => {
    expect(
      validateQuestionInput(
        question
      )
    ).toEqual({
      valid: false,
      errors: [
        "Phương án phải có nội dung; ảnh chỉ được gắn vào phần câu hỏi.",
      ],
    });
  });
});
