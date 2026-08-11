import type {
  NormalizedPdfRegion,
} from "./pdfGeometry";

export type PdfCropEvidence =
  | "explicit_visual_cue"
  | "pdf_native_image"
  | "table_border"
  | "formula_block"
  | "option_block";

export type PdfQuestionIdentityInput = {
  sourceNumber: number;
  content: string;
};

export type PdfMatchedQuestionRegion =
  NormalizedPdfRegion & {
    originalSourceNumber: number;
    matchConfidence: number;
  };

export type PdfCropCandidate = {
  sourceNumber: number;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  evidence: PdfCropEvidence;
};

const VISUAL_CUE_PATTERN =
  /(?:\bhình\s+(?:bên|sau|dưới|trên|vẽ|minh\s*họa)|\b(?:quan\s*sát|dựa\s+vào)\s+(?:hình|bảng|biểu\s*đồ|đồ\s*thị|sơ\s*đồ)|\b(?:bảng|biểu\s*đồ|đồ\s*thị|sơ\s*đồ)\s+(?:sau|dưới|bên|trên)|\bcho\s+(?:bảng|biểu\s*đồ|đồ\s*thị|sơ\s*đồ)\b)/iu;

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

function fingerprintTokens(
  value: string
) {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(
        /\bcau\s*\d{1,4}\s*[.:)]?/gu,
        " "
      )
      .replace(
        /\b[a-d]\s*[.)]\s*/gu,
        " "
      )
      .match(/[a-z0-9]{2,}/gu) ?? []
  );
}

export function getPdfContentFingerprintOverlap(
  left: string,
  right: string
) {
  const leftTokens =
    fingerprintTokens(left);
  const rightTokens =
    fingerprintTokens(right);

  if (
    leftTokens.size === 0 ||
    rightTokens.size === 0
  ) {
    return 0;
  }

  let shared = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  });

  return (
    shared /
    Math.max(
      1,
      Math.min(
        leftTokens.size,
        rightTokens.size
      )
    )
  );
}

export function matchPdfQuestionRegions({
  questions,
  regions,
}: {
  questions: PdfQuestionIdentityInput[];
  regions: NormalizedPdfRegion[];
}): PdfMatchedQuestionRegion[] {
  const usedRegionIndexes =
    new Set<number>();
  const matches:
    PdfMatchedQuestionRegion[] = [];
  const questionNumberCounts =
    new Map<number, number>();

  questions.forEach((question) => {
    questionNumberCounts.set(
      question.sourceNumber,
      (questionNumberCounts.get(
        question.sourceNumber
      ) ?? 0) + 1
    );
  });

  questions.forEach((question) => {
    if (
      (questionNumberCounts.get(
        question.sourceNumber
      ) ?? 0) > 1
    ) {
      return;
    }

    const exactCandidates =
      regions
        .map((region, index) => ({
          region,
          index,
          overlap:
            getPdfContentFingerprintOverlap(
              question.content,
              region.nativeText ?? ""
            ),
        }))
        .filter(
          ({ region, index }) =>
            !usedRegionIndexes.has(
              index
            ) &&
            region.printedNumber ===
              question.sourceNumber
        )
        .sort(
          (left, right) =>
            right.overlap -
            left.overlap
        );

    if (
      exactCandidates.length === 0
    ) {
      return;
    }

    const best =
      exactCandidates[0];
    const numberIsUnique =
      exactCandidates.length === 1;
    const secondOverlap =
      exactCandidates[1]
        ?.overlap ?? 0;
    const isDistinctDuplicate =
      best.overlap >= 0.2 &&
      best.overlap -
        secondOverlap >=
        0.08;

    if (
      !numberIsUnique &&
      !isDistinctDuplicate
    ) {
      return;
    }

    const matchConfidence =
      numberIsUnique
        ? clamp(
            0.84 +
              best.overlap *
                0.16,
            0,
            1
          )
        : clamp(
            0.72 +
              best.overlap *
                0.28,
            0,
            1
          );

    if (matchConfidence < 0.8) {
      return;
    }

    usedRegionIndexes.add(
      best.index
    );
    matches.push({
      ...best.region,
      sourceNumber:
        question.sourceNumber,
      originalSourceNumber:
        best.region.sourceNumber,
      matchConfidence,
    });
  });

  return matches;
}

export function hasExplicitPdfVisualCue(
  content: string
) {
  return VISUAL_CUE_PATTERN.test(
    content
  );
}

export function shouldRequestPdfVisualDetection({
  content,
  imageHint,
  hasNativeImage = false,
}: {
  content: string;
  imageHint?: string;
  hasNativeImage?: boolean;
}) {
  return Boolean(
    imageHint?.trim() ||
      hasNativeImage ||
      hasExplicitPdfVisualCue(content)
  );
}

export function verifyPdfCropCandidate({
  candidate,
  questionRegion,
}: {
  candidate: PdfCropCandidate;
  questionRegion:
    PdfMatchedQuestionRegion;
}) {
  if (
    questionRegion.matchConfidence <
      0.8 ||
    candidate.sourceNumber !==
      questionRegion.sourceNumber ||
    candidate.pageNumber !==
      questionRegion.pageNumber
  ) {
    return false;
  }

  const minimumConfidence =
    candidate.evidence ===
    "table_border"
      ? 0.94
      : candidate.evidence ===
          "pdf_native_image"
        ? 0.9
        : 0.92;

  if (
    candidate.confidence <
    minimumConfidence
  ) {
    return false;
  }

  const questionRight =
    questionRegion.x +
    questionRegion.width;
  const questionBottom =
    questionRegion.y +
    questionRegion.height;
  const candidateRight =
    candidate.x +
    candidate.width;
  const candidateBottom =
    candidate.y +
    candidate.height;
  const tolerance = 8;

  if (
    candidate.x <
      questionRegion.x -
        tolerance ||
    candidate.y <
      questionRegion.y -
        tolerance ||
    candidateRight >
      questionRight +
        tolerance ||
    candidateBottom >
      questionBottom +
        tolerance
  ) {
    return false;
  }

  const areaRatio =
    (candidate.width *
      candidate.height) /
    Math.max(
      1,
      questionRegion.width *
        questionRegion.height
    );

  if (
    candidate.evidence ===
      "explicit_visual_cue" &&
    areaRatio > 0.72
  ) {
    return false;
  }

  return (
    candidate.width >= 12 &&
    candidate.height >= 12
  );
}
