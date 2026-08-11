export type PdfGeometryLine = {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPageGeometry = {
  pageNumber: number;
  width: number;
  height: number;
};

export type PdfQuestionRegion = {
  sourceNumber: number;
  printedNumber: number;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedPdfRegion = {
  sourceNumber: number;
  printedNumber?: number;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nativeText?: string;
};

export type PdfOptionRegion =
  PdfQuestionRegion & {
    optionId:
      | "A"
      | "B"
      | "C"
      | "D";
  };

export type NormalizedPdfOptionRegion =
  NormalizedPdfRegion & {
    optionId:
      | "A"
      | "B"
      | "C"
      | "D";
  };

const QUESTION_ANCHOR_PATTERN =
  /^\s*c(?:a|â)u\s*(\d{1,4})\s*[.:)]/iu;

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

export function detectPdfQuestionRegions({
  pages,
  lines,
}: {
  pages: PdfPageGeometry[];
  lines: PdfGeometryLine[];
}): PdfQuestionRegion[] {
  const pageByNumber = new Map(
    pages.map((page) => [
      page.pageNumber,
      page,
    ])
  );
  const anchors = lines
    .map((line) => {
      const match =
        QUESTION_ANCHOR_PATTERN.exec(
          line.text
        );

      return match
        ? {
            ...line,
            printedNumber: Number(
              match[1]
            ),
          }
        : null;
    })
    .filter(
      (
        anchor
      ): anchor is PdfGeometryLine & {
        printedNumber: number;
      } => Boolean(anchor)
    )
    .sort(
      (left, right) =>
        left.pageNumber -
          right.pageNumber ||
        left.y - right.y ||
        left.x - right.x
    );

  return anchors.flatMap(
    (anchor, index) => {
      const page = pageByNumber.get(
        anchor.pageNumber
      );

      if (!page) {
        return [];
      }

      const nextAnchor =
        anchors[index + 1];
      const top = clamp(
        anchor.y -
          Math.max(
            4,
            anchor.height * 0.35
          ),
        0,
        page.height
      );
      const nextTop =
        nextAnchor?.pageNumber ===
        anchor.pageNumber
          ? nextAnchor.y -
            Math.max(
              4,
              nextAnchor.height * 0.45
            )
          : page.height;
      const bottom = clamp(
        nextTop,
        top + 1,
        page.height
      );

      return [
        {
          sourceNumber: index + 1,
          printedNumber:
            anchor.printedNumber,
          pageNumber:
            anchor.pageNumber,
          x: 0,
          y: top,
          width: page.width,
          height: bottom - top,
        },
      ];
    }
  );
}

export function normalizePdfQuestionRegion(
  region: PdfQuestionRegion,
  page: PdfPageGeometry
): NormalizedPdfRegion {
  return {
    sourceNumber:
      region.sourceNumber,
    printedNumber:
      region.printedNumber,
    pageNumber:
      region.pageNumber,
    x: clamp(
      (region.x / page.width) *
        1000,
      0,
      1000
    ),
    y: clamp(
      (region.y / page.height) *
        1000,
      0,
      1000
    ),
    width: clamp(
      (region.width / page.width) *
        1000,
      0,
      1000
    ),
    height: clamp(
      (region.height /
        page.height) *
        1000,
      0,
      1000
    ),
  };
}

export function detectPdfOptionRegions({
  questionRegions,
  lines,
}: {
  questionRegions: PdfQuestionRegion[];
  lines: PdfGeometryLine[];
}): PdfOptionRegion[] {
  return questionRegions.flatMap(
    (questionRegion) => {
      const questionBottom =
        questionRegion.y +
        questionRegion.height;
      const questionRight =
        questionRegion.x +
        questionRegion.width;
      const anchors = lines
        .filter(
          (line) =>
            line.pageNumber ===
              questionRegion.pageNumber &&
            line.y >=
              questionRegion.y &&
            line.y < questionBottom
        )
        .flatMap((line) => {
          const pattern =
            /(?:^|\s)([A-Da-d])\s*[.)]\s*/g;
          const matches: Array<{
            optionId:
              | "A"
              | "B"
              | "C"
              | "D";
            x: number;
            y: number;
            height: number;
          }> = [];
          let match:
            RegExpExecArray | null;

          while (
            (match = pattern.exec(
              line.text
            ))
          ) {
            const letterOffset =
              match[0]
                .toUpperCase()
                .lastIndexOf(
                  match[1].toUpperCase()
                );
            const textOffset =
              match.index +
              Math.max(
                0,
                letterOffset
              );
            const ratio = clamp(
              textOffset /
                Math.max(
                  1,
                  line.text.length
                ),
              0,
              1
            );

            matches.push({
              optionId:
                match[1].toUpperCase() as
                  | "A"
                  | "B"
                  | "C"
                  | "D",
              x:
                line.x +
                line.width * ratio,
              y: line.y,
              height:
                line.height,
            });
          }

          return matches;
        })
        .sort(
          (left, right) =>
            left.y - right.y ||
            left.x - right.x
        );
      const uniqueAnchors = [
        ...new Map(
          anchors.map((anchor) => [
            anchor.optionId,
            anchor,
          ])
        ).values(),
      ].sort(
        (left, right) =>
          left.y - right.y ||
          left.x - right.x
      );

      if (
        uniqueAnchors.length < 2
      ) {
        return [];
      }

      return uniqueAnchors.flatMap(
        (anchor) => {
          const rowTolerance =
            Math.max(
              5,
              anchor.height * 0.9
            );
          const nextOnRow =
            uniqueAnchors.find(
              (candidate) =>
                candidate.x >
                  anchor.x &&
                Math.abs(
                  candidate.y -
                    anchor.y
                ) <= rowTolerance
            );
          const nextRow =
            uniqueAnchors.find(
              (candidate) =>
                candidate.y >
                  anchor.y +
                    rowTolerance
            );
          const left = clamp(
            anchor.x -
              anchor.height * 0.25,
            questionRegion.x,
            questionRight
          );
          const top = clamp(
            anchor.y -
              anchor.height * 0.45,
            questionRegion.y,
            questionBottom
          );
          const right = clamp(
            nextOnRow
              ? nextOnRow.x -
                  anchor.height * 0.35
              : questionRight,
            left,
            questionRight
          );
          const bottom = clamp(
            nextRow
              ? nextRow.y -
                  anchor.height * 0.35
              : anchor.y +
                  anchor.height * 3.25,
            top,
            questionBottom
          );

          if (
            right - left < 12 ||
            bottom - top < 8
          ) {
            return [];
          }

          return [
            {
              ...questionRegion,
              optionId:
                anchor.optionId,
              x: left,
              y: top,
              width:
                right - left,
              height:
                bottom - top,
            },
          ];
        }
      );
    }
  );
}

