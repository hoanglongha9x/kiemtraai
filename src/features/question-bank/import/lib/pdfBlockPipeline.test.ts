import {
  describe,
  expect,
  it,
} from "vitest";

import {
  classifyPdfNativeBlocks,
  detectRuledTableBlocks,
  shouldRouteToFormulaOcr,
} from "./pdfBlockPipeline";

describe("PDF block classifier", () => {
  it("classifies code independently of the subject", () => {
    const blocks =
      classifyPdfNativeBlocks({
        pages: [
          {
            pageNumber: 1,
            width: 600,
            height: 800,
          },
        ],
        questionRegions: [
          {
            sourceNumber: 1,
            printedNumber: 2,
            pageNumber: 1,
            x: 0,
            y: 50,
            width: 600,
            height: 300,
          },
        ],
        lines: [
          {
            pageNumber: 1,
            text:
              "while (i<5) { s+=i*(i+1); i++; }",
            x: 40,
            y: 120,
            width: 300,
            height: 16,
          },
        ],
      });

    expect(blocks[0].kind).toBe(
      "code"
    );
  });

  it("uses subject only as a prior for formula routing", () => {
    expect(
      shouldRouteToFormulaOcr({
        blocks: [],
        subject: "Toán",
        hasUnreadableContent:
          false,
      })
    ).toBe(false);
    expect(
      shouldRouteToFormulaOcr({
        blocks: [],
        subject: "Tin học",
        hasUnreadableContent:
          true,
      })
    ).toBe(false);
    expect(
      shouldRouteToFormulaOcr({
        blocks: [],
        subject: "Toán",
        hasUnreadableContent:
          true,
      })
    ).toBe(true);
  });
});

describe("ruled table detector", () => {
  it("finds the outer border without clipping the first column", () => {
    const width = 120;
    const height = 100;
    const data = new Uint8Array(
      width * height * 4
    ).fill(255);
    const setDark = (
      x: number,
      y: number
    ) => {
      const offset =
        (y * width + x) * 4;
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 255;
    };

    [20, 60, 100].forEach((x) => {
      for (
        let y = 20;
        y <= 80;
        y += 1
      ) {
        setDark(x, y);
      }
    });
    [20, 50, 80].forEach((y) => {
      for (
        let x = 20;
        x <= 100;
        x += 1
      ) {
        setDark(x, y);
      }
    });

    const blocks =
      detectRuledTableBlocks({
        pages: [
          {
            pageNumber: 1,
            width,
            height,
            channels: 4,
            data,
          },
        ],
        questionRegions: [
          {
            sourceNumber: 1,
            pageNumber: 1,
            x: 0,
            y: 0,
            width: 1000,
            height: 1000,
          },
        ],
      });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe(
      "table"
    );
    expect(blocks[0].x).toBeLessThan(
      (20 / width) * 1000
    );
  });
});
