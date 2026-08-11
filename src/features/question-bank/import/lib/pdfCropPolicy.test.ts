import {
  describe,
  expect,
  it,
} from "vitest";

import {
  hasExplicitPdfVisualCue,
  matchPdfQuestionRegions,
  shouldRequestPdfVisualDetection,
  verifyPdfCropCandidate,
} from "./pdfCropPolicy";

describe("PDF precision-first crop policy", () => {
  it("does not request a crop for a text-only Informatics question", () => {
    expect(
      shouldRequestPdfVisualDetection({
        content:
          "Khi đọc một bài viết có thể là tin giả trên mạng xã hội, hành động nào thể hiện tính nhân văn?",
      })
    ).toBe(false);
  });

  it("requests visual detection only for an explicit visual cue", () => {
    expect(
      hasExplicitPdfVisualCue(
        "Cho bảng tần số ghép nhóm như sau."
      )
    ).toBe(true);
    expect(
      shouldRequestPdfVisualDetection({
        content:
          "Quan sát hình bên và chọn đáp án đúng.",
      })
    ).toBe(true);
  });

  it("matches repeated printed numbers by content fingerprint", () => {
    const matches =
      matchPdfQuestionRegions({
        questions: [
          {
            sourceNumber: 3,
            content:
              "Một người chia thời lượng cuộc gọi điện thoại trong một tuần.",
          },
        ],
        regions: [
          {
            sourceNumber: 2,
            printedNumber: 3,
            pageNumber: 1,
            x: 0,
            y: 100,
            width: 1000,
            height: 300,
            nativeText:
              "Câu 3: Cho hình chóp và mặt phẳng trong không gian.",
          },
          {
            sourceNumber: 18,
            printedNumber: 3,
            pageNumber: 8,
            x: 0,
            y: 200,
            width: 1000,
            height: 260,
            nativeText:
              "Câu 3: Một người chia thời lượng cuộc gọi điện thoại trong một tuần.",
          },
        ],
      });

    expect(matches).toHaveLength(1);
    expect(
      matches[0].originalSourceNumber
    ).toBe(18);
  });

  it("rejects an ambiguous repeated number instead of guessing", () => {
    const matches =
      matchPdfQuestionRegions({
        questions: [
          {
            sourceNumber: 2,
            content:
              "Nội dung không có trong text layer.",
          },
        ],
        regions: [
          {
            sourceNumber: 1,
            printedNumber: 2,
            pageNumber: 1,
            x: 0,
            y: 0,
            width: 1000,
            height: 400,
          },
          {
            sourceNumber: 20,
            printedNumber: 2,
            pageNumber: 9,
            x: 0,
            y: 0,
            width: 1000,
            height: 400,
          },
        ],
      });

    expect(matches).toEqual([]);
  });

  it("rejects a crop that crosses the matched question boundary", () => {
    expect(
      verifyPdfCropCandidate({
        questionRegion: {
          sourceNumber: 3,
          originalSourceNumber: 8,
          printedNumber: 3,
          matchConfidence: 0.97,
          pageNumber: 2,
          x: 0,
          y: 300,
          width: 1000,
          height: 250,
        },
        candidate: {
          sourceNumber: 3,
          pageNumber: 2,
          x: 100,
          y: 220,
          width: 800,
          height: 280,
          confidence: 0.98,
          evidence:
            "explicit_visual_cue",
        },
      })
    ).toBe(false);
  });
});
