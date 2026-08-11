import {
  describe,
  expect,
  it,
} from "vitest";

import {
  constrainPdfRegionToQuestion,
  detectPdfOptionRegions,
  detectPdfQuestionRegions,
  isMeaningfulImportedText,
  normalizePdfQuestionRegion,
} from "./pdfGeometry";

describe("PDF geometry", () => {
  it("ends a crop before the next question anchor", () => {
    const pages = [
      {
        pageNumber: 1,
        width: 600,
        height: 800,
      },
    ];
    const regions =
      detectPdfQuestionRegions({
        pages,
        lines: [
          {
            pageNumber: 1,
            text: "Câu 5: Cho hàm số",
            x: 20,
            y: 100,
            width: 220,
            height: 18,
          },
          {
            pageNumber: 1,
            text: "Câu 6. Cấp số cộng",
            x: 20,
            y: 430,
            width: 210,
            height: 18,
          },
        ],
      });

    expect(regions).toHaveLength(2);
    expect(regions[0].sourceNumber).toBe(1);
    expect(regions[0].printedNumber).toBe(5);
    expect(
      regions[0].y +
        regions[0].height
    ).toBeLessThan(430);
  });

  it("clips an AI region to the owning question", () => {
    const page = {
      pageNumber: 1,
      width: 600,
      height: 800,
    };
    const question =
      normalizePdfQuestionRegion(
        {
          sourceNumber: 2,
          printedNumber: 9,
          pageNumber: 1,
          x: 0,
          y: 200,
          width: 600,
          height: 240,
        },
        page
      );
    const clipped =
      constrainPdfRegionToQuestion(
        {
          sourceNumber: 2,
          pageNumber: 1,
          x: 50,
          y: 230,
          width: 900,
          height: 500,
        },
        question
      );

    expect(clipped.y).toBeGreaterThanOrEqual(
      question.y
    );
    expect(
      clipped.y + clipped.height
    ).toBeLessThanOrEqual(
      question.y +
        question.height
    );
  });

  it("splits compact horizontal A-D options into separate regions", () => {
    const regions =
      detectPdfOptionRegions({
        questionRegions: [
          {
            sourceNumber: 1,
            printedNumber: 12,
            pageNumber: 1,
            x: 0,
            y: 80,
            width: 800,
            height: 180,
          },
        ],
        lines: [
          {
            pageNumber: 1,
            text: "A. 15.10^5 J. B. 17.10^5 J. C. 16.10^5 J. D. 17,5.10^5 J.",
            x: 100,
            y: 180,
            width: 650,
            height: 18,
          },
        ],
      });

    expect(
      regions.map(
        (region) =>
          region.optionId
      )
    ).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(regions[0].width).toBeLessThan(
      300
    );
    expect(
      regions[0].x +
        regions[0].width
    ).toBeLessThanOrEqual(
      regions[1].x
    );
  });
});

describe("imported formula validation", () => {
  it.each([".", "-", "()", "\\(\\)", "  "])(
    "rejects placeholder %s",
    (value) => {
      expect(
        isMeaningfulImportedText(
          value
        )
      ).toBe(false);
    }
  );

  it.each([
    "x=-2",
    "5",
    "x",
    "Na^+ + e^- \\rightarrow Na",
    "\\frac{3}{2}kT",
    "\\ce{2Cl- -> Cl2 + 2e-}",
  ])(
    "accepts semantic content %s",
    (value) => {
      expect(
        isMeaningfulImportedText(
          value
        )
      ).toBe(true);
    }
  );
});
