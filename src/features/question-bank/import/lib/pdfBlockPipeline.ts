import type {
  NormalizedPdfRegion,
  PdfGeometryLine,
  PdfQuestionRegion,
} from "./pdfGeometry";

export type PdfBlockKind =
  | "plain_text"
  | "formula"
  | "chemical_formula"
  | "table"
  | "code"
  | "figure"
  | "chart"
  | "diagram";

export type PdfDetectedBlock =
  NormalizedPdfRegion & {
    kind: PdfBlockKind;
    confidence: number;
    source:
      | "pdf_native"
      | "table_border"
      | "visual";
    text?: string;
    description?: string;
  };

type RenderedPdfPage = {
  pageNumber: number;
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
};

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function normalizeText(
  value: string
) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function classifyTextBlock(
  text: string
): {
  kind: PdfBlockKind;
  confidence: number;
} {
  const normalized =
    normalizeText(text);
  const codeSignals = [
    /\b(?:def|while|for|if|else|return|print|cout|cin|SELECT|INSERT|UPDATE|CREATE\s+TABLE)\b/u,
    /#include|<\/?[a-z][^>]*>|:=|\+\+|--|&&|\|\|/u,
    /[{;}].*[{;}]/u,
  ].filter((pattern) =>
    pattern.test(normalized)
  ).length;
  const chemistrySignals = [
    /(?:->|→|⇌|<=>)/u,
    /\b(?:Na|Cl|H2O|CO2|HCl|H2SO4|NaOH|NH3|CH3|C6H6)\b/u,
    /\b[A-Z][a-z]?\d*(?:\^?[+-])?\s*\+\s*[A-Z]/u,
  ].filter((pattern) =>
    pattern.test(normalized)
  ).length;
  const formulaSignals = [
    /\\(?:frac|sqrt|sum|int|lim|vec|overline|mathrm|ce)\b/u,
    /[=≠≤≥±×÷∞∑∫√λμσπΔ]/u,
    /[A-Za-z]\s*\^\s*[-+]?\d|\d\s*\^\s*[-+]?\d/u,
    /\d\s*[·.]\s*10\s*\^?\s*\d/u,
  ].filter((pattern) =>
    pattern.test(normalized)
  ).length;

  if (codeSignals >= 2) {
    return {
      kind: "code",
      confidence: Math.min(
        0.98,
        0.7 + codeSignals * 0.09
      ),
    };
  }

  if (
    chemistrySignals >= 2 ||
    /\\ce\{/u.test(normalized)
  ) {
    return {
      kind:
        "chemical_formula",
      confidence: Math.min(
        0.97,
        0.68 +
          chemistrySignals * 0.1
      ),
    };
  }

  if (formulaSignals >= 1) {
    return {
      kind: "formula",
      confidence: Math.min(
        0.96,
        0.66 + formulaSignals * 0.1
      ),
    };
  }

  return {
    kind: "plain_text",
    confidence: 0.9,
  };
}

export function classifyPdfNativeBlocks({
  questionRegions,
  lines,
  pages,
}: {
  questionRegions: PdfQuestionRegion[];
  lines: PdfGeometryLine[];
  pages: Array<{
    pageNumber: number;
    width: number;
    height: number;
  }>;
}): PdfDetectedBlock[] {
  const pageByNumber = new Map(
    pages.map((page) => [
      page.pageNumber,
      page,
    ])
  );

  return questionRegions.flatMap(
    (questionRegion) => {
      const page = pageByNumber.get(
        questionRegion.pageNumber
      );

      if (!page) {
        return [];
      }

      const bottom =
        questionRegion.y +
        questionRegion.height;

      return lines
        .filter(
          (line) =>
            line.pageNumber ===
              questionRegion.pageNumber &&
            line.y >=
              questionRegion.y &&
            line.y < bottom
        )
        .map((line) => {
          const classification =
            classifyTextBlock(
              line.text
            );

          return {
            sourceNumber:
              questionRegion.sourceNumber,
            pageNumber:
              line.pageNumber,
            x:
              (line.x / page.width) *
              1000,
            y:
              (line.y /
                page.height) *
              1000,
            width:
              (line.width /
                page.width) *
              1000,
            height:
              (line.height /
                page.height) *
              1000,
            ...classification,
            source:
              "pdf_native" as const,
            text: line.text,
          };
        });
    }
  );
}

function groupConsecutive(
  values: number[]
) {
  const groups: number[][] = [];

  values.forEach((value) => {
    const current =
      groups[groups.length - 1];

    if (
      current &&
      value -
        current[current.length - 1] <=
        2
    ) {
      current.push(value);
      return;
    }

    groups.push([value]);
  });

  return groups.map(
    (group) =>
      Math.round(
        group.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / group.length
      )
  );
}

function isDarkPixel(
  page: RenderedPdfPage,
  x: number,
  y: number
) {
  const offset =
    (y * page.width + x) *
    page.channels;
  const r = page.data[offset] ?? 255;
  const g =
    page.data[offset + 1] ?? r;
  const b =
    page.data[offset + 2] ?? r;
  const alpha =
    page.channels >= 4
      ? page.data[offset + 3] ??
        255
      : 255;

  return (
    alpha > 80 &&
    r + g + b < 420
  );
}

function hasDarkIntersection(
  page: RenderedPdfPage,
  x: number,
  y: number
) {
  for (
    let offsetY = -2;
    offsetY <= 2;
    offsetY += 1
  ) {
    for (
      let offsetX = -2;
      offsetX <= 2;
      offsetX += 1
    ) {
      const targetX = clamp(
        x + offsetX,
        0,
        page.width - 1
      );
      const targetY = clamp(
        y + offsetY,
        0,
        page.height - 1
      );

      if (
        isDarkPixel(
          page,
          targetX,
          targetY
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function getLongestDarkRun({
  page,
  start,
  end,
  fixed,
  axis,
}: {
  page: RenderedPdfPage;
  start: number;
  end: number;
  fixed: number;
  axis: "horizontal" | "vertical";
}) {
  let longest = 0;
  let current = 0;
  let gap = 0;

  for (
    let position = start;
    position < end;
    position += 1
  ) {
    const dark =
      axis === "horizontal"
        ? isDarkPixel(
            page,
            position,
            fixed
          )
        : isDarkPixel(
            page,
            fixed,
            position
          );

    if (dark) {
      current += gap + 1;
      gap = 0;
      longest = Math.max(
        longest,
        current
      );
      continue;
    }

    if (current > 0 && gap < 2) {
      gap += 1;
      continue;
    }

    current = 0;
    gap = 0;
  }

  return longest;
}

export function detectRuledTableBlocks({
  pages,
  questionRegions,
}: {
  pages: RenderedPdfPage[];
  questionRegions:
    NormalizedPdfRegion[];
}): PdfDetectedBlock[] {
  const pageByNumber = new Map(
    pages.map((page) => [
      page.pageNumber,
      page,
    ])
  );

  return questionRegions.flatMap(
    (region) => {
      const page = pageByNumber.get(
        region.pageNumber
      );

      if (!page) {
        return [];
      }

      const left = clamp(
        Math.floor(
          (region.x / 1000) *
            page.width
        ),
        0,
        page.width - 1
      );
      const top = clamp(
        Math.floor(
          (region.y / 1000) *
            page.height
        ),
        0,
        page.height - 1
      );
      const right = clamp(
        Math.ceil(
          ((region.x +
            region.width) /
            1000) *
            page.width
        ),
        left + 1,
        page.width
      );
      const bottom = clamp(
        Math.ceil(
          ((region.y +
            region.height) /
            1000) *
            page.height
        ),
        top + 1,
        page.height
      );
      const width = right - left;
      const height = bottom - top;

      if (
        width < 80 ||
        height < 60
      ) {
        return [];
      }

      const horizontal: number[] = [];
      const vertical: number[] = [];

      for (
        let y = top;
        y < bottom;
        y += 1
      ) {
        let dark = 0;

        for (
          let x = left;
          x < right;
          x += 2
        ) {
          if (
            isDarkPixel(page, x, y)
          ) {
            dark += 1;
          }
        }

        if (
          dark /
            Math.ceil(width / 2) >=
            0.16 &&
          getLongestDarkRun({
            page,
            start: left,
            end: right,
            fixed: y,
            axis: "horizontal",
          }) /
            width >=
            0.3
        ) {
          horizontal.push(y);
        }
      }

      for (
        let x = left;
        x < right;
        x += 1
      ) {
        let dark = 0;

        for (
          let y = top;
          y < bottom;
          y += 2
        ) {
          if (
            isDarkPixel(page, x, y)
          ) {
            dark += 1;
          }
        }

        if (
          dark /
            Math.ceil(height / 2) >=
            0.16 &&
          getLongestDarkRun({
            page,
            start: top,
            end: bottom,
            fixed: x,
            axis: "vertical",
          }) /
            height >=
            0.3
        ) {
          vertical.push(x);
        }
      }

      const horizontalLines =
        groupConsecutive(
          horizontal
        );
      const verticalLines =
        groupConsecutive(vertical);

      if (
        horizontalLines.length < 2 ||
        verticalLines.length < 2 ||
        horizontalLines.length +
          verticalLines.length <
          5
      ) {
        return [];
      }

      let intersections = 0;
      const possibleIntersections =
        horizontalLines.length *
        verticalLines.length;

      horizontalLines.forEach((y) => {
        verticalLines.forEach((x) => {
          if (
            hasDarkIntersection(
              page,
              x,
              y
            )
          ) {
            intersections += 1;
          }
        });
      });

      const intersectionRatio =
        intersections /
        Math.max(
          1,
          possibleIntersections
        );

      if (intersectionRatio < 0.75) {
        return [];
      }

      const borderLeft =
        verticalLines[0];
      const borderRight =
        verticalLines[
          verticalLines.length - 1
        ];
      const borderTop =
        horizontalLines[0];
      const borderBottom =
        horizontalLines[
          horizontalLines.length - 1
        ];
      const padding = Math.max(
        4,
        Math.round(
          Math.min(width, height) *
            0.015
        )
      );
      const cropLeft = clamp(
        borderLeft - padding,
        left,
        right
      );
      const cropTop = clamp(
        borderTop - padding,
        top,
        bottom
      );
      const cropRight = clamp(
        borderRight + padding,
        cropLeft + 1,
        right
      );
      const cropBottom = clamp(
        borderBottom + padding,
        cropTop + 1,
        bottom
      );

      return [
        {
          sourceNumber:
            region.sourceNumber,
          pageNumber:
            region.pageNumber,
          x:
            (cropLeft /
              page.width) *
            1000,
          y:
            (cropTop /
              page.height) *
            1000,
          width:
            ((cropRight - cropLeft) /
              page.width) *
            1000,
          height:
            ((cropBottom - cropTop) /
              page.height) *
            1000,
          kind: "table",
          confidence: Math.min(
            0.99,
            0.9 +
              intersectionRatio *
                0.09
          ),
          source: "table_border",
          description:
            "Bảng có đường kẻ được phát hiện từ đường viền ngoài",
        },
      ];
    }
  );
}

export function shouldRouteToFormulaOcr({
  blocks,
  subject,
  hasUnreadableContent,
}: {
  blocks: PdfDetectedBlock[];
  subject: string;
  hasUnreadableContent: boolean;
}) {
  const formulaConfidence =
    blocks.reduce(
      (highest, block) =>
        block.kind === "formula" ||
        block.kind ===
          "chemical_formula"
          ? Math.max(
              highest,
              block.confidence
            )
          : highest,
      0
    );
  const subjectPrior =
    /^(?:toán|vật lý|vật lí|hóa học|hoá học)$/iu.test(
      subject.trim()
    )
      ? 0.18
      : 0;
  const unreadableSignal =
    hasUnreadableContent
      ? 0.55
      : 0;

  return (
    formulaConfidence * 0.75 +
      subjectPrior +
      unreadableSignal >=
    0.62
  );
}