export function constrainPdfRegionToQuestion<
  T extends NormalizedPdfRegion,
>(
  region: T,
  questionRegion:
    NormalizedPdfRegion,
  padding = 6
): T {
  if (
    region.pageNumber !==
    questionRegion.pageNumber
  ) {
    return {
      ...region,
      ...questionRegion,
      sourceNumber:
        region.sourceNumber,
    };
  }

  const questionLeft =
    questionRegion.x;
  const questionTop =
    questionRegion.y;
  const questionRight =
    questionRegion.x +
    questionRegion.width;
  const questionBottom =
    questionRegion.y +
    questionRegion.height;
  const left = clamp(
    region.x - padding,
    questionLeft,
    questionRight
  );
  const top = clamp(
    region.y - padding,
    questionTop,
    questionBottom
  );
  const right = clamp(
    region.x +
      region.width +
      padding,
    left,
    questionRight
  );
  const bottom = clamp(
    region.y +
      region.height +
      padding,
    top,
    questionBottom
  );

  if (
    right - left < 8 ||
    bottom - top < 8
  ) {
    return {
      ...region,
      ...questionRegion,
      sourceNumber:
        region.sourceNumber,
    };
  }

  return {
    ...region,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function isMeaningfulImportedText(
  value: unknown
): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value
    .replace(/\\(?:left|right|displaystyle)/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!normalized) {
    return false;
  }

  if (/\\(?:frac|sqrt|ce|mathrm|text|overline|vec|sum|int|lim|begin)\b/u.test(normalized)) {
    return true;
  }

  const semanticCharacters =
    normalized.match(/[\p{L}\p{N}]/gu)
      ?.length ?? 0;
  const mathOperators =
    normalized.match(/[∞∑∫√]/gu)
      ?.length ?? 0;

  return (
    semanticCharacters >= 1 ||
    mathOperators >= 1
  );
}
