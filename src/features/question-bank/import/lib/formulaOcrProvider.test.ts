import {
  describe,
  expect,
  it,
} from "vitest";

import {
  selectFormulaOcrProvider,
} from "./formulaOcrProvider";

describe("formula OCR provider selection", () => {
  it("prefers a self-hosted PP-FormulaNet endpoint", () => {
    expect(
      selectFormulaOcrProvider({
        ppFormulaOcrUrl:
          "http://formula-ocr.local/predict",
        mathpixAppId: "id",
        mathpixAppKey: "key",
      })
    ).toBe("pp-formulanet");
  });

  it("uses Mathpix only with both credentials", () => {
    expect(
      selectFormulaOcrProvider({
        mathpixAppId: "id",
        mathpixAppKey: "key",
      })
    ).toBe("mathpix");
    expect(
      selectFormulaOcrProvider({
        mathpixAppId: "id",
      })
    ).toBe("none");
  });
});
