import {
  existsSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  NextResponse,
} from "next/server";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  normalizeSubjectName,
} from "@/lib/subjects";

import {
  isApiError,
} from "@/server/http/apiError";

import {
  ImportFileError,
} from "@/features/question-bank/import/lib/importFileValidation";

import {
  IMPORT_PROMPT_CONTENT,
} from "@/features/question-bank/import/lib/importPrompt";

import {
  parseImportedQuestions,
} from "@/features/question-bank/import/lib/parseImportedQuestions";

import {
  constrainPdfRegionToQuestion,
  detectPdfOptionRegions,
  detectPdfQuestionRegions,
  isMeaningfulImportedText,
  normalizePdfQuestionRegion,
  type NormalizedPdfRegion,
  type NormalizedPdfOptionRegion,
  type PdfGeometryLine,
  type PdfPageGeometry,
} from "@/features/question-bank/import/lib/pdfGeometry";

import {
  classifyPdfNativeBlocks,
  detectRuledTableBlocks,
  shouldRouteToFormulaOcr,
  type PdfDetectedBlock,
} from "@/features/question-bank/import/lib/pdfBlockPipeline";

import {
  recognizeFormulaImages,
} from "@/features/question-bank/import/lib/formulaOcrProvider";

import {
  hasExplicitPdfVisualCue,
  matchPdfQuestionRegions,
  shouldRequestPdfVisualDetection,
  verifyPdfCropCandidate,
  type PdfCropEvidence,
  type PdfMatchedQuestionRegion,
} from "@/features/question-bank/import/lib/pdfCropPolicy";

import {
  parseImportFile,
} from "@/features/question-bank/import/parsers/parseImportFile";

import type {
  ImportAnswerSource,
  ImportQuestionsErrorResponse,
  ImportQuestionsResponse,
  ParsedImportQuestion,
} from "@/features/question-bank/import/types";

import type {
  DocxImportAsset,
} from "@/features/question-bank/import/parsers/parseDocxFile";

import type {
  QuestionContentBlock,
} from "@/types/question-content";

export const runtime =
  "nodejs";

const GEMINI_API_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_MODEL =
  "gemini-2.5-flash";

const MAX_AI_SOURCE_CHARS =
  70000;

function isEnabledEnvFlag(
  value: string | undefined
) {
  return /^(?:1|true|yes|on)$/i.test(
    value?.trim() ?? ""
  );
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type DuplicateCheckResult = {
  questions:
    ParsedImportQuestion[];
  warnings:
    ImportQuestionsResponse["warnings"];
};

type PdfPageImage = {
  pageNumber: number;
  width: number;
  height: number;
  pngBuffer: Buffer;
  base64: string;
};

type PdfGeometryResult = {
  pages: PdfPageGeometry[];
  regions: NormalizedPdfRegion[];
  optionRegions:
    NormalizedPdfOptionRegion[];
  blocks: PdfDetectedBlock[];
};

type PdfImageRegion = {
  sourceNumber: number;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  evidence: PdfCropEvidence;
  description?: string;
};

type PdfImageHintQuestion = {
  sourceNumber: number;
  content: string;
  imageHint: string;
};

type PdfFormulaRepair = {
  sourceNumber: number;
  confidence: number;
  visualFallbackRecommended?: boolean;
  content?: string;
  options?: Array<{
    id: "A" | "B" | "C" | "D";
    content: string;
  }>;
  statements?: Array<{
    id: "A" | "B" | "C" | "D";
    content: string;
  }>;
  acceptedAnswers?: string[];
};

type PdfOptionFormulaRepair = {
  sourceNumber: number;
  optionId:
    | "A"
    | "B"
    | "C"
    | "D";
  content: string;
  confidence: number;
  visualFallbackRecommended?: boolean;
};

type PdfOptionCrop = {
  sourceNumber: number;
  optionId:
    | "A"
    | "B"
    | "C"
    | "D";
  buffer: Buffer;
};

type PdfTextColor = {
  key: string;
  known: boolean;
  r: number;
  g: number;
  b: number;
};

type PdfTextSpan = {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: PdfTextColor;
};

type PdfTextLine = {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  spans: PdfTextSpan[];
};

type PdfColorAnswerResult = {
  sourceNumber: number;
  questionType:
    | "single_choice"
    | "true_false_group";
  answers:
    Partial<Record<"A" | "B" | "C" | "D", boolean>>;
  answerSource:
    ImportAnswerSource;
  needsManualReview: boolean;
  reviewReason?: string;
};

type PdfColorQuestionCandidate = {
  sourceNumber: number;
  questionType:
    PdfColorAnswerResult["questionType"];
  optionLines: Map<
    "A" | "B" | "C" | "D",
    PdfTextLine[]
  >;
};

type PdfMutableColorQuestionCandidate =
  PdfColorQuestionCandidate & {
    currentOption:
      | "A"
      | "B"
      | "C"
      | "D"
      | null;
  };

type PdfColorSectionType =
  | PdfColorAnswerResult["questionType"]
  | "short_answer";

type PdfVisualPage = {
  pageNumber: number;
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
  data: Uint8ClampedArray;
};

type PdfVisualColorResult = {
  known: boolean;
  isColored: boolean;
  coloredPixels: number;
  nonWhitePixels: number;
};

type AppsScriptUploadResponse = {
  success?: boolean;
  message?: string;
  data?: {
    fileId?: string;
    imageUrl?: string;
    mimeType?: string;
    size?: number;
  };
};

const ENABLE_PDF_IMAGE_AUTO_ATTACH =
  process.env
    .PDF_IMPORT_AUTO_ATTACH_IMAGES ===
  undefined
    ? true
    : isEnabledEnvFlag(
        process.env
          .PDF_IMPORT_AUTO_ATTACH_IMAGES
      );

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json<
    ImportQuestionsErrorResponse
  >(
    {
      message,
    },
    {
      status,
    }
  );
}

function getImportErrorResponse(
  error: unknown
) {
  if (isApiError(error)) {
    return errorResponse(
      error.message,
      error.statusCode
    );
  }

  if (
    error instanceof
    ImportFileError
  ) {
    return errorResponse(
      error.message,
      error.status
    );
  }

  console.error(
    "Question import error:",
    error
  );

  return errorResponse(
    "Không thể xử lý file. Hãy kiểm tra lại cấu trúc tài liệu.",
    500
  );
}

function stripCodeFence(
  text: string
) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(
      /^```(?:txt|text|json)?\s*/i,
      ""
    )
    .replace(/```\s*$/i, "")
    .trim();
}

function extractJsonArrayText(
  text: string
) {
  const cleaned =
    stripCodeFence(text);

  const firstIndex =
    cleaned.indexOf("[");
  const lastIndex =
    cleaned.lastIndexOf("]");

  if (
    firstIndex === -1 ||
    lastIndex === -1 ||
    lastIndex <= firstIndex
  ) {
    return "[]";
  }

  return cleaned.slice(
    firstIndex,
    lastIndex + 1
  );
}

function getGeminiErrorMessage(
  data: GeminiResponse,
  fallback: string
) {
  const message =
    data.error?.message?.trim();

  if (!message) {
    return fallback;
  }

  if (
    /quota|rate[-\s]?limit|free_tier|retry/i.test(
      message
    )
  ) {
    return "Gemini đang hết quota hoặc bị giới hạn tạm thời. Hãy chờ một lát rồi thử lại, hoặc cấu hình API key có quota cao hơn.";
  }

  return message;
}

function clampNumber(
  value: unknown,
  min: number,
  max: number
) {
  const numericValue =
    typeof value ===
    "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return min;
  }

  return Math.min(
    max,
    Math.max(
      min,
      numericValue
    )
  );
}

function removeImageHintLines(
  content: string
) {
  return content
    .split("\n")
    .filter(
      (line) =>
        !/^\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa/i.test(
          line
        )
    )
    .join("\n")
    .trim();
}

function extractImageHint(
  content: string
) {
  const match =
    content.match(
      /^\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa\s*-\s*([^\]]+)\]/im
    );

  return match?.[1]
    ?.trim() ?? "";
}

function stripQuestionImageHintsFromImportQuestion(
  item: ParsedImportQuestion
): ParsedImportQuestion {
  const question =
    item.question;
  const cleanContent =
    removeImageHintLines(
      question.content
    ) ||
    question.content;

  return {
    ...item,
    question: {
      ...question,
      content:
        cleanContent,
      contentBlocks:
        question.contentBlocks?.map(
          (block) =>
            block.type === "text"
              ? {
                  ...block,
                  content:
                    removeImageHintLines(
                      block.content
                    ) ||
                    block.content,
                }
              : block
        ),
    },
  };
}

function stripAnswerImagesFromImportQuestion(
  item: ParsedImportQuestion
): ParsedImportQuestion {
  const cleanItem =
    stripQuestionImageHintsFromImportQuestion(
      item
    );
  const question =
    cleanItem.question;

  if (
    question.type ===
    "single_choice"
  ) {
    return {
      ...cleanItem,
      question: {
        ...question,
        options:
          question.options.map(
            (option) => ({
              ...option,
              imageId:
                undefined,
              imageUrl:
                undefined,
            })
          ),
      },
    };
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    return {
      ...cleanItem,
      question: {
        ...question,
        statements:
          question.statements.map(
            (statement) => ({
              ...statement,
              imageId:
                undefined,
              imageUrl:
                undefined,
            })
          ),
      },
    };
  }

  return cleanItem;
}

function stripAnswerImagesFromImportQuestions(
  questions:
    ParsedImportQuestion[]
) {
  return questions.map(
    stripAnswerImagesFromImportQuestion
  );
}

function hasAttachedQuestionVisual(
  item: ParsedImportQuestion
) {
  const question =
    item.question;

  if (
    question.questionImageId ||
    question.questionImageUrl
  ) {
    return true;
  }

  return Boolean(
    question.contentBlocks?.some(
      (block) =>
        block.type === "image" ||
        block.type === "table"
    )
  );
}

function buildPdfImageHintQuestions(
  questions:
    ParsedImportQuestion[]
): PdfImageHintQuestion[] {
  return questions
    .filter((item) => {
      if (
        hasAttachedQuestionVisual(
          item
        )
      ) {
        return false;
      }

      const imageHint =
        extractImageHint(
          item.question.content
        );

      return shouldRequestPdfVisualDetection({
        content:
          removeImageHintLines(
            item.question.content
          ),
        imageHint,
      });
    })
    .slice(0, 60)
    .map((item) => {
      const imageHint =
        extractImageHint(
          item.question.content
        );

      return {
        sourceNumber:
          item.sourceNumber,
        content:
          removeImageHintLines(
            item.question.content
          ).slice(0, 350),
        imageHint:
          imageHint ||
          "Câu có tín hiệu trực quan rõ ràng; chỉ lấy đúng bảng, hình, biểu đồ, đồ thị hoặc sơ đồ được nhắc tới.",
      };
    });
}

function getPdfJsAssetUrl(
  folderName: string
) {
  const pdfjsRoot = join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist"
  );
  const assetPath = join(
    pdfjsRoot,
    folderName
  );

  if (!existsSync(assetPath)) {
    throw new ImportFileError(
      `Không tìm thấy thư mục PDF decoder: ${folderName}. Hãy chạy npm install lại.`,
      500
    );
  }

  return assetPath.endsWith("/")
    ? assetPath
    : `${assetPath}/`;
}

function buildNormalizePrompt(
  rawText: string,
  fileName: string
) {
  const trimmedText =
    rawText.length >
    MAX_AI_SOURCE_CHARS
      ? `${rawText.slice(
          0,
          MAX_AI_SOURCE_CHARS
        )}\n\n[GHI CHÚ HỆ THỐNG: Tài liệu quá dài, phần sau đã bị cắt bớt khi gửi cho AI.]`
      : rawText;

  return `${IMPORT_PROMPT_CONTENT}

==========================================================
YÊU CẦU CHẠY TRONG HỆ THỐNG KIEMTRA.AI
==========================================================
Bạn đang chuyển đổi tài liệu do giáo viên tải lên trong hệ thống.
Chỉ trả về NỘI DUNG .txt thuần đúng định dạng import, bắt đầu bằng "Câu 1.".
Không trả lời giải thích, không Markdown, không code block, không tạo liên kết tải.

Tên file nguồn: ${fileName}

==========================================================
NỘI DUNG TÀI LIỆU NGUỒN
==========================================================
${trimmedText}
`;
}

function buildNormalizePdfPrompt(
  fileName: string
) {
  return `${IMPORT_PROMPT_CONTENT}

==========================================================
YÊU CẦU RIÊNG CHO PDF TOÁN / TÀI LIỆU CÓ LAYOUT
==========================================================
Bạn đang đọc trực tiếp file PDF gốc do giáo viên tải lên.
Hãy quan sát cả chữ, công thức, bảng, hình vẽ, đồ thị và sơ đồ.

Quy tắc bắt buộc khi chuyển đổi:
- Phân loại theo từng block nội dung nhìn thấy (văn bản, code, công thức, bảng, hình, biểu đồ, sơ đồ), không chọn cách xử lý chỉ dựa vào tên môn học.
- Với code, giữ nguyên xuống dòng, thụt lề, dấu ngoặc, toán tử và phân biệt Python/C/C++/SQL/HTML khi có thể. Không diễn giải code thành văn xuôi.
- Gemini chỉ chép và chuẩn hóa văn bản/code. Công thức chuyên biệt và bảng có đường kẻ sẽ được pipeline khác xử lý; không được tự bịa ký hiệu bị thiếu.
- Trước khi đọc từng câu, phải xác định câu đang thuộc PHẦN I, PHẦN II hay PHẦN III từ tiêu đề gần nhất trong PDF. Tiêu đề phần có quyền ưu tiên cao nhất khi xác định loại câu.
- PHẦN I "trắc nghiệm nhiều phương án lựa chọn" là Loại: Trắc nghiệm; a), b), c), d) là các lựa chọn và chỉ có một đáp án.
- PHẦN II "trắc nghiệm đúng sai" là Loại: Đúng-Sai; a), b), c), d) là bốn mệnh đề độc lập, không phải bốn lựa chọn.
- PHẦN III "trả lời ngắn" là Loại: Trả lời ngắn.
- Nếu đề chỉ có hai phần, vẫn phân loại theo chính tiêu đề phần; không giả định bắt buộc phải đủ ba phần.
- Nếu tiêu đề bị tách dòng, ví dụ dòng riêng "PHẦN II." rồi dòng sau mới ghi "Trắc nghiệm đúng sai", vẫn phải hiểu các câu sau đó là Loại: Đúng-Sai cho đến tiêu đề PHẦN kế tiếp.
- Công thức toán phải được giữ bằng LaTeX trong cú pháp \\(...\\) hoặc \\[...\\] khi cần.
- Không bỏ các ký hiệu như căn, phân số, chỉ số, mũ, log, sin/cos/tan, tích phân, giới hạn, vector, tọa độ, ma trận.
- Nếu câu hỏi phụ thuộc vào hình vẽ/đồ thị/sơ đồ/hình học mà không thể diễn giải đầy đủ bằng văn bản, thêm dòng:
  [GHI CHÚ: Cần chèn ảnh minh họa - <mô tả ngắn hình gốc>]
- Nếu có thể diễn giải hình thành dữ kiện văn bản chính xác, hãy diễn giải đầy đủ.
- Không làm phẳng bảng thành chuỗi dùng dấu " | " hoặc ";". Mọi bảng phải được giữ bằng ảnh crop từ PDF để không mất hàng, cột, đường viền, gộp ô và căn chỉnh.
- Với mọi bảng dữ liệu, bảng công thức hoặc bảng có hình minh họa, thêm dòng:
  [GHI CHÚ: Cần chèn ảnh minh họa - bảng dữ liệu/công thức của câu]
- Không tự giải lại làm thay đổi đáp án gốc.
- Nếu PDF không có đáp án hoặc đáp án không xuất hiện rõ ràng trong tài liệu, với câu trắc nghiệm hoặc trả lời ngắn, ghi đúng:
  Đáp án: CHƯA CÓ ĐÁP ÁN
- Nếu PDF có bảng đáp án rõ ràng ở cuối hoặc trong tài liệu, chỉ dùng đáp án từ bảng đó.
- Với câu Đúng/Sai, luôn giữ đủ bốn mệnh đề a), b), c), d) và xuất "Loại: Đúng-Sai". Không chuyển bốn mệnh đề thành bốn phương án trắc nghiệm.
- Nếu đáp án Đúng/Sai được thể hiện bằng ký hiệu, màu tô, gạch chân, in đậm hoặc đánh dấu trực quan nhất quán trong PDF, hãy đọc dấu hiệu đó như đáp án gốc và thêm "Đúng" hoặc "Sai" ở cuối từng mệnh đề.
- Với file đáp án/lời giải mà một số mệnh đề a), b), c), d) được tô màu đỏ/cam còn các mệnh đề khác màu đen, hãy coi mệnh đề được tô màu đỏ/cam là "Đúng" và mệnh đề màu đen là "Sai" khi quy ước này xuất hiện nhất quán trong PHẦN II.
- Với mọi màu dùng để highlight/nhấn mạnh đáp án như đỏ, vàng, xanh, cam, tím...: mệnh đề có màu/highlight là "Đúng"; mệnh đề không có màu/highlight là "Sai" nếu quy ước màu xuất hiện nhất quán trong câu hoặc trong PHẦN II.
- Với câu trắc nghiệm A/B/C/D: chỉ đúng 1 lựa chọn được có màu/highlight. Nếu không có lựa chọn màu hoặc có nhiều hơn 1 lựa chọn màu thì không tự sửa/không đoán.
- Khi đọc màu chữ, phải kiểm tra đủ cả bốn dòng a), b), c), d). Không được bỏ đáp án của d) chỉ vì d) là dòng cuối câu hoặc bị xuống dòng.
- Nếu câu Đúng/Sai không có metadata màu/highlight khả dụng, không tự suy luận đáp án theo nội dung.
- Không lặp lại mệnh đề dưới dạng các dòng A/B/C/D riêng để ghi đáp án. Với câu Đúng/Sai, tuyệt đối không xuất dòng "A.", "B.", "C.", "D.".
- Không xuất "Đáp án: C, D" hoặc "Các mệnh đề đúng: C, D" cho câu Đúng/Sai. Phải chuyển thành bốn dòng đầy đủ: a) ... Sai, b) ... Sai, c) ... Đúng, d) ... Đúng.
- Nếu đáp án gốc là chuỗi Đ/S như "S S Đ Đ" hoặc "Sai Sai Đúng Đúng", phải gán lần lượt cho a), b), c), d) và ghi từ đầy đủ ở cuối từng dòng.
- Sau từ "Đúng" hoặc "Sai" ở cuối mỗi mệnh đề không thêm dấu chấm, dấu phẩy hoặc ký tự nào khác.
- Mỗi mệnh đề và đáp án Đúng/Sai phải nằm trên cùng một dòng. Nếu mệnh đề d) bị xuống dòng hoặc qua trang, nối toàn bộ phần tiếp theo vào cùng dòng d) và chỉ xuất hiện một nhãn d).
- Các ký tự a/b/c/d bên trong đoạn code, thẻ HTML như <a>, biến, công thức hoặc bảng không phải là nhãn mệnh đề.

Chỉ trả về NỘI DUNG .txt thuần đúng định dạng import, bắt đầu bằng "Câu 1.".
Không trả lời giải thích, không Markdown, không code block, không tạo liên kết tải.

Tên file nguồn: ${fileName}
`;
}

function normalizeDuplicateText(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLocaleLowerCase("vi")
        .replace(
          /[^a-z0-9]+/g,
          " "
        )
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function buildDuplicateKey({
  content,
  subject,
  grade,
  type,
}: {
  content: unknown;
  subject: unknown;
  grade: unknown;
  type: unknown;
}) {
  const normalizedContent =
    normalizeDuplicateText(
      content
    );

  if (!normalizedContent) {
    return "";
  }

  return [
    normalizeDuplicateText(
      type
    ),
    normalizeDuplicateText(
      normalizeSubjectName(
        subject
      )
    ),
    normalizeDuplicateText(
      grade
    ),
    normalizedContent,
  ].join("|");
}

async function buildExistingQuestionKeys(
  ownerId: string
) {
  const snapshot =
    await getAdminDb()
      .collection("questions")
      .where(
        "ownerId",
        "==",
        ownerId
      )
      .get();

  const keys =
    new Set<string>();

  snapshot.docs.forEach(
    (documentSnapshot) => {
      const data =
        documentSnapshot.data();

      const key =
        buildDuplicateKey({
          content:
            data.content ??
            data.question,
          subject:
            data.subject,
          grade:
            data.grade,
          type:
            data.type,
        });

      if (key) {
        keys.add(key);
      }
    }
  );

  return keys;
}

async function removeDuplicateQuestions({
  questions,
  ownerId,
}: {
  questions:
    ParsedImportQuestion[];
  ownerId: string;
}): Promise<DuplicateCheckResult> {
  if (questions.length === 0) {
    return {
      questions,
      warnings: [],
    };
  }

  const existingKeys =
    await buildExistingQuestionKeys(
      ownerId
    );

  const importedKeys =
    new Set<string>();

  const uniqueQuestions:
    ParsedImportQuestion[] =
    [];

  const warnings:
    ImportQuestionsResponse["warnings"] =
    [];

  questions.forEach((item) => {
    const key =
      buildDuplicateKey({
        content:
          item.question.content,
        subject:
          item.question.subject,
        grade:
          item.question.grade,
        type:
          item.question.type,
      });

    if (!key) {
      uniqueQuestions.push(
        item
      );

      return;
    }

    if (
      importedKeys.has(key)
    ) {
      warnings.push({
        questionNumber:
          item.sourceNumber,
        message:
          "Câu hỏi bị trùng với một câu khác trong file import nên đã được loại khỏi danh sách nhập.",
      });

      return;
    }

    importedKeys.add(key);

    if (existingKeys.has(key)) {
      warnings.push({
        questionNumber:
          item.sourceNumber,
        message:
          "Câu hỏi đã tồn tại trong ngân hàng câu hỏi nên đã được loại khỏi danh sách nhập.",
      });

      return;
    }

    uniqueQuestions.push(item);
  });

  return {
    questions:
      uniqueQuestions,
    warnings,
  };
}

async function normalizeImportTextWithAi({
  rawText,
  fileName,
}: {
  rawText: string;
  fileName: string;
}) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ImportFileError(
      "File chưa đúng định dạng import và hệ thống chưa cấu hình GEMINI_API_KEY để tự chuẩn hóa bằng AI.",
      500
    );
  }

  if (
    rawText.length >
    MAX_AI_SOURCE_CHARS
  ) {
    throw new ImportFileError(
      "Tài liệu quá dài để AI chuẩn hóa trong một lần. Vui lòng tách file thành nhiều phần nhỏ hơn.",
      413
    );
  }

  const model =
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL;

  const response =
    await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildNormalizePrompt(
                    rawText,
                    fileName
                  ),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );

  const data =
    (await response.json()) as
      GeminiResponse;

  if (!response.ok) {
    throw new ImportFileError(
      getGeminiErrorMessage(
        data,
        "AI không chuẩn hóa được tài liệu."
      ),
      response.status
    );
  }

  const aiText =
    data.candidates?.[0]?.content
      ?.parts?.map(
        (part) => part.text ?? ""
      )
      .join("")
      .trim();

  if (!aiText) {
    throw new ImportFileError(
      "AI không trả về nội dung câu hỏi sau khi chuẩn hóa.",
      502
    );
  }

  return stripCodeFence(aiText);
}

async function normalizePdfWithAi(
  file: File
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ImportFileError(
      "Hệ thống chưa cấu hình GEMINI_API_KEY nên chưa thể phân tích PDF bằng AI.",
      500
    );
  }

  const model =
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL;

  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  const response =
    await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildNormalizePdfPrompt(
                    file.name
                  ),
                },
                {
                  inlineData: {
                    mimeType:
                      file.type ||
                      "application/pdf",
                    data:
                      buffer.toString(
                        "base64"
                      ),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      }
    );

  const data =
    (await response.json()) as
      GeminiResponse;

  if (!response.ok) {
    throw new ImportFileError(
      getGeminiErrorMessage(
        data,
        "AI không phân tích được file PDF."
      ),
      response.status
    );
  }

  const aiText =
    data.candidates?.[0]?.content
      ?.parts?.map(
        (part) => part.text ?? ""
      )
      .join("")
      .trim();

  if (!aiText) {
    throw new ImportFileError(
      "AI không trả về nội dung câu hỏi sau khi phân tích PDF.",
      502
    );
  }

  return stripCodeFence(aiText);
}

type ParsedQuestionBatch =
  ReturnType<typeof parseImportedQuestions>;

function getCriticalImportWarnings(
  parsed: ParsedQuestionBatch
) {
  return parsed.warnings.filter(
    (warning) =>
      /(?:xuất hiện nhiều lần|thiếu đáp án|thiếu mệnh đề|thiếu phương án|không nhận diện được|thiếu nội dung câu hỏi)/i.test(
        warning.message
      )
  );
}

function getParsedBatchQuality(
  parsed: ParsedQuestionBatch,
  expectedQuestionCount: number
) {
  const missingQuestionCount =
    Math.max(
      0,
      expectedQuestionCount -
        parsed.questions.length
    );

  return (
    parsed.questions.length * 100 -
    missingQuestionCount * 100 -
    getCriticalImportWarnings(parsed).length * 20 -
    parsed.warnings.length
  );
}

function getDetectedQuestionCountHint(
  parsed: ParsedQuestionBatch
) {
  const sourceNumbers = [
    ...parsed.questions.map(
      (item) => item.sourceNumber
    ),
    ...parsed.warnings.map(
      (warning) =>
        warning.questionNumber ?? 0
    ),
  ].filter(
    (value) =>
      Number.isFinite(value) &&
      value > 0
  );

  return Math.max(
    parsed.questions.length,
    ...sourceNumbers,
    0
  );
}

async function repairNormalizedPdfWithAi({
  file,
  normalizedText,
  warnings,
}: {
  file: File;
  normalizedText: string;
  warnings: ImportQuestionsResponse["warnings"];
}) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return normalizedText;
  }

  const model =
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL;
  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );
  const warningText =
    warnings
      .slice(0, 40)
      .map(
        (warning) =>
          `- Câu ${warning.questionNumber ?? "?"}: ${warning.message}`
      )
      .join("\n");

  const repairPrompt = `Bạn đang sửa BẢN NHÁP import câu hỏi đã được tạo từ PDF gốc nhưng chưa vượt qua bộ kiểm tra cấu trúc.

Hãy đọc lại PDF gốc, đối chiếu bản nháp và sửa TOÀN BỘ tài liệu. Chỉ trả về toàn bộ nội dung văn bản thuần sau khi sửa, bắt đầu bằng "Câu 1.". Không Markdown, không lời dẫn, không báo cáo kiểm tra.

QUY TẮC ƯU TIÊN:
1. Tiêu đề phần trong PDF quyết định loại câu: PHẦN I = Trắc nghiệm; PHẦN II = Đúng-Sai; PHẦN III = Trả lời ngắn. Nếu đề có hai phần thì dùng đúng tiêu đề thực tế.
2. Mỗi câu phải có đúng một dòng "Loại: Trắc nghiệm", "Loại: Đúng-Sai" hoặc "Loại: Trả lời ngắn".
3. Với mỗi câu Đúng-Sai, phải có đúng bốn dòng và mỗi nhãn chỉ xuất hiện MỘT LẦN:
a) <toàn bộ mệnh đề A trên một dòng> Đúng|Sai
b) <toàn bộ mệnh đề B trên một dòng> Đúng|Sai
c) <toàn bộ mệnh đề C trên một dòng> Đúng|Sai
d) <toàn bộ mệnh đề D trên một dòng> Đúng|Sai
4. Không tạo thêm các dòng A/B/C/D để ghi đáp án cho câu Đúng-Sai. Không viết "Đáp án: C, D" hoặc "Các mệnh đề đúng: C, D"; phải chuyển thành bốn dòng a), b), c), d) với Đúng/Sai ở cuối.
5. Nếu mệnh đề dài nhiều dòng trong PDF, nối chúng thành đúng một dòng trước khi thêm Đúng hoặc Sai ở cuối.
6. Đáp án thể hiện bằng màu tô, in đậm, gạch chân, dấu chọn hoặc quy ước trực quan nhất quán trong PDF là đáp án gốc. Khi quy ước cho biết phần được đánh dấu là đúng, mệnh đề được đánh dấu là Đúng và mệnh đề không đánh dấu là Sai.
7. Với file đáp án/lời giải mà một số mệnh đề được tô màu đỏ/cam còn các mệnh đề khác màu đen, coi mệnh đề đỏ/cam là Đúng và mệnh đề màu đen là Sai khi quy ước này xuất hiện nhất quán trong PHẦN II.
8. Với mọi màu dùng để highlight/nhấn mạnh đáp án như đỏ, vàng, xanh, cam, tím...: mệnh đề có màu/highlight là Đúng; mệnh đề không có màu/highlight là Sai nếu quy ước màu xuất hiện nhất quán trong câu hoặc trong PHẦN II.
9. Khi đọc màu chữ, phải kiểm tra đủ cả bốn dòng a), b), c), d). Không được bỏ đáp án của d) chỉ vì d) là dòng cuối câu hoặc bị xuống dòng.
10. Nếu câu Đúng-Sai không có metadata màu/highlight khả dụng, không tự suy luận đáp án theo nội dung.
11. Nếu đáp án gốc là chuỗi Đ/S như "S S Đ Đ" hoặc "Sai Sai Đúng Đúng", gán lần lượt cho a), b), c), d) và ghi bằng từ đầy đủ.
12. Sau từ "Đúng" hoặc "Sai" ở cuối mỗi mệnh đề không thêm dấu chấm, dấu phẩy hoặc ký tự nào khác.
13. Không lặp lại mệnh đề d) khi mệnh đề bị xuống dòng hoặc qua trang. Chữ a/b/c/d bên trong code, thẻ HTML như <a>, công thức hoặc bảng không phải nhãn mệnh đề.
14. Không tự giải hoặc thay đổi nội dung chuyên môn.
15. Giữ nguyên số lượng câu và đánh số lại liên tục một lần từ Câu 1 đến hết.
16. Trước khi trả kết quả, tự kiểm tra nội bộ rằng mọi câu Đúng-Sai có đúng một a), một b), một c), một d), và cả bốn dòng đều kết thúc bằng Đúng hoặc Sai.

LỖI BỘ KIỂM TRA ĐÃ PHÁT HIỆN:
${warningText}

BẢN NHÁP CẦN SỬA:
${normalizedText.slice(0, MAX_AI_SOURCE_CHARS)}
`;

  const response =
    await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: repairPrompt,
                },
                {
                  inlineData: {
                    mimeType:
                      file.type ||
                      "application/pdf",
                    data:
                      buffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        }),
      }
    );
  const data =
    (await response.json()) as
      GeminiResponse;

  if (!response.ok) {
    throw new ImportFileError(
      getGeminiErrorMessage(
        data,
        "AI không sửa được cấu trúc câu hỏi PDF."
      ),
      response.status
    );
  }

  const repairedText =
    data.candidates?.[0]?.content
      ?.parts?.map(
        (part) => part.text ?? ""
      )
      .join("")
      .trim();

  return repairedText
    ? stripCodeFence(repairedText)
    : normalizedText;
}

async function renderPdfPages(
  file: File,
  options: {
    scale?: number;
    pageNumbers?: number[];
  } = {}
): Promise<PdfPageImage[]> {
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );
  const canvas =
    await import(
      "@napi-rs/canvas"
    );

  const data =
    new Uint8Array(
      await file.arrayBuffer()
    );

  const loadingTask =
    pdfjs.getDocument({
      data,
      disableWorker:
        true,
      useWasm:
        true,
      wasmUrl:
        getPdfJsAssetUrl(
          "wasm"
        ),
      cMapUrl:
        getPdfJsAssetUrl(
          "cmaps"
        ),
      cMapPacked:
        true,
      standardFontDataUrl:
        getPdfJsAssetUrl(
          "standard_fonts"
        ),
    } as Parameters<
      typeof pdfjs.getDocument
    >[0]);

  const document =
    await loadingTask.promise;

  const pageCount =
    Math.min(
      document.numPages,
      25
    );

  const pages:
    PdfPageImage[] = [];
  const requestedPages =
    options.pageNumbers
      ? new Set(
          options.pageNumbers.filter(
            (pageNumber) =>
              pageNumber >= 1 &&
              pageNumber <= pageCount
          )
        )
      : null;
  const scale =
    options.scale ?? 1.35;

  for (
    let pageNumber = 1;
    pageNumber <= pageCount;
    pageNumber += 1
  ) {
    if (
      requestedPages &&
      !requestedPages.has(
        pageNumber
      )
    ) {
      continue;
    }

    const page =
      await document.getPage(
        pageNumber
      );
    const viewport =
      page.getViewport({
        scale,
      });
    const pageCanvas =
      canvas.createCanvas(
        Math.ceil(
          viewport.width
        ),
        Math.ceil(
          viewport.height
        )
      );
    const canvasContext =
      pageCanvas.getContext(
        "2d"
      );

    await page.render({
      canvasContext,
      viewport,
    } as unknown as Parameters<
      typeof page.render
    >[0]).promise;

    const pngBuffer =
      pageCanvas.toBuffer(
        "image/png"
      );

    pages.push({
      pageNumber,
      width:
        pageCanvas.width,
      height:
        pageCanvas.height,
      pngBuffer,
      base64:
        pngBuffer.toString(
          "base64"
        ),
    });
  }

  return pages;
}

async function detectPdfRuledTableRegions({
  pages,
  questionRegions,
}: {
  pages: PdfPageImage[];
  questionRegions:
    NormalizedPdfRegion[];
}): Promise<PdfImageRegion[]> {
  const sharp =
    (
      await import("sharp")
    ).default;
  const regions:
    PdfImageRegion[] = [];

  for (const page of pages) {
    const raw =
      await sharp(
        page.pngBuffer
      )
        .ensureAlpha()
        .raw()
        .toBuffer({
          resolveWithObject:
            true,
        });
    const blocks =
      detectRuledTableBlocks({
        pages: [
          {
            pageNumber:
              page.pageNumber,
            width:
              raw.info.width,
            height:
              raw.info.height,
            channels:
              raw.info.channels,
            data: new Uint8Array(
              raw.data
            ),
          },
        ],
        questionRegions:
          questionRegions.filter(
            (region) =>
              region.pageNumber ===
              page.pageNumber
          ),
      });

    regions.push(
      ...blocks.map((block) => ({
        sourceNumber:
          block.sourceNumber,
        pageNumber:
          block.pageNumber,
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        confidence:
          block.confidence,
        evidence:
          "table_border" as const,
        description:
          block.description ??
          "Bảng có đường kẻ",
      }))
    );
  }

  return regions;
}

async function extractPdfGeometry(
  file: File
): Promise<PdfGeometryResult> {
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );
  const data = new Uint8Array(
    await file.arrayBuffer()
  );
  const loadingTask =
    pdfjs.getDocument({
      data,
      disableWorker: true,
      useWasm: true,
      wasmUrl:
        getPdfJsAssetUrl(
          "wasm"
        ),
      cMapUrl:
        getPdfJsAssetUrl(
          "cmaps"
        ),
      cMapPacked: true,
      standardFontDataUrl:
        getPdfJsAssetUrl(
          "standard_fonts"
        ),
    } as Parameters<
      typeof pdfjs.getDocument
    >[0]);
  const document =
    await loadingTask.promise;
  const pageCount = Math.min(
    document.numPages,
    25
  );
  const pages: PdfPageGeometry[] = [];
  const lines: PdfGeometryLine[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pageCount;
    pageNumber += 1
  ) {
    const page =
      await document.getPage(
        pageNumber
      );
    const viewport =
      page.getViewport({
        scale: 1,
      });
    const textContent =
      await page.getTextContent();
    const spans =
      textContent.items
        .map((item) => {
          const raw = item as {
            str?: unknown;
            transform?: unknown;
            width?: unknown;
            height?: unknown;
          };

          if (
            typeof raw.str !==
              "string" ||
            !Array.isArray(
              raw.transform
            )
          ) {
            return null;
          }

          const height =
            Number(raw.height) ||
            Math.abs(
              Number(
                raw.transform[3]
              )
            ) ||
            1;

          return {
            text: raw.str,
            x:
              Number(
                raw.transform[4]
              ) || 0,
            y:
              viewport.height -
              (Number(
                raw.transform[5]
              ) || 0) -
              height,
            width:
              Number(raw.width) ||
              0,
            height,
          };
        })
        .filter(
          (
            item
          ): item is Omit<
            PdfGeometryLine,
            "pageNumber"
          > => Boolean(item)
        )
        .sort(
          (left, right) =>
            left.y - right.y ||
            left.x - right.x
        );
    const pageLines:
      PdfGeometryLine[] = [];

    spans.forEach((span) => {
      const current =
        pageLines[
          pageLines.length - 1
        ];
      const tolerance =
        Math.max(
          2.5,
          Math.min(
            7,
            span.height * 0.5
          )
        );

      if (
        current &&
        Math.abs(
          current.y - span.y
        ) <= tolerance
      ) {
        const currentRight =
          current.x +
          current.width;
        const separator =
          span.x - currentRight >
          Math.max(
            1.5,
            span.height * 0.08
          )
            ? " "
            : "";
        const right = Math.max(
          currentRight,
          span.x + span.width
        );
        current.text =
          `${current.text}${separator}${span.text}`
            .replace(/\s+/g, " ")
            .trim();
        current.width =
          right - current.x;
        current.height =
          Math.max(
            current.height,
            span.height
          );
        return;
      }

      pageLines.push({
        pageNumber,
        ...span,
        text: span.text.trim(),
      });
    });

    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
    });
    lines.push(
      ...pageLines.filter(
        (line) => line.text
      )
    );
  }

  const questionRegions =
    detectPdfQuestionRegions({
      pages,
      lines,
    });
  const optionRegions =
    detectPdfOptionRegions({
      questionRegions,
      lines,
    });
  const blocks =
    classifyPdfNativeBlocks({
      questionRegions,
      lines,
      pages,
    });
  const normalizeRegion = (
    region:
      | (typeof questionRegions)[number]
      | (typeof optionRegions)[number]
  ) => {
      const page = pages.find(
        (item) =>
          item.pageNumber ===
          region.pageNumber
      );

      const normalized =
        normalizePdfQuestionRegion(
        region,
        page ?? {
          pageNumber:
            region.pageNumber,
          width: region.width,
          height:
            region.y +
            region.height,
        }
        );

      const nativeText = lines
        .filter(
          (line) =>
            line.pageNumber ===
              region.pageNumber &&
            line.y >= region.y &&
            line.y <
              region.y +
                region.height
        )
        .map((line) => line.text)
        .join(" ")
        .trim();

      return {
        ...normalized,
        nativeText,
      };
    };
  const regions =
    questionRegions.map(
      normalizeRegion
    );
  const normalizedOptionRegions:
    NormalizedPdfOptionRegion[] =
    optionRegions.map((region) => ({
      ...normalizeRegion(region),
      optionId: region.optionId,
    }));

  return {
    pages,
    regions,
    optionRegions:
      normalizedOptionRegions,
    blocks,
  };
}

function matchPdfGeometryToQuestions(
  geometry: PdfGeometryResult,
  questions: ParsedImportQuestion[]
): Omit<
  PdfGeometryResult,
  "regions"
> & {
  regions:
    PdfMatchedQuestionRegion[];
} {
  const regions =
    matchPdfQuestionRegions({
      questions: questions.map(
        (item) => ({
          sourceNumber:
            item.sourceNumber,
          content:
            item.question.content,
        })
      ),
      regions: geometry.regions,
    });
  const targetByOriginal =
    new Map(
      regions.map((region) => [
        region.originalSourceNumber,
        region.sourceNumber,
      ])
    );

  return {
    ...geometry,
    regions,
    optionRegions:
      geometry.optionRegions.flatMap(
        (region) => {
          const sourceNumber =
            targetByOriginal.get(
              region.sourceNumber
            );

          return sourceNumber
            ? [
                {
                  ...region,
                  sourceNumber,
                },
              ]
            : [];
        }
      ),
    blocks:
      geometry.blocks.flatMap(
        (block) => {
          const sourceNumber =
            targetByOriginal.get(
              block.sourceNumber
            );

          return sourceNumber
            ? [
                {
                  ...block,
                  sourceNumber,
                },
              ]
            : [];
        }
      ),
  };
}

const PDF_BLACK_COLOR: PdfTextColor =
  {
    key: "0,0,0",
    known: true,
    r: 0,
    g: 0,
    b: 0,
  };

const PDF_UNKNOWN_COLOR: PdfTextColor =
  {
    key: "unknown",
    known: false,
    r: 0,
    g: 0,
    b: 0,
  };

function compactPdfText(
  value: string
) {
  return value.replace(
    /\s+/g,
    ""
  );
}

function normalizePdfText(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePdfColorNumber(
  value: unknown
) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(numeric)
  ) {
    return 0;
  }

  const scaled =
    numeric <= 1
      ? numeric * 255
      : numeric;

  return Math.round(
    clampNumber(scaled, 0, 255)
  );
}

function createPdfTextColor(
  r: unknown,
  g: unknown,
  b: unknown
): PdfTextColor {
  const red =
    normalizePdfColorNumber(r);
  const green =
    normalizePdfColorNumber(g);
  const blue =
    normalizePdfColorNumber(b);

  return {
    key: `${red},${green},${blue}`,
    known: true,
    r: red,
    g: green,
    b: blue,
  };
}

function flattenNumericArgs(
  value: unknown
): number[] {
  if (Array.isArray(value)) {
    return value.flatMap(
      flattenNumericArgs
    );
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return [value];
  }

  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  ) {
    return [Number(value)];
  }

  return [];
}

function getFillColorFromArgs(
  args: unknown
) {
  const values =
    flattenNumericArgs(args);

  if (values.length >= 4) {
    const [c, m, y, k] =
      values;
    const cyan =
      clampNumber(c, 0, 1);
    const magenta =
      clampNumber(m, 0, 1);
    const yellow =
      clampNumber(y, 0, 1);
    const black =
      clampNumber(k, 0, 1);

    return createPdfTextColor(
      255 *
        (1 - cyan) *
        (1 - black),
      255 *
        (1 - magenta) *
        (1 - black),
      255 *
        (1 - yellow) *
        (1 - black)
    );
  }

  if (values.length >= 3) {
    return createPdfTextColor(
      values[0],
      values[1],
      values[2]
    );
  }

  if (values.length >= 1) {
    const gray =
      normalizePdfColorNumber(
        values[0]
      );

    return createPdfTextColor(
      gray,
      gray,
      gray
    );
  }

  return PDF_UNKNOWN_COLOR;
}

function isDefaultPdfBlack(
  color: PdfTextColor
) {
  if (!color.known) {
    return false;
  }

  return (
    color.r <= 35 &&
    color.g <= 35 &&
    color.b <= 35
  );
}

function extractOperatorText(
  value: unknown
): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map(extractOperatorText)
      .join("");
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    if (
      typeof record.unicode ===
      "string"
    ) {
      return record.unicode;
    }

    if (
      typeof record.str ===
      "string"
    ) {
      return record.str;
    }
  }

  return "";
}

function buildPdfTextColorSegments(
  operatorList: {
    fnArray: number[];
    argsArray: unknown[];
  },
  ops: Record<string, number>
) {
  const segments:
    Array<{
      text: string;
      compactText: string;
      color: PdfTextColor;
    }> = [];
  const colorStack:
    PdfTextColor[] = [];

  let currentColor =
    PDF_BLACK_COLOR;

  operatorList.fnArray.forEach(
    (fn, index) => {
      const args =
        operatorList.argsArray[
          index
        ];

      if (fn === ops.save) {
        colorStack.push(
          currentColor
        );
        return;
      }

      if (fn === ops.restore) {
        currentColor =
          colorStack.pop() ??
          PDF_BLACK_COLOR;
        return;
      }

      if (
        fn === ops.setFillRGBColor ||
        fn === ops.setFillColor ||
        fn === ops.setFillColorN ||
        fn === ops.setFillCMYKColor
      ) {
        currentColor =
          getFillColorFromArgs(
            args
          );
        return;
      }

      if (fn === ops.setFillGray) {
        const gray =
          Array.isArray(args)
            ? args[0]
            : args;
        const value =
          normalizePdfColorNumber(
            gray
          );
        currentColor =
          createPdfTextColor(
            value,
            value,
            value
          );
        return;
      }

      if (
        fn === ops.showText ||
        fn === ops.showSpacedText ||
        fn === ops.nextLineShowText ||
        fn ===
          ops.nextLineSetSpacingShowText
      ) {
        const text =
          extractOperatorText(
            args
          );
        const compactText =
          compactPdfText(text);

        if (compactText) {
          segments.push({
            text,
            compactText,
            color:
              currentColor,
          });
        }
      }
    }
  );

  return segments;
}

function chooseDominantPdfColor(
  counts:
    Map<
      string,
      {
        color: PdfTextColor;
        count: number;
      }
    >
) {
  return Array.from(
    counts.values()
  ).sort(
    (first, second) =>
      second.count -
      first.count
  )[0]?.color ??
    PDF_UNKNOWN_COLOR;
}

function assignColorsToTextSpans({
  spans,
  segments,
}: {
  spans:
    Array<
      Omit<PdfTextSpan, "color">
    >;
  segments:
    Array<{
      compactText: string;
      color: PdfTextColor;
    }>;
}): PdfTextSpan[] {
  let segmentIndex = 0;
  let segmentOffset = 0;

  return spans.map((span) => {
    const targetLength =
      compactPdfText(
        span.text
      ).length;
    const counts =
      new Map<
        string,
        {
          color: PdfTextColor;
          count: number;
        }
      >();

    let remaining =
      targetLength;

    while (
      remaining > 0 &&
      segmentIndex <
        segments.length
    ) {
      const segment =
        segments[
          segmentIndex
        ];
      const available =
        segment.compactText
          .length -
        segmentOffset;
      const take =
        Math.min(
          remaining,
          Math.max(available, 0)
        );

      if (take > 0) {
        const current =
          counts.get(
            segment.color.key
          ) ?? {
            color:
              segment.color,
            count: 0,
          };

        current.count += take;
        counts.set(
          segment.color.key,
          current
        );
        remaining -= take;
        segmentOffset += take;
      }

      if (
        segmentOffset >=
        segment.compactText.length
      ) {
        segmentIndex += 1;
        segmentOffset = 0;
      }
    }

    return {
      ...span,
      color:
        targetLength > 0 &&
        counts.size > 0
          ? chooseDominantPdfColor(
              counts
            )
          : PDF_UNKNOWN_COLOR,
    };
  });
}

function groupPdfTextLines(
  spans: PdfTextSpan[]
): PdfTextLine[] {
  const sorted =
    [...spans].sort(
      (first, second) => {
        if (
          first.pageNumber !==
          second.pageNumber
        ) {
          return (
            first.pageNumber -
            second.pageNumber
          );
        }

        if (
          Math.abs(
            first.y - second.y
          ) > 2.5
        ) {
          return second.y - first.y;
        }

        return first.x - second.x;
      }
    );

  const lines:
    PdfTextLine[] = [];

  sorted.forEach((span) => {
    const current =
      lines[
        lines.length - 1
      ];
    const tolerance =
      Math.max(
        3,
        Math.min(
          10,
          span.height * 0.6
        )
      );

    if (
      current &&
      current.pageNumber ===
        span.pageNumber &&
      Math.abs(
        current.y - span.y
      ) <= tolerance
    ) {
      current.spans.push(span);
      current.spans.sort(
        (first, second) =>
          first.x - second.x
      );
      current.x =
        Math.min(
          current.x,
          span.x
        );
      current.y =
        (current.y + span.y) /
        2;
      current.text =
        current.spans
          .map((item) => item.text)
          .join("")
          .replace(/\s+/g, " ")
          .trim();
      return;
    }

    lines.push({
      pageNumber:
        span.pageNumber,
      text:
        span.text
          .replace(/\s+/g, " ")
          .trim(),
      x: span.x,
      y: span.y,
      spans: [span],
    });
  });

  return lines.filter(
    (line) =>
      line.text.trim()
  );
}

function getPdfLineRawText(
  line: PdfTextLine
) {
  return line.spans
    .map((span) => span.text)
    .join("");
}

function slicePdfLineByOffsets(
  line: PdfTextLine,
  startOffset: number,
  endOffset: number
): PdfTextLine | null {
  const spans =
    [...line.spans].sort(
      (first, second) =>
        first.x - second.x
    );
  const rawText =
    getPdfLineRawText(line);
  const start =
    Math.round(
      clampNumber(
        startOffset,
        0,
        rawText.length
      )
    );
  const end =
    Math.round(
      clampNumber(
        endOffset,
        start,
        rawText.length
      )
    );

  if (end <= start) {
    return null;
  }

  const nextSpans:
    PdfTextSpan[] = [];
  let currentOffset = 0;

  spans.forEach((span) => {
    const spanLength =
      span.text.length;
    const spanStart =
      currentOffset;
    const spanEnd =
      spanStart + spanLength;

    currentOffset =
      spanEnd;

    if (
      spanLength === 0 ||
      spanEnd <= start ||
      spanStart >= end
    ) {
      return;
    }

    const overlapStart =
      Math.max(
        start,
        spanStart
      );
    const overlapEnd =
      Math.min(
        end,
        spanEnd
      );
    const startRatio =
      (overlapStart -
        spanStart) /
      spanLength;
    const endRatio =
      (overlapEnd -
        spanStart) /
      spanLength;
    const textStart =
      overlapStart -
      spanStart;
    const textEnd =
      overlapEnd -
      spanStart;

    nextSpans.push({
      ...span,
      text:
        span.text.slice(
          textStart,
          textEnd
        ),
      x:
        span.x +
        span.width *
          startRatio,
      width:
        span.width *
        Math.max(
          0,
          endRatio -
            startRatio
        ),
    });
  });

  if (nextSpans.length === 0) {
    return null;
  }

  return {
    pageNumber:
      line.pageNumber,
    text:
      nextSpans
        .map((span) => span.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    x: Math.min(
      ...nextSpans.map(
        (span) => span.x
      )
    ),
    y: line.y,
    spans: nextSpans,
  };
}

function splitPdfLineByOptionMarkers(
  line: PdfTextLine,
  {
    allowInlineSingle =
      false,
  }: {
    allowInlineSingle?: boolean;
  } = {}
) {
  const rawText =
    getPdfLineRawText(line);
  const matches:
    Array<{
      optionId:
        | "A"
        | "B"
        | "C"
        | "D";
      start: number;
    }> = [];
  const markerPattern =
    /(^|[\s\u00a0])([a-dA-D])\s*[\.\)]\s*/g;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      markerPattern.exec(
        rawText
      ))
  ) {
    const start =
      match.index +
      match[1].length;
    const optionId =
      match[2]
        .toUpperCase() as
        | "A"
        | "B"
        | "C"
        | "D";

    if (
      matches.some(
        (item) =>
          item.optionId ===
          optionId
      )
    ) {
      continue;
    }

    matches.push({
      optionId,
      start,
    });
  }

  if (matches.length === 0) {
    return [];
  }

  if (
    matches.length === 1 &&
    !allowInlineSingle &&
    matches[0].start > 6
  ) {
    return [];
  }

  return matches
    .map((item, index) => {
      const next =
        matches[index + 1];
      const segmentLine =
        slicePdfLineByOffsets(
          line,
          item.start,
          next?.start ??
            rawText.length
        );

      if (!segmentLine) {
        return null;
      }

      return {
        optionId:
          item.optionId,
        line:
          segmentLine,
      };
    })
    .filter(
      (
        item
      ): item is {
        optionId:
          | "A"
          | "B"
          | "C"
          | "D";
        line: PdfTextLine;
      } => Boolean(item)
    );
}

function detectPdfSectionQuestionType(
  lineText: string
): PdfColorSectionType | null {
  const normalized =
    normalizePdfText(
      lineText
    );
  const sectionMatch =
    normalized.match(
      /^(?:phan|part)\s+([ivx]+|\d+)/
    );

  if (
    normalized.includes(
      "tra loi ngan"
    ) ||
    normalized.includes(
      "tu luan ngan"
    ) ||
    sectionMatch?.[1] === "iii" ||
    sectionMatch?.[1] === "3"
  ) {
    return "short_answer";
  }

  if (
    normalized.includes(
      "dung sai"
    ) ||
    sectionMatch?.[1] === "ii" ||
    sectionMatch?.[1] === "2"
  ) {
    return "true_false_group";
  }

  if (
    normalized.includes(
      "nhieu phuong an"
    ) ||
    normalized.includes(
      "lua chon"
    ) ||
    (
      normalized.includes(
        "trac nghiem"
      ) &&
      !normalized.includes(
        "dung sai"
      )
    ) ||
    sectionMatch?.[1] === "i" ||
    sectionMatch?.[1] === "1"
  ) {
    return "single_choice";
  }

  return null;
}

function isPdfChoiceMarkerOnly(
  text: string
) {
  return /^\s*[a-dA-D]\s*[\.\)]\s*$/.test(
    text
  );
}

function getPdfContentColorFromLines(
  lines: PdfTextLine[]
) {
  const counts =
    new Map<
      string,
      {
        color: PdfTextColor;
        count: number;
      }
    >();

  let firstLine = true;

  lines.forEach((line) => {
    let charsToSkip =
      firstLine
        ? line.text.match(
            /^\s*[a-dA-D]\s*[\.\)]\s*/
          )?.[0].length ?? 0
        : 0;

    line.spans.forEach((span) => {
      let text =
        span.text;

      if (charsToSkip > 0) {
        const skip =
          Math.min(
            charsToSkip,
            text.length
          );

        text =
          text.slice(skip);
        charsToSkip -= skip;
      }

      if (
        !text.trim() ||
        isPdfChoiceMarkerOnly(
          text
        )
      ) {
        return;
      }

      const length =
        compactPdfText(text)
          .length;

      if (length === 0) {
        return;
      }

      const current =
        counts.get(
          span.color.key
        ) ?? {
          color:
            span.color,
          count: 0,
        };

      current.count += length;
      counts.set(
        span.color.key,
        current
      );
    });

    firstLine = false;
  });

  return chooseDominantPdfColor(
    counts
  );
}

function buildPdfColorAnswerResult({
  sourceNumber,
  questionType,
  optionLines,
}: {
  sourceNumber: number;
  questionType:
    PdfColorAnswerResult["questionType"];
  optionLines:
    Map<
      "A" | "B" | "C" | "D",
      PdfTextLine[]
    >;
}): PdfColorAnswerResult {
  const ids =
    [
      "A",
      "B",
      "C",
      "D",
    ] as const;
  const missingIds =
    ids.filter(
      (id) =>
        !optionLines.get(id)
          ?.length
    );

  if (missingIds.length > 0) {
    return {
      sourceNumber,
      questionType,
      answers: {},
      answerSource:
        "manual_required",
      needsManualReview:
        true,
      reviewReason:
        `Không xác định được ranh giới mệnh đề/phương án ${missingIds.join(
          ", "
        )} trong PDF.`,
    };
  }

  const answers:
    PdfColorAnswerResult["answers"] =
      {};
  const unknownIds:
    string[] = [];

  ids.forEach((id) => {
    const color =
      getPdfContentColorFromLines(
        optionLines.get(id) ??
          []
      );

    if (!color.known) {
      unknownIds.push(id);
      return;
    }

    answers[id] =
      !isDefaultPdfBlack(
        color
      );
  });

  if (unknownIds.length > 0) {
    return {
      sourceNumber,
      questionType,
      answers,
      answerSource:
        "manual_required",
      needsManualReview:
        true,
      reviewReason:
        `PDF không có metadata màu khả dụng cho ${unknownIds.join(
          ", "
        )}; cần giáo viên xác nhận đáp án.`,
    };
  }

  if (
    questionType ===
    "single_choice"
  ) {
    const trueIds =
      ids.filter(
        (id) => answers[id]
      );

    if (trueIds.length !== 1) {
      return {
        sourceNumber,
        questionType,
        answers,
        answerSource:
          "manual_required",
        needsManualReview:
          true,
        reviewReason:
          trueIds.length === 0
            ? "Trắc nghiệm A/B/C/D không có phương án màu; cần giáo viên xác nhận đáp án."
            : `Trắc nghiệm A/B/C/D có ${trueIds.length} phương án màu (${trueIds.join(
                ", "
              )}); cần giáo viên xác nhận đáp án.`,
      };
    }
  }

  return {
    sourceNumber,
    questionType,
    answers,
    answerSource:
      "pdf_color",
    needsManualReview:
      false,
  };
}

async function renderPdfVisualPages(
  file: File,
  targetPageNumbers?: Set<number>
): Promise<Map<number, PdfVisualPage>> {
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );
  const canvas =
    await import(
      "@napi-rs/canvas"
    );
  const data =
    new Uint8Array(
      await file.arrayBuffer()
    );
  const loadingTask =
    pdfjs.getDocument({
      data,
      disableWorker:
        true,
      useWasm:
        true,
      wasmUrl:
        getPdfJsAssetUrl(
          "wasm"
        ),
      cMapUrl:
        getPdfJsAssetUrl(
          "cmaps"
        ),
      cMapPacked:
        true,
      standardFontDataUrl:
        getPdfJsAssetUrl(
          "standard_fonts"
        ),
    } as Parameters<
      typeof pdfjs.getDocument
    >[0]);
  const document =
    await loadingTask.promise;
  const pages =
    new Map<
      number,
      PdfVisualPage
    >();
  const scale = 2;

  for (
    let pageNumber = 1;
    pageNumber <=
    document.numPages;
    pageNumber += 1
  ) {
    if (
      targetPageNumbers &&
      !targetPageNumbers.has(
        pageNumber
      )
    ) {
      continue;
    }

    const page =
      await document.getPage(
        pageNumber
      );
    const baseViewport =
      page.getViewport({
        scale: 1,
      });
    const viewport =
      page.getViewport({
        scale,
      });
    const pageCanvas =
      canvas.createCanvas(
        Math.ceil(
          viewport.width
        ),
        Math.ceil(
          viewport.height
        )
      );
    const canvasContext =
      pageCanvas.getContext(
        "2d"
      );

    canvasContext.fillStyle =
      "#ffffff";
    canvasContext.fillRect(
      0,
      0,
      pageCanvas.width,
      pageCanvas.height
    );

    await page.render({
      canvasContext,
      viewport,
    } as unknown as Parameters<
      typeof page.render
    >[0]).promise;

    const imageData =
      canvasContext.getImageData(
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

    pages.set(pageNumber, {
      pageNumber,
      width:
        pageCanvas.width,
      height:
        pageCanvas.height,
      pdfWidth:
        baseViewport.width,
      pdfHeight:
        baseViewport.height,
      data:
        imageData.data,
    });
  }

  return pages;
}

function getPdfLineContentBounds(
  line: PdfTextLine,
  isFirstLine: boolean
) {
  const rawText =
    getPdfLineRawText(line);
  const markerLength =
    isFirstLine
      ? rawText.match(
          /^\s*[a-dA-D]\s*[\.\)]\s*/
        )?.[0].length ?? 0
      : 0;
  const contentLine =
    slicePdfLineByOffsets(
      line,
      markerLength,
      rawText.length
    ) ?? line;
  const spans =
    contentLine.spans.filter(
      (span) =>
        span.text.trim() &&
        !isPdfChoiceMarkerOnly(
          span.text
        )
    );

  if (spans.length === 0) {
    return null;
  }

  return {
    pageNumber:
      line.pageNumber,
    minX: Math.min(
      ...spans.map(
        (span) => span.x
      )
    ),
    maxX: Math.max(
      ...spans.map(
        (span) =>
          span.x + span.width
      )
    ),
    minY: Math.min(
      ...spans.map(
        (span) =>
          span.y -
          span.height * 0.35
      )
    ),
    maxY: Math.max(
      ...spans.map(
        (span) =>
          span.y +
          span.height * 1.05
      )
    ),
  };
}

function samplePdfVisualRect({
  page,
  left,
  top,
  width,
  height,
}: {
  page: PdfVisualPage;
  left: number;
  top: number;
  width: number;
  height: number;
}): PdfVisualColorResult {
  const startX =
    Math.floor(
      clampNumber(
        left,
        0,
        page.width - 1
      )
    );
  const startY =
    Math.floor(
      clampNumber(
        top,
        0,
        page.height - 1
      )
    );
  const endX =
    Math.ceil(
      clampNumber(
        left + width,
        startX + 1,
        page.width
      )
    );
  const endY =
    Math.ceil(
      clampNumber(
        top + height,
        startY + 1,
        page.height
      )
    );
  const area =
    (endX - startX) *
    (endY - startY);
  const stride =
    area > 45000
      ? 3
      : area > 12000
        ? 2
        : 1;
  let coloredPixels = 0;
  let nonWhitePixels = 0;

  for (
    let y = startY;
    y < endY;
    y += stride
  ) {
    for (
      let x = startX;
      x < endX;
      x += stride
    ) {
      const index =
        (y * page.width + x) *
        4;
      const alpha =
        page.data[index + 3];

      if (alpha < 20) {
        continue;
      }

      const red =
        page.data[index];
      const green =
        page.data[index + 1];
      const blue =
        page.data[index + 2];
      const max =
        Math.max(
          red,
          green,
          blue
        );
      const min =
        Math.min(
          red,
          green,
          blue
        );

      if (
        red > 246 &&
        green > 246 &&
        blue > 246
      ) {
        continue;
      }

      nonWhitePixels += 1;

      const saturation =
        max === 0
          ? 0
          : (max - min) / max;
      const isDarkNeutral =
        max < 80 &&
        saturation < 0.28;

      if (
        !isDarkNeutral &&
        max - min >= 34 &&
        saturation >= 0.18
      ) {
        coloredPixels += 1;
      }
    }
  }

  const ratio =
    coloredPixels /
    Math.max(nonWhitePixels, 1);

  return {
    known:
      nonWhitePixels >= 12,
    isColored:
      coloredPixels >= 16 &&
      ratio >= 0.07,
    coloredPixels,
    nonWhitePixels,
  };
}

function classifyPdfVisualOptionColor({
  optionLines,
  visualPages,
}: {
  optionLines: PdfTextLine[];
  visualPages: Map<
    number,
    PdfVisualPage
  >;
}): PdfVisualColorResult {
  let coloredPixels = 0;
  let nonWhitePixels = 0;

  optionLines.forEach(
    (line, index) => {
      const page =
        visualPages.get(
          line.pageNumber
        );
      const bounds =
        getPdfLineContentBounds(
          line,
          index === 0
        );

      if (!page || !bounds) {
        return;
      }

      const scaleX =
        page.width /
        page.pdfWidth;
      const scaleY =
        page.height /
        page.pdfHeight;
      const left =
        bounds.minX * scaleX -
        5;
      const top =
        (page.pdfHeight -
          bounds.maxY) *
          scaleY -
        5;
      const width =
        (bounds.maxX -
          bounds.minX) *
          scaleX +
        10;
      const height =
        Math.max(
          16,
          (bounds.maxY -
            bounds.minY) *
            scaleY +
            10
        );
      const sample =
        samplePdfVisualRect({
          page,
          left,
          top,
          width,
          height,
        });

      coloredPixels +=
        sample.coloredPixels;
      nonWhitePixels +=
        sample.nonWhitePixels;
    }
  );

  const ratio =
    coloredPixels /
    Math.max(nonWhitePixels, 1);

  return {
    known:
      nonWhitePixels >= 12,
    isColored:
      coloredPixels >= 16 &&
      ratio >= 0.07,
    coloredPixels,
    nonWhitePixels,
  };
}

function buildPdfVisualColorAnswerResult({
  candidate,
  visualPages,
}: {
  candidate:
    PdfColorQuestionCandidate;
  visualPages: Map<
    number,
    PdfVisualPage
  >;
}): PdfColorAnswerResult {
  const ids =
    [
      "A",
      "B",
      "C",
      "D",
    ] as const;
  const missingIds =
    ids.filter(
      (id) =>
        !candidate.optionLines.get(
          id
        )?.length
    );

  if (missingIds.length > 0) {
    return {
      sourceNumber:
        candidate.sourceNumber,
      questionType:
        candidate.questionType,
      answers: {},
      answerSource:
        "manual_required",
      needsManualReview:
        true,
      reviewReason:
        `Không xác định được ranh giới mệnh đề/phương án ${missingIds.join(
          ", "
        )} trong PDF.`,
    };
  }

  const answers:
    PdfColorAnswerResult["answers"] =
      {};
  const unknownIds:
    string[] = [];

  ids.forEach((id) => {
    const result =
      classifyPdfVisualOptionColor({
        optionLines:
          candidate.optionLines.get(
            id
          ) ?? [],
        visualPages,
      });

    if (!result.known) {
      unknownIds.push(id);
      return;
    }

    answers[id] =
      result.isColored;
  });

  if (unknownIds.length > 0) {
    return {
      sourceNumber:
        candidate.sourceNumber,
      questionType:
        candidate.questionType,
      answers,
      answerSource:
        "manual_required",
      needsManualReview:
        true,
      reviewReason:
        `Không đọc rõ màu/highlight trên ảnh PDF cho ${unknownIds.join(
          ", "
        )}; cần giáo viên xác nhận đáp án.`,
    };
  }

  if (
    candidate.questionType ===
    "single_choice"
  ) {
    const trueIds =
      ids.filter(
        (id) => answers[id]
      );

    if (trueIds.length !== 1) {
      return {
        sourceNumber:
          candidate.sourceNumber,
        questionType:
          candidate.questionType,
        answers,
        answerSource:
          "manual_required",
        needsManualReview:
          true,
        reviewReason:
          trueIds.length === 0
            ? "Trắc nghiệm A/B/C/D không có vùng màu rõ trên ảnh PDF; cần giáo viên xác nhận đáp án."
            : `Trắc nghiệm A/B/C/D có ${trueIds.length} vùng màu rõ trên ảnh PDF (${trueIds.join(
                ", "
              )}); cần giáo viên xác nhận đáp án.`,
      };
    }
  }

  return {
    sourceNumber:
      candidate.sourceNumber,
    questionType:
      candidate.questionType,
    answers,
    answerSource:
      "pdf_color",
    needsManualReview:
      false,
  };
}

function arePdfColorAnswersEqual(
  first: PdfColorAnswerResult,
  second: PdfColorAnswerResult
) {
  return (
    [
      "A",
      "B",
      "C",
      "D",
    ] as const
  ).every(
    (id) =>
      first.answers[id] ===
      second.answers[id]
  );
}

async function applyPdfVisualColorFallback({
  file,
  candidates,
  textResults,
}: {
  file: File;
  candidates:
    PdfColorQuestionCandidate[];
  textResults:
    PdfColorAnswerResult[];
}) {
  if (candidates.length === 0) {
    return textResults;
  }

  const targetPageNumbers =
    new Set<number>();

  candidates.forEach(
    (candidate) => {
      candidate.optionLines.forEach(
        (lines) => {
          lines.forEach((line) => {
            targetPageNumbers.add(
              line.pageNumber
            );
          });
        }
      );
    }
  );

  if (
    targetPageNumbers.size === 0
  ) {
    return textResults;
  }

  let visualPages:
    Map<
      number,
      PdfVisualPage
    >;

  try {
    visualPages =
      await renderPdfVisualPages(
        file,
        targetPageNumbers
      );
  } catch {
    return textResults;
  }

  return textResults.map(
    (textResult, index) => {
      const candidate =
        candidates[index];

      if (!candidate) {
        return textResult;
      }

      const visualResult =
        buildPdfVisualColorAnswerResult({
          candidate,
          visualPages,
        });

      if (
        visualResult.answerSource ===
          "pdf_color" &&
        (
          textResult.answerSource !==
            "pdf_color" ||
          !arePdfColorAnswersEqual(
            textResult,
            visualResult
          )
        )
      ) {
        return visualResult;
      }

      if (
        textResult.answerSource ===
        "pdf_color"
      ) {
        return textResult;
      }

      return visualResult;
    }
  );
}

async function extractPdfColorAnswers(
  file: File
): Promise<PdfColorAnswerResult[]> {
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );
  const data =
    new Uint8Array(
      await file.arrayBuffer()
    );
  const loadingTask =
    pdfjs.getDocument({
      data,
      disableWorker:
        true,
      useWasm:
        true,
      wasmUrl:
        getPdfJsAssetUrl(
          "wasm"
        ),
      cMapUrl:
        getPdfJsAssetUrl(
          "cmaps"
        ),
      cMapPacked:
        true,
      standardFontDataUrl:
        getPdfJsAssetUrl(
          "standard_fonts"
        ),
    } as Parameters<
      typeof pdfjs.getDocument
    >[0]);
  const document =
    await loadingTask.promise;
  const allSpans:
    PdfTextSpan[] = [];

  for (
    let pageNumber = 1;
    pageNumber <=
    document.numPages;
    pageNumber += 1
  ) {
    const page =
      await document.getPage(
        pageNumber
      );
    const [
      textContent,
      operatorList,
    ] = await Promise.all([
      page.getTextContent(),
      page.getOperatorList(),
    ]);
    const rawSpans =
      textContent.items
        .map((item) => {
          const raw =
            item as {
              str?: unknown;
              transform?: unknown;
              width?: unknown;
              height?: unknown;
            };

          if (
            typeof raw.str !==
              "string" ||
            !Array.isArray(
              raw.transform
            )
          ) {
            return null;
          }

          return {
            pageNumber,
            text: raw.str,
            x:
              typeof raw
                .transform[4] ===
              "number"
                ? raw.transform[4]
                : 0,
            y:
              typeof raw
                .transform[5] ===
              "number"
                ? raw.transform[5]
                : 0,
            width:
              Number(raw.width) ||
              0,
            height:
              Number(raw.height) ||
              Math.abs(
                Number(
                  raw.transform[3]
                )
              ) ||
              0,
          };
        })
        .filter(
          (
            item
          ): item is Omit<
            PdfTextSpan,
            "color"
          > => Boolean(item)
        );
    const segments =
      buildPdfTextColorSegments(
        operatorList as {
          fnArray: number[];
          argsArray: unknown[];
        },
        pdfjs.OPS as Record<
          string,
          number
        >
      );

    allSpans.push(
      ...assignColorsToTextSpans({
        spans: rawSpans,
        segments,
      })
    );
  }

  const lines =
    groupPdfTextLines(
      allSpans
    );
  const candidates:
    PdfColorQuestionCandidate[] =
    [];
  let currentSection:
    PdfColorAnswerResult["questionType"] | null =
    null;
  let currentQuestion:
    | PdfMutableColorQuestionCandidate
    | null =
    null;
  let globalQuestionNumber =
    0;

  const finishCurrentQuestion =
    () => {
      if (!currentQuestion) {
        return;
      }

      candidates.push({
        sourceNumber:
          currentQuestion
            .sourceNumber,
        questionType:
          currentQuestion
            .questionType,
        optionLines:
          currentQuestion
            .optionLines,
      });
    };

  const appendOptionSegments =
    (
      line: PdfTextLine,
      allowInlineSingle =
        false
    ) => {
      if (!currentQuestion) {
        return false;
      }

      const question =
        currentQuestion;
      const optionSegments =
        splitPdfLineByOptionMarkers(
          line,
          {
            allowInlineSingle,
          }
        );

      if (
        optionSegments.length ===
        0
      ) {
        return false;
      }

      optionSegments.forEach(
        (segment) => {
          question.currentOption =
            segment.optionId;
          const optionLines =
            question.optionLines.get(
              segment.optionId
            ) ?? [];
          optionLines.push(
            segment.line
          );
          question.optionLines.set(
            segment.optionId,
            optionLines
          );
        }
      );

      return true;
    };

  const textResults =
    () =>
      candidates.map(
        (candidate) =>
          buildPdfColorAnswerResult({
            sourceNumber:
              candidate.sourceNumber,
            questionType:
              candidate.questionType,
            optionLines:
              candidate.optionLines,
          })
      );

  lines.forEach((line) => {
    const sectionType =
      detectPdfSectionQuestionType(
        line.text
      );

    if (sectionType) {
      finishCurrentQuestion();
      currentQuestion = null;
      currentSection =
        sectionType ===
        "short_answer"
          ? null
          : sectionType;
      return;
    }

    const questionMatch =
      line.text.match(
        /^\s*(?:câu|cau|question)\s*\d+\s*[\.\:\-\)]?/i
      );

    if (questionMatch) {
      finishCurrentQuestion();
      globalQuestionNumber +=
        1;
      currentQuestion =
        currentSection
          ? {
              sourceNumber:
                globalQuestionNumber,
              questionType:
                currentSection,
              optionLines:
                new Map(),
              currentOption:
                null,
            }
          : null;
      appendOptionSegments(
        line,
        true
      );
      return;
    }

    if (!currentQuestion) {
      return;
    }

    if (
      appendOptionSegments(
        line
      )
    ) {
      return;
    }

    if (
      currentQuestion.currentOption
    ) {
      const optionLines =
        currentQuestion.optionLines.get(
          currentQuestion.currentOption
        ) ?? [];
      optionLines.push(line);
      currentQuestion.optionLines.set(
        currentQuestion.currentOption,
        optionLines
      );
    }
  });

  finishCurrentQuestion();

  return applyPdfVisualColorFallback({
    file,
    candidates,
    textResults:
      textResults(),
  });
}

function applyPdfColorResultToQuestion({
  item,
  result,
}: {
  item: ParsedImportQuestion;
  result: PdfColorAnswerResult;
}): ParsedImportQuestion {
  const baseItem = {
    ...item,
    answerSource:
      result.answerSource,
    answer_source:
      result.answerSource,
    needsManualReview:
      result.needsManualReview,
    needs_manual_review:
      result.needsManualReview,
    reviewReason:
      result.reviewReason,
  };

  if (
    result.answerSource !==
    "pdf_color"
  ) {
    return baseItem;
  }

  if (
    item.question.type ===
      "single_choice" &&
    result.questionType ===
      "single_choice"
  ) {
    const correctOptionId =
      (
        [
          "A",
          "B",
          "C",
          "D",
        ] as const
      ).find(
        (id) =>
          result.answers[id]
      );

    if (!correctOptionId) {
      return {
        ...baseItem,
        answerSource:
          "manual_required",
        answer_source:
          "manual_required",
        needsManualReview:
          true,
        needs_manual_review:
          true,
        reviewReason:
          "Trắc nghiệm A/B/C/D không xác định được đúng 1 phương án màu.",
      };
    }

    return {
      ...baseItem,
      question: {
        ...item.question,
        correctOptionId,
        explanation:
          removeStalePdfAnswerNotice(
            item.question
              .explanation
          ),
      },
    };
  }

  if (
    item.question.type ===
      "true_false_group" &&
    result.questionType ===
      "true_false_group"
  ) {
    return {
      ...baseItem,
      question: {
        ...item.question,
        explanation:
          removeStalePdfAnswerNotice(
            item.question
              .explanation
          ),
        statements:
          item.question.statements.map(
            (statement) => ({
              ...statement,
              correctAnswer:
                result.answers[
                  statement.id
                ] ??
                statement.correctAnswer,
            })
          ),
      },
    };
  }

  return {
    ...baseItem,
    answerSource:
      "manual_required",
    answer_source:
      "manual_required",
    needsManualReview:
      true,
    needs_manual_review:
      true,
    reviewReason:
      "Loại câu AI trích xuất không khớp vùng đáp án màu trong PDF.",
  };
}

function isStalePdfAnswerWarning(
  warning:
    ImportQuestionsResponse["warnings"][number]
) {
  return /(?:thiếu đáp án|chưa đọc được đáp án|chưa xác định được đáp án|tạm gán|ai nhận diện|tự suy luận)/i.test(
    warning.message
  );
}

function removeStalePdfAnswerNotice(
  explanation: string | undefined
) {
  const cleaned =
    explanation
      ?.split(/\r?\n/)
      .filter(
        (line) =>
          !/^cảnh báo import:\s*(?:chưa đọc được đáp án|chưa xác định được đáp án|đã tạm gán|đáp án hiện tại do ai)/i.test(
            line.trim()
          )
      )
      .join("\n")
      .trim();

  return cleaned || undefined;
}

function compactManualReviewWarnings(
  warnings:
    ImportQuestionsResponse["warnings"]
) {
  if (warnings.length <= 8) {
    return warnings;
  }

  const questionNumbers =
    warnings
      .map(
        (warning) =>
          warning.questionNumber
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
            "number" &&
          Number.isFinite(
            value
          )
      );
  const previewNumbers =
    questionNumbers
      .slice(0, 12)
      .join(", ");
  const remainingCount =
    Math.max(
      0,
      questionNumbers.length -
        12
    );

  return [
    {
      message:
        `${warnings.length} câu cần giáo viên xác nhận đáp án sau bước đọc màu PDF${
          previewNumbers
            ? `: ${previewNumbers}${
                remainingCount > 0
                  ? ` và ${remainingCount} câu khác`
                  : ""
              }`
            : ""
        }. Các câu này đang bị chặn khỏi ngân hàng chính thức cho tới khi được xác nhận.`,
    },
  ];
}

async function applyPdfColorAnswersToParsedQuestions({
  file,
  parsedQuestions,
}: {
  file: File;
  parsedQuestions:
    ParsedQuestionBatch;
}): Promise<ParsedQuestionBatch> {
  let colorResults:
    PdfColorAnswerResult[] = [];

  try {
    colorResults =
      await extractPdfColorAnswers(
        file
      );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Không đọc được metadata màu trong PDF.";

    return {
      questions:
        parsedQuestions.questions.map(
          (item) => {
            if (
              item.question.type !==
                "single_choice" &&
              item.question.type !==
                "true_false_group"
            ) {
              return item;
            }

            return {
              ...item,
              answerSource:
                "manual_required",
              answer_source:
                "manual_required",
              needsManualReview:
                true,
              needs_manual_review:
                true,
              reviewReason:
                "PDF không có metadata màu khả dụng; cần giáo viên xác nhận đáp án.",
            };
          }
        ),
      warnings: [
        ...parsedQuestions.warnings,
        {
          message:
            `Không đọc được màu đáp án từ PDF: ${reason}`,
        },
      ],
    };
  }

  const resultsBySource =
    new Map(
      colorResults.map(
        (result) => [
          result.sourceNumber,
          result,
        ]
      )
    );
  const resultsByType = {
    single_choice:
      colorResults.filter(
        (result) =>
          result.questionType ===
          "single_choice"
      ),
    true_false_group:
      colorResults.filter(
        (result) =>
          result.questionType ===
          "true_false_group"
      ),
  };
  const usedResults =
    new Set<PdfColorAnswerResult>();
  const typeCursor = {
    single_choice: 0,
    true_false_group: 0,
  };
  const handledSourceNumbers =
    new Set<number>();
  const manualWarnings:
    ImportQuestionsResponse["warnings"] =
      [];

  const questions:
    ParsedImportQuestion[] =
    parsedQuestions.questions.map(
      (item) => {
        if (
          item.question.type !==
            "single_choice" &&
          item.question.type !==
            "true_false_group"
        ) {
          return item;
        }

        handledSourceNumbers.add(
          item.sourceNumber
        );

        let result =
          resultsBySource.get(
            item.sourceNumber
          );

        if (
          result &&
          result.questionType !==
            item.question.type
        ) {
          result = undefined;
        }

        if (!result) {
          const queue =
            resultsByType[
              item.question.type
            ];

          while (
            typeCursor[
              item.question.type
            ] < queue.length &&
            usedResults.has(
              queue[
                typeCursor[
                  item.question.type
                ]
              ]
            )
          ) {
            typeCursor[
              item.question.type
            ] += 1;
          }

          result =
            queue[
              typeCursor[
                item.question.type
              ]
            ];
          typeCursor[
            item.question.type
          ] += 1;
        }

        if (!result) {
          manualWarnings.push({
            questionNumber:
              item.sourceNumber,
            message:
              "Không tìm thấy metadata màu tương ứng trong PDF; cần giáo viên xác nhận đáp án trước khi sử dụng.",
          });

          return {
            ...item,
            answerSource:
              "manual_required",
            answer_source:
              "manual_required",
            needsManualReview:
              true,
            needs_manual_review:
              true,
            reviewReason:
              "Không tìm thấy metadata màu tương ứng trong PDF.",
          };
        }

        usedResults.add(result);
        const nextItem =
          applyPdfColorResultToQuestion({
            item,
            result,
          });

        if (
          result.answerSource !==
          "pdf_color"
        ) {
          manualWarnings.push({
            questionNumber:
              item.sourceNumber,
            message:
              result.reviewReason ??
              "Chưa xác định được đáp án từ màu PDF; cần giáo viên xác nhận trước khi sử dụng.",
          });
        }

        return nextItem;
      }
    );

  return {
    questions,
    warnings: [
      ...parsedQuestions.warnings.filter(
        (warning) =>
          !(
            warning.questionNumber &&
            handledSourceNumbers.has(
              warning.questionNumber
            ) &&
            isStalePdfAnswerWarning(
              warning
            )
          )
      ),
      ...compactManualReviewWarnings(
        manualWarnings
      ),
    ],
  };
}

function buildImageRegionPrompt(
  hintQuestions:
    PdfImageHintQuestion[]
) {
  const targetList =
    hintQuestions.length > 0
      ? hintQuestions
          .map(
            (item) =>
              `- sourceNumber ${item.sourceNumber}: ${item.content}\n  Gợi ý ảnh cần tìm: ${item.imageHint}`
          )
          .join("\n")
      : "- Không có danh sách cụ thể; tự phát hiện câu cần hình/bảng.";

  return `Bạn đang hỗ trợ import đề kiểm tra vào KIEMTRA.AI.
Nhiệm vụ: quan sát các ảnh trang PDF bên dưới và xác định vùng hình minh họa/đồ thị/sơ đồ/bảng cần gắn vào từng câu hỏi.

ƯU TIÊN BẮT BUỘC:
Chỉ tập trung tìm vùng ảnh/bảng cho các câu trong danh sách sau. Trường sourceNumber trong JSON trả về PHẢI dùng đúng sourceNumber bên dưới, không dùng số câu gốc trong PDF nếu khác.

${targetList}

Chỉ trả về JSON array thuần, không Markdown, không giải thích.
Mỗi phần tử có dạng:
{
  "sourceNumber": 1,
  "pageNumber": 1,
  "x": 120,
  "y": 180,
  "width": 320,
  "height": 240,
  "confidence": 0.96,
  "description": "hình lăng trụ ABC.A'B'C'"
}

Quy tắc tọa độ:
- x, y, width, height dùng hệ tọa độ chuẩn hóa 0-1000 theo kích thước trang ảnh.
- x, y là góc trên bên trái vùng cần crop.
- Chỉ lấy vùng hình/bảng cần nhìn để làm câu hỏi, không crop nguyên câu chữ nếu không cần.
- Không trả vùng chỉ chứa lại câu chữ hoặc các phương án đã nhận dạng được.
- Chỉ trả vùng khi confidence >= 0.92; không chắc thì bỏ qua, tuyệt đối không đoán.
- Mọi bảng đều cần crop, kể cả bảng đơn giản; không làm phẳng hàng/cột thành văn bản.
- Bảng có công thức/ký hiệu/căn chỉnh nhiều tầng, biểu đồ, sơ đồ sinh học, hình học và đồ thị hàm số phải lấy đủ đường viền và nhãn liên quan.
- Nếu câu trong danh sách có câu chữ như "hình bên", "sơ đồ", "bảng sau", "đồ thị", "hình vẽ" thì phải cố gắng tìm vùng tương ứng trên trang PDF.
- Nếu thật sự không tìm thấy vùng tương ứng cho một câu trong danh sách thì không trả phần tử cho câu đó.
- Nếu một câu có nhiều hình gần nhau trên cùng trang, trả một vùng bao quanh đủ các hình.
- Nếu không có vùng nào cần crop, trả [].
`;
}

function normalizeImageRegion(
  value: unknown
): PdfImageRegion | null {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return null;
  }

  const raw =
    value as Record<
      string,
      unknown
    >;

  const sourceNumber =
    Math.round(
      clampNumber(
        raw.sourceNumber,
        1,
        1000
      )
    );
  const pageNumber =
    Math.round(
      clampNumber(
        raw.pageNumber,
        1,
        1000
      )
    );
  const x =
    clampNumber(
      raw.x,
      0,
      1000
    );
  const y =
    clampNumber(
      raw.y,
      0,
      1000
    );
  const width =
    clampNumber(
      raw.width,
      0,
      1000
    );
  const height =
    clampNumber(
      raw.height,
      0,
      1000
    );
  const confidence =
    clampNumber(
      raw.confidence,
      0,
      1
    );

  if (
    width < 20 ||
    height < 20 ||
    confidence < 0.92
  ) {
    return null;
  }

  return {
    sourceNumber,
    pageNumber,
    x,
    y,
    width,
    height,
    confidence,
    evidence:
      "explicit_visual_cue",
    description:
      typeof raw.description ===
      "string"
        ? raw.description.trim()
        : undefined,
  };
}

async function detectPdfImageRegions(
  pages: PdfPageImage[],
  hintQuestions:
    PdfImageHintQuestion[]
): Promise<PdfImageRegion[]> {
  if (hintQuestions.length === 0) {
    return [];
  }

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return [];
  }

  const model =
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL;

  const response =
    await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    buildImageRegionPrompt(
                      hintQuestions
                    ),
                },
                ...pages.flatMap(
                  (page) => [
                    {
                      text: `PAGE ${page.pageNumber}`,
                    },
                    {
                      inlineData: {
                        mimeType:
                          "image/png",
                        data:
                          page.base64,
                      },
                    },
                  ]
                ),
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        }),
      }
    );

  const data =
    (await response.json()) as
      GeminiResponse;

  if (!response.ok) {
    console.error(
      "PDF image region detection failed:",
      getGeminiErrorMessage(
        data,
        "AI không phát hiện được vùng ảnh trong PDF."
      )
    );
    return [];
  }

  const aiText =
    data.candidates?.[0]?.content
      ?.parts?.map(
        (part) => part.text ?? ""
      )
      .join("")
      .trim();

  if (!aiText) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(
        extractJsonArrayText(
          aiText
        )
      ) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(
        normalizeImageRegion
      )
      .filter(
        (
          region
        ): region is PdfImageRegion =>
          Boolean(region)
      )
      .slice(0, 60);
  } catch (error) {
    console.error(
      "Invalid PDF image region JSON:",
      error
    );
    return [];
  }
}

function groupImageRegionsByQuestion(
  regions:
    PdfImageRegion[]
) {
  const grouped =
    new Map<
      number,
      PdfImageRegion
    >();

  regions.forEach(
    (region) => {
      const current =
        grouped.get(
          region.sourceNumber
        );

      if (!current) {
        grouped.set(
          region.sourceNumber,
          region
        );
        return;
      }

      if (
        current.pageNumber !==
        region.pageNumber
      ) {
        return;
      }

      const currentArea =
        current.width *
        current.height;
      const nextArea =
        region.width *
        region.height;
      const shouldReplace =
        region.confidence >
          current.confidence ||
        (region.confidence ===
          current.confidence &&
          nextArea < currentArea);

      if (shouldReplace) {
        grouped.set(
          region.sourceNumber,
          region
        );
      }
    }
  );

  return grouped;
}

async function cropPdfImageRegion({
  page,
  region,
  paddingRatio = 0.006,
  minimumPadding = 10,
}: {
  page: PdfPageImage;
  region: Pick<
    PdfImageRegion,
    | "pageNumber"
    | "x"
    | "y"
    | "width"
    | "height"
  >;
  paddingRatio?: number;
  minimumPadding?: number;
}) {
  const sharp =
    (
      await import(
        "sharp"
      )
    ).default;

  const padding =
    Math.max(
      minimumPadding,
      Math.round(
        Math.min(
          page.width,
          page.height
        ) * paddingRatio
      )
    );
  const left =
    Math.max(
      0,
      Math.floor(
        (region.x / 1000) *
          page.width
      ) - padding
    );
  const top =
    Math.max(
      0,
      Math.floor(
        (region.y / 1000) *
          page.height
      ) - padding
    );
  const right =
    Math.min(
      page.width,
      Math.ceil(
        ((region.x +
          region.width) /
          1000) *
          page.width
      ) + padding
    );
  const bottom =
    Math.min(
      page.height,
      Math.ceil(
        ((region.y +
          region.height) /
          1000) *
          page.height
      ) + padding
    );
  const width =
    right - left;
  const height =
    bottom - top;

  if (
    width < 24 ||
    height < 24
  ) {
    throw new Error(
      "Vùng ảnh quá nhỏ để crop."
    );
  }

  return sharp(
    page.pngBuffer
  )
    .extract({
      left,
      top,
      width,
      height,
    })
    .png()
    .toBuffer();
}

function needsPdfVisualFallback(
  item: ParsedImportQuestion
) {
  const question = item.question;

  if (
    item.visualFallbackRecommended
  ) {
    return true;
  }

  if (
    !isMeaningfulImportedText(
      question.content
    )
  ) {
    return true;
  }

  if (
    /(?:\|\s*){4,}|(?:^|\n)\s*[.,;:|_-]\s*(?:\n|$)/u.test(
      question.content
    )
  ) {
    return true;
  }

  if (
    question.type ===
    "single_choice"
  ) {
    return question.options.some(
      (option) =>
        !isMeaningfulImportedText(
          option.content
        )
    );
  }

  if (
    question.type ===
    "true_false_group"
  ) {
    return question.statements.some(
      (statement) =>
        !isMeaningfulImportedText(
          statement.content
        )
    );
  }

  return false;
}

function isFormulaAwareImportCandidate(
  item: ParsedImportQuestion,
  blocks: PdfDetectedBlock[] = []
) {
  return shouldRouteToFormulaOcr({
    blocks,
    subject:
      normalizeSubjectName(
        item.question.subject
      ),
    hasUnreadableContent:
      needsPdfVisualFallback(
        item
      ),
  });
}

function parsePdfFormulaRepairs(
  value: string
): PdfFormulaRepair[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(
      extractJsonArrayText(value)
    );
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap(
    (entry) => {
      if (
        !entry ||
        typeof entry !== "object"
      ) {
        return [];
      }

      const record = entry as Record<
        string,
        unknown
      >;
      const sourceNumber = Number(
        record.sourceNumber
      );

      if (
        !Number.isInteger(
          sourceNumber
        ) ||
        sourceNumber < 1
      ) {
        return [];
      }

      const readLabeledContent = (
        input: unknown
      ) =>
        Array.isArray(input)
          ? input.flatMap(
              (item) => {
                if (
                  !item ||
                  typeof item !==
                    "object"
                ) {
                  return [];
                }

                const itemRecord =
                  item as Record<
                    string,
                    unknown
                  >;
                const id = String(
                  itemRecord.id ?? ""
                ).toUpperCase();
                const content =
                  typeof itemRecord.content ===
                  "string"
                    ? itemRecord.content.trim()
                    : "";

                return /^(?:A|B|C|D)$/.test(
                  id
                )
                  ? [
                      {
                        id: id as
                          | "A"
                          | "B"
                          | "C"
                          | "D",
                        content,
                      },
                    ]
                  : [];
              }
            )
          : undefined;

      return [
        {
          sourceNumber,
          confidence: clampNumber(
            record.confidence,
            0,
            1
          ),
          visualFallbackRecommended:
            record.visualFallbackRecommended ===
            true,
          content:
            typeof record.content ===
            "string"
              ? record.content.trim()
              : undefined,
          options:
            readLabeledContent(
              record.options
            ),
          statements:
            readLabeledContent(
              record.statements
            ),
          acceptedAnswers:
            Array.isArray(
              record.acceptedAnswers
            )
              ? record.acceptedAnswers.filter(
                  (
                    answer
                  ): answer is string =>
                    typeof answer ===
                      "string" &&
                    isMeaningfulImportedText(
                      answer
                    )
                )
              : undefined,
        },
      ];
    }
  );
}

function parsePdfOptionFormulaRepairs(
  value: string
): PdfOptionFormulaRepair[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(
      extractJsonArrayText(value)
    );
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object"
    ) {
      return [];
    }

    const record = entry as Record<
      string,
      unknown
    >;
    const sourceNumber = Number(
      record.sourceNumber
    );
    const optionId = String(
      record.optionId ?? ""
    ).toUpperCase();
    const rawContent =
      typeof record.content ===
      "string"
        ? record.content.trim()
        : "";

    if (
      !Number.isInteger(
        sourceNumber
      ) ||
      sourceNumber < 1 ||
      !/^[A-D]$/.test(optionId)
    ) {
      return [];
    }

    return [
      {
        sourceNumber,
        optionId: optionId as
          | "A"
          | "B"
          | "C"
          | "D",
        content:
          rawContent.replace(
            new RegExp(
              `^\\s*${optionId}\\s*[.)]\\s*`,
              "i"
            ),
            ""
          ),
        confidence: clampNumber(
          record.confidence,
          0,
          1
        ),
        visualFallbackRecommended:
          record.visualFallbackRecommended ===
          true,
      },
    ];
  });
}

async function recognizePdfOptionCrops({
  crops,
  retry,
}: {
  crops: PdfOptionCrop[];
  retry: boolean;
}): Promise<
  PdfOptionFormulaRepair[]
> {
  const specialistResults =
    await recognizeFormulaImages({
      inputs: crops.map(
        (crop) => ({
          id: getPdfOptionKey(
            crop
          ),
          buffer: crop.buffer,
          mimeType: "image/png",
        })
      ),
    });

  if (
    specialistResults.length > 0
  ) {
    return specialistResults.flatMap(
      (result) => {
        const match =
          /^(\d+):([A-D])$/u.exec(
            result.id
          );

        if (!match) {
          return [];
        }

        const latex =
          result.latex.trim();
        const content =
          /^(?:\\\(|\\\[|\$|<smiles>)/u.test(
            latex
          )
            ? latex
            : `\\(${latex}\\)`;

        return [
          {
            sourceNumber: Number(
              match[1]
            ),
            optionId:
              match[2] as
                | "A"
                | "B"
                | "C"
                | "D",
            content,
            confidence:
              result.confidence,
            visualFallbackRecommended:
              result.confidence <
              0.88,
          },
        ];
      }
    );
  }

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    crops.length === 0
  ) {
    return [];
  }

  const model =
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL;
  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Nhận dạng CHÍNH XÁC từng phương án công thức từ các crop riêng. Đây là ${
                  retry
                    ? "lần retry với ảnh đã phóng lớn/tăng tương phản"
                    : "lần nhận dạng đầu tiên"
                }.

Chỉ trả JSON array:
[{"sourceNumber":12,"optionId":"A","content":"\\(15\\cdot10^5\\,\\mathrm{J}\\)","confidence":0.98,"visualFallbackRecommended":false}]

Quy tắc bắt buộc:
- Mỗi ảnh chỉ chứa một phương án. Không đưa nhãn A/B/C/D vào content.
- Vật lý/Toán dùng LaTeX trong \\( ... \\); giữ dấu phẩy thập phân, dấu nhân, phân số, căn, số mũ, chỉ số, độ và đơn vị.
- Hóa học dùng \\(\\ce{...}\\) khi phù hợp; giữ điện tích, chỉ số và mũi tên phản ứng.
- Không giải bài, không suy ra đáp án đúng, không thay đổi số liệu.
- Không bao giờ trả content là ".", dấu câu đơn hoặc chuỗi rỗng. Nếu không chắc, để content rỗng, confidence thấp và visualFallbackRecommended=true.
- confidence từ 0 đến 1 phản ánh độ chắc chắn của toàn bộ ký hiệu trong crop.`,
              },
              ...crops.flatMap(
                (crop) => [
                  {
                    text: `OPTION sourceNumber=${crop.sourceNumber}; optionId=${crop.optionId}`,
                  },
                  {
                    inlineData: {
                      mimeType:
                        "image/png",
                      data:
                        crop.buffer.toString(
                          "base64"
                        ),
                    },
                  },
                ]
              ),
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType:
            "application/json",
        },
      }),
    }
  );
  const data =
    (await response.json()) as
      GeminiResponse;

  if (!response.ok) {
    throw new Error(
      getGeminiErrorMessage(
        data,
        "AI không nhận dạng được crop phương án."
      )
    );
  }

  const output =
    data.candidates?.[0]?.content?.parts
      ?.map(
        (part) =>
          part.text ?? ""
      )
      .join("") ?? "";

  return parsePdfOptionFormulaRepairs(
    output
  );
}

async function enhancePdfOptionCrop(
  crop: PdfOptionCrop
): Promise<PdfOptionCrop> {
  const sharp =
    (
      await import("sharp")
    ).default;
  const metadata =
    await sharp(
      crop.buffer
    ).metadata();
  const targetWidth = Math.min(
    2400,
    Math.max(
      1000,
      (metadata.width ?? 500) *
        2
    )
  );
  const buffer = await sharp(
    crop.buffer
  )
    .resize({
      width: targetWidth,
      withoutEnlargement: false,
      kernel: "lanczos3",
    })
    .grayscale()
    .normalize()
    .sharpen({
      sigma: 1.2,
    })
    .png()
    .toBuffer();

  return {
    ...crop,
    buffer,
  };
}

function getPdfOptionKey({
  sourceNumber,
  optionId,
}: {
  sourceNumber: number;
  optionId: string;
}) {
  return `${sourceNumber}:${optionId}`;
}

async function repairPdfOptionsWithAi({
  file,
  questions,
}: {
  file: File;
  questions: ParsedImportQuestion[];
}): Promise<DuplicateCheckResult> {
  if (questions.length === 0) {
    return {
      questions,
      warnings: [],
    };
  }

  try {
    const geometry =
      matchPdfGeometryToQuestions(
        await extractPdfGeometry(
          file
        ),
        questions
      );
    const targets =
      questions.flatMap(
        (item) => {
          const questionBlocks =
            geometry.blocks.filter(
              (block) =>
                block.sourceNumber ===
                item.sourceNumber
            );

          const optionNeedsFormulaOcr = (
            optionId:
              | "A"
              | "B"
              | "C"
              | "D"
          ) => {
            const optionRegion =
              geometry.optionRegions.find(
                (region) =>
                  region.sourceNumber ===
                    item.sourceNumber &&
                  region.optionId ===
                    optionId
              );

            if (!optionRegion) {
              return false;
            }

            return questionBlocks.some(
              (block) => {
                if (
                  block.kind !==
                    "formula" &&
                  block.kind !==
                    "chemical_formula"
                ) {
                  return false;
                }

                const centerX =
                  block.x +
                  block.width / 2;
                const centerY =
                  block.y +
                  block.height / 2;

                return (
                  block.pageNumber ===
                    optionRegion.pageNumber &&
                  centerX >=
                    optionRegion.x &&
                  centerX <=
                    optionRegion.x +
                      optionRegion.width &&
                  centerY >=
                    optionRegion.y &&
                  centerY <=
                    optionRegion.y +
                      optionRegion.height
                );
              }
            );
          };

          return item.question.type ===
            "single_choice"
            ? item.question.options
                .filter(
                  (option) =>
                    !isMeaningfulImportedText(
                      option.content
                    ) ||
                    optionNeedsFormulaOcr(
                      option.id
                    )
                )
                .map((option) => ({
                  item,
                  option,
                }))
            : [];
        }
      );

    if (targets.length === 0) {
      return {
        questions,
        warnings: [],
      };
    }

    const regionByKey = new Map(
      geometry.optionRegions.map(
        (region) => [
          getPdfOptionKey(region),
          region,
        ]
      )
    );
    const availableTargets =
      targets
        .filter(({ item, option }) =>
          regionByKey.has(
            getPdfOptionKey({
              sourceNumber:
                item.sourceNumber,
              optionId:
                option.id,
            })
          )
        )
        .slice(0, 48);
    const pageNumbers = [
      ...new Set(
        availableTargets.flatMap(
          ({ item, option }) => {
            const region =
              regionByKey.get(
                getPdfOptionKey({
                  sourceNumber:
                    item.sourceNumber,
                  optionId:
                    option.id,
                })
              );
            return region
              ? [region.pageNumber]
              : [];
          }
        )
      ),
    ];

    if (
      availableTargets.length ===
        0 ||
      pageNumbers.length === 0
    ) {
      return {
        questions,
        warnings: [],
      };
    }

    const pages =
      await renderPdfPages(file, {
        scale: 300 / 72,
        pageNumbers,
      });
    const pageByNumber = new Map(
      pages.map((page) => [
        page.pageNumber,
        page,
      ])
    );
    const crops:
      PdfOptionCrop[] = [];

    for (const { item, option } of availableTargets) {
      const region =
        regionByKey.get(
          getPdfOptionKey({
            sourceNumber:
              item.sourceNumber,
            optionId: option.id,
          })
        );
      const page = region
        ? pageByNumber.get(
            region.pageNumber
          )
        : undefined;

      if (!region || !page) {
        continue;
      }

      crops.push({
        sourceNumber:
          item.sourceNumber,
        optionId: option.id,
        buffer:
          await cropPdfImageRegion({
            page,
            region,
            paddingRatio: 0.0015,
            minimumPadding: 2,
          }),
      });
    }

    const firstResults =
      await recognizePdfOptionCrops({
        crops,
        retry: false,
      }).catch(
        () =>
          [] as PdfOptionFormulaRepair[]
      );
    const bestResultByKey = new Map(
      firstResults.map((result) => [
        getPdfOptionKey(result),
        result,
      ])
    );
    const retryCrops = crops.filter(
      (crop) => {
        const result =
          bestResultByKey.get(
            getPdfOptionKey(crop)
          );

        return (
          !result ||
          result.confidence < 0.88 ||
          !isMeaningfulImportedText(
            result.content
          )
        );
      }
    );

    if (retryCrops.length > 0) {
      const enhancedCrops =
        await Promise.all(
          retryCrops.map(
            enhancePdfOptionCrop
          )
        );
      const retryResults =
        await recognizePdfOptionCrops({
          crops: enhancedCrops,
          retry: true,
        }).catch(
          () =>
            [] as PdfOptionFormulaRepair[]
        );

      retryResults.forEach(
        (result) => {
          const key =
            getPdfOptionKey(
              result
            );
          const current =
            bestResultByKey.get(key);

          if (
            !current ||
            result.confidence >
              current.confidence
          ) {
            bestResultByKey.set(
              key,
              result
            );
          }
        }
      );
    }

    const warningQuestionNumbers =
      new Set<number>();

    for (const { item, option } of availableTargets) {
      const key = getPdfOptionKey({
        sourceNumber:
          item.sourceNumber,
        optionId: option.id,
      });
      const result =
        bestResultByKey.get(key);
      const hasReliableText =
        Boolean(
          result &&
            result.confidence >=
              0.65 &&
            isMeaningfulImportedText(
              result.content
            )
        );

      if (
        item.question.type !==
        "single_choice"
      ) {
        continue;
      }

      item.question = {
        ...item.question,
        options:
          item.question.options.map(
            (currentOption) =>
              currentOption.id ===
              option.id
                ? {
                    ...currentOption,
                    content:
                      hasReliableText &&
                      result
                        ? result.content
                        : isMeaningfulImportedText(
                              currentOption.content
                            )
                          ? currentOption.content
                          : "",
                    imageId:
                      undefined,
                    imageUrl:
                      undefined,
                  }
                : currentOption
          ),
      };
      warningQuestionNumbers.add(
        item.sourceNumber
      );
    }

    questions.forEach((item) => {
      if (
        item.question.type !==
        "single_choice"
      ) {
        return;
      }

      const allOptionsUsable =
        item.question.options.every(
          (option) =>
            isMeaningfulImportedText(
              option.content
            )
        );

      if (
        allOptionsUsable &&
        isMeaningfulImportedText(
          item.question.content
        )
      ) {
        item.visualFallbackRecommended =
          false;
      }
    });

    return {
      questions,
      warnings: [
        ...warningQuestionNumbers,
      ].map((questionNumber) => ({
        questionNumber,
        message:
          "Đã nhận dạng công thức theo từng phương án; phương án chưa đủ tin cậy được để trống để giáo viên đối chiếu ảnh gốc.",
      })),
    };
  } catch (error) {
    return {
      questions,
      warnings: [
        {
          message:
            error instanceof Error
              ? `Không thể xử lý crop riêng từng phương án: ${error.message}`
              : "Không thể xử lý crop riêng từng phương án.",
        },
      ],
    };
  }
}

async function repairPdfFormulasWithAi({
  file,
  questions,
}: {
  file: File;
  questions: ParsedImportQuestion[];
}): Promise<DuplicateCheckResult> {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    questions.length === 0
  ) {
    return {
      questions,
      warnings: [],
    };
  }

  const candidateSourceNumbers =
    new Set<number>();

  try {
    const geometry =
      matchPdfGeometryToQuestions(
        await extractPdfGeometry(
          file
        ),
        questions
      );
    const candidates = questions
      .filter((item) =>
        isFormulaAwareImportCandidate(
          item,
          geometry.blocks.filter(
            (block) =>
              block.sourceNumber ===
              item.sourceNumber
          )
        )
      )
      .slice(0, 24);

    candidates.forEach((item) =>
      candidateSourceNumbers.add(
        item.sourceNumber
      )
    );

    if (candidates.length === 0) {
      return {
        questions,
        warnings: [],
      };
    }

    const regionByNumber =
      new Map(
        geometry.regions.map(
          (region) => [
            region.sourceNumber,
            region,
          ]
        )
      );
    const availableCandidates =
      candidates.filter((item) =>
        regionByNumber.has(
          item.sourceNumber
        )
      );
    const pageNumbers = [
      ...new Set(
        availableCandidates.flatMap(
          (item) => {
            const region =
              regionByNumber.get(
                item.sourceNumber
              );
            return region
              ? [region.pageNumber]
              : [];
          }
        )
      ),
    ];

    if (
      availableCandidates.length ===
        0 ||
      pageNumbers.length === 0
    ) {
      return {
        questions,
        warnings: [
          {
            message:
              "Không tìm thấy mốc hình học Câu N trong PDF để nhận dạng lại công thức theo từng câu.",
          },
        ],
      };
    }

    const pages =
      await renderPdfPages(file, {
        scale: 300 / 72,
        pageNumbers,
      });
    const pageByNumber = new Map(
      pages.map((page) => [
        page.pageNumber,
        page,
      ])
    );
    const imageParts: Array<
      | {
          text: string;
        }
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    > = [];
    const formulaCrops: Array<{
      id: string;
      sourceNumber: number;
      index: number;
      buffer: Buffer;
    }> = [];

    for (const item of availableCandidates) {
      const region =
        regionByNumber.get(
          item.sourceNumber
        );
      const page = region
        ? pageByNumber.get(
            region.pageNumber
          )
        : undefined;

      if (!region || !page) {
        continue;
      }

      const crop =
        await cropPdfImageRegion({
          page,
          region,
        });
      imageParts.push(
        {
          text: `ẢNH CÂU sourceNumber=${item.sourceNumber}; loại=${item.question.type}; môn=${item.question.subject}.`,
        },
        {
          inlineData: {
            mimeType: "image/png",
            data: crop.toString(
              "base64"
            ),
          },
        }
      );
    }

    for (const item of availableCandidates) {
      const formulaBlocks =
        geometry.blocks.filter(
          (block) =>
            block.sourceNumber ===
              item.sourceNumber &&
            (block.kind ===
              "formula" ||
              block.kind ===
                "chemical_formula") &&
            !geometry.optionRegions.some(
              (optionRegion) => {
                if (
                  optionRegion.sourceNumber !==
                    block.sourceNumber ||
                  optionRegion.pageNumber !==
                    block.pageNumber
                ) {
                  return false;
                }

                const centerX =
                  block.x +
                  block.width / 2;
                const centerY =
                  block.y +
                  block.height / 2;

                return (
                  centerX >=
                    optionRegion.x &&
                  centerX <=
                    optionRegion.x +
                      optionRegion.width &&
                  centerY >=
                    optionRegion.y &&
                  centerY <=
                    optionRegion.y +
                      optionRegion.height
                );
              }
            )
        );

      for (
        let index = 0;
        index < formulaBlocks.length;
        index += 1
      ) {
        const block =
          formulaBlocks[index];
        const page =
          pageByNumber.get(
            block.pageNumber
          );

        if (!page) {
          continue;
        }

        formulaCrops.push({
          id: `${item.sourceNumber}:formula:${index}`,
          sourceNumber:
            item.sourceNumber,
          index,
          buffer:
            await cropPdfImageRegion({
              page,
              region: block,
              paddingRatio:
                0.0015,
              minimumPadding: 3,
            }),
        });
      }
    }

    const specialistResults =
      await recognizeFormulaImages({
        inputs: formulaCrops.map(
          (crop) => ({
            id: crop.id,
            buffer: crop.buffer,
            mimeType: "image/png",
          })
        ),
      }).catch(() => []);
    const specialistById = new Map(
      specialistResults.map(
        (result) => [
          result.id,
          result,
        ]
      )
    );
    const specialistReference =
      specialistResults
        .filter(
          (result) =>
            result.confidence >=
            0.65
        )
        .map(
          (result) =>
            `- ${result.id}: ${result.latex}`
        )
        .join("\n");

    if (imageParts.length === 0) {
      return {
        questions,
        warnings: [],
      };
    }

    const model =
      process.env.GEMINI_MODEL ||
      DEFAULT_MODEL;
    const response = await fetch(
      `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Bạn là bộ nhận dạng công thức theo từng crop câu hỏi PDF. Trả về DUY NHẤT một JSON array, không Markdown.

Mỗi phần tử có dạng:
{"sourceNumber":1,"confidence":0.0,"visualFallbackRecommended":false,"content":"...","options":[{"id":"A","content":"..."}],"statements":[{"id":"A","content":"..."}],"acceptedAnswers":["..."]}

Quy tắc:
- Chép đúng nội dung nhìn thấy, không giải bài và không suy đoán đáp án đúng.
- Công thức Toán/Vật lý dùng LaTeX trong \\( ... \\); giữ phân số, căn, mũ, chỉ số, vector, giới hạn, tích phân và ký hiệu vô cực.
- Công thức Hóa học dùng \\(\\ce{...}\\) khi phù hợp; giữ điện tích ion, chỉ số nguyên tử, mũi tên phản ứng và trạng thái chất.
- Bảng biến thiên, ma trận, sơ đồ hoặc hình không thể biểu diễn tin cậy bằng chuỗi thì visualFallbackRecommended=true. Vẫn chép phần văn bản đọc chắc chắn.
- Trắc nghiệm phải trả đủ A/B/C/D khi ảnh có đủ bốn phương án. Đúng-sai trả statements A/B/C/D. Không đưa nhãn A/B/C/D vào content.
- confidence là độ tin cậy 0..1 của toàn bộ nội dung. Ký hiệu bị che, crop thiếu hoặc không chắc thì dưới 0.88 và bật visualFallbackRecommended.
- Nếu danh sách CÔNG THỨC TỪ SPECIALIST bên dưới có dữ liệu, phải dùng NGUYÊN VĂN LaTeX đó khi ghép lại nội dung; không OCR hay tự viết lại công thức.

CÔNG THỨC TỪ SPECIALIST:
${specialistReference || "(không có; giữ ảnh fallback nếu không chắc)"}
`,
                },
                ...imageParts,
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType:
              "application/json",
          },
        }),
      }
    );
    const data =
      (await response.json()) as
        GeminiResponse;

    if (!response.ok) {
      throw new Error(
        getGeminiErrorMessage(
          data,
          "AI không nhận dạng lại được công thức theo crop."
        )
      );
    }

    const output =
      data.candidates?.[0]?.content?.parts
        ?.map(
          (part) =>
            part.text ?? ""
        )
        .join("") ?? "";
    const repairs =
      parsePdfFormulaRepairs(
        output
      );
    const repairByNumber = new Map(
      repairs.map((repair) => [
        repair.sourceNumber,
        repair,
      ])
    );
    const warnings:
      ImportQuestionsResponse["warnings"] =
      [];

    for (const crop of formulaCrops) {
      const specialistResult =
        specialistById.get(crop.id);
      const questionRepair =
        repairByNumber.get(
          crop.sourceNumber
        );
      const hasReliableRecognition =
        Boolean(
          specialistResult &&
            specialistResult.confidence >=
              0.88
        ) ||
        Boolean(
          questionRepair &&
            questionRepair.confidence >=
              0.88 &&
            !questionRepair.visualFallbackRecommended
        );

      if (hasReliableRecognition) {
        continue;
      }

      const item = questions.find(
        (question) =>
          question.sourceNumber ===
          crop.sourceNumber
      );

      if (!item) {
        continue;
      }

      try {
        const uploaded =
          await uploadImportedQuestionImage({
            buffer: crop.buffer,
            fileName:
              `pdf-cau-${crop.sourceNumber}-cong-thuc-${crop.index + 1}.png`,
          });

        item.question = {
          ...item.question,
          contentBlocks: [
            ...(item.question
              .contentBlocks ?? [
              {
                type:
                  "text" as const,
                content:
                  item.question.content,
              },
            ]),
            {
              type:
                "image" as const,
              imageId:
                uploaded.imageId,
              imageUrl:
                uploaded.imageUrl,
              alt:
                `Công thức gốc câu ${crop.sourceNumber}`,
            },
          ],
        };
      } catch {
        item.visualFallbackRecommended =
          true;
      }
    }

    questions.forEach((item) => {
      const repair =
        repairByNumber.get(
          item.sourceNumber
        );

      if (!repair) {
        return;
      }

      const confidence =
        repair.confidence;
      const visualFallbackRecommended =
        Boolean(
          repair.visualFallbackRecommended ||
            confidence < 0.88
        );
      const repairedContent =
        repair.content;
      const nextContent =
        typeof repairedContent ===
          "string" &&
        isMeaningfulImportedText(
          repairedContent
        ) &&
        confidence >= 0.65
          ? repairedContent
          : item.question.content;

      if (
        item.question.type ===
        "single_choice"
      ) {
        const optionMap = new Map(
          repair.options?.map(
            (option) => [
              option.id,
              option.content,
            ]
          ) ?? []
        );
        const hasCompleteOptions =
          ([
            "A",
            "B",
            "C",
            "D",
          ] as const).every(
            (id) =>
              isMeaningfulImportedText(
                optionMap.get(id)
              )
          );

        item.question = {
          ...item.question,
          content: nextContent,
          options:
            hasCompleteOptions &&
            confidence >= 0.65
              ? item.question.options.map(
                  (option) => ({
                    ...option,
                    content:
                      optionMap.get(
                        option.id
                      ) ??
                      option.content,
                  })
                )
              : item.question.options,
        };
      } else if (
        item.question.type ===
        "true_false_group"
      ) {
        const statementMap =
          new Map(
            repair.statements?.map(
              (statement) => [
                statement.id,
                statement.content,
              ]
            ) ?? []
          );

        item.question = {
          ...item.question,
          content: nextContent,
          statements:
            item.question.statements.map(
              (statement) => ({
                ...statement,
                content:
                  isMeaningfulImportedText(
                    statementMap.get(
                      statement.id
                    )
                  )
                    ? statementMap.get(
                        statement.id
                      ) ??
                      statement.content
                    : statement.content,
              })
            ),
        };
      } else {
        const repairedAnswers =
          repair.acceptedAnswers;

        item.question = {
          ...item.question,
          content: nextContent,
          acceptedAnswers:
            repairedAnswers &&
            repairedAnswers.length > 0 &&
            confidence >= 0.65
              ? repairedAnswers
              : item.question
                  .acceptedAnswers,
        };
      }

      item.recognitionConfidence =
        confidence;
      item.visualFallbackRecommended =
        visualFallbackRecommended;
      warnings.push({
        questionNumber:
          item.sourceNumber,
          message:
            visualFallbackRecommended
              ? `Đã nhận dạng lại công thức theo crop (độ tin cậy ${Math.round(
                confidence * 100
              )}%); chỉ giữ ảnh ở block công thức chưa đủ tin cậy.`
            : `Đã nhận dạng lại công thức/phương án theo crop với độ tin cậy ${Math.round(
                confidence * 100
              )}%.`,
      });
    });

    return {
      questions,
      warnings,
    };
  } catch (error) {
    questions.forEach((item) => {
      if (
        candidateSourceNumbers.has(
          item.sourceNumber
        )
      ) {
        item.visualFallbackRecommended =
          true;
      }
    });

    return {
      questions,
      warnings: [
        {
          message:
            error instanceof Error
              ? `Không thể nhận dạng lại công thức theo crop: ${error.message}. Hệ thống không tự gắn ảnh toàn câu để tránh crop sai.`
              : "Không thể nhận dạng lại công thức theo crop; hệ thống không tự gắn ảnh toàn câu để tránh crop sai.",
        },
      ],
    };
  }
}

function getAppsScriptUrl(): string {
  const url =
    process.env.APPS_SCRIPT_WEB_APP_URL?.trim();

  if (!url) {
    throw new Error(
      "Thiếu biến môi trường APPS_SCRIPT_WEB_APP_URL."
    );
  }

  return url;
}

async function uploadImportedQuestionImage({
  buffer,
  fileName,
  mimeType = "image/png",
}: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}) {
  const response =
    await fetch(
      getAppsScriptUrl(),
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          action:
            "uploadQuestionImage",
          fileName,
          mimeType,
          base64Data:
            buffer.toString(
              "base64"
            ),
          questionId:
            "pdf-import",
        }),
        cache: "no-store",
        redirect: "follow",
      }
    );

  const text =
    await response.text();

  let result:
    AppsScriptUploadResponse;

  try {
    result =
      JSON.parse(
        text
      ) as AppsScriptUploadResponse;
  } catch {
    throw new Error(
      "Apps Script trả về dữ liệu upload ảnh không hợp lệ."
    );
  }

  if (
    !response.ok ||
    !result.success ||
    !result.data?.imageUrl
  ) {
    throw new Error(
      result.message ||
        "Không thể upload ảnh import lên Google Drive."
    );
  }

  return {
    imageId:
      result.data.fileId ||
      "",
    imageUrl:
      result.data.imageUrl,
  };
}

function splitDocxAssetMarkers(
  content: string
): string[] {
  return content
    .split(
      /(__KIEMTRA_DOCX_ASSET_\d+__)/g
    )
    .map((part) =>
      part.trim()
    )
    .filter(Boolean);
}

function injectDocxAssetMarkersBySourceOrder({
  questions,
  placements,
}: {
  questions:
    ParsedImportQuestion[];
  placements:
    Array<{
      marker: string;
      sourceNumber: number;
    }> |
    undefined;
}): ParsedImportQuestion[] {
  if (
    !placements ||
    placements.length === 0
  ) {
    return questions;
  }

  const markersBySourceNumber =
    new Map<number, string[]>();

  placements.forEach(
    (placement) => {
      const markers =
        markersBySourceNumber.get(
          placement.sourceNumber
        ) ?? [];

      markers.push(
        placement.marker
      );
      markersBySourceNumber.set(
        placement.sourceNumber,
        markers
      );
    }
  );

  return questions.map((item) => {
    const markers =
      markersBySourceNumber.get(
        item.sourceNumber
      );

    if (
      !markers ||
      markers.length === 0
    ) {
      return item;
    }

    const missingMarkers =
      markers.filter(
        (marker) =>
          !item.question.content.includes(
            marker
          )
      );

    if (
      missingMarkers.length === 0
    ) {
      return item;
    }

    return {
      ...item,
      question: {
        ...item.question,
        content: [
          item.question.content,
          ...missingMarkers,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    };
  });
}

async function attachDocxAssetsToQuestions({
  questions,
  assets,
}: {
  questions:
    ParsedImportQuestion[];
  assets: DocxImportAsset[];
}): Promise<DuplicateCheckResult> {
  if (
    questions.length === 0 ||
    assets.length === 0
  ) {
    return {
      questions,
      warnings: [],
    };
  }

  const assetsByMarker =
    new Map(
      assets.map((asset) => [
        asset.marker,
        asset,
      ])
    );
  const uploadedImages =
    new Map<
      string,
      {
        imageId: string;
        imageUrl: string;
      }
    >();
  const warnings:
    ImportQuestionsResponse["warnings"] =
      [];
  const enrichedQuestions:
    ParsedImportQuestion[] =
      [];

  for (const item of questions) {
    const parts =
      splitDocxAssetMarkers(
        item.question.content
      );
    const containsAsset =
      parts.some((part) =>
        assetsByMarker.has(part)
      );

    if (!containsAsset) {
      enrichedQuestions.push(item);
      continue;
    }

    const contentBlocks:
      QuestionContentBlock[] = [];
    const textParts:
      string[] = [];
    let firstImage:
      {
        imageId: string;
        imageUrl: string;
      } |
      undefined;

    for (const part of parts) {
      const asset =
        assetsByMarker.get(part);

      if (!asset) {
        textParts.push(part);
        contentBlocks.push({
          type: "text",
          content: part,
        });
        continue;
      }

      if (asset.kind === "table") {
        contentBlocks.push(
          asset.table
        );
        continue;
      }

      try {
        let uploaded =
          uploadedImages.get(
            asset.marker
          );

        if (!uploaded) {
          uploaded =
            await uploadImportedQuestionImage({
              buffer:
                asset.buffer,
              fileName:
                `docx-${item.sourceNumber}-${asset.fileName}`,
              mimeType:
                asset.mimeType,
            });
          uploadedImages.set(
            asset.marker,
            uploaded
          );
        }

        firstImage ??=
          uploaded;
        contentBlocks.push({
          type: "image",
          imageId:
            uploaded.imageId,
          imageUrl:
            uploaded.imageUrl,
          alt:
            `Hình minh họa câu ${item.sourceNumber}`,
        });
      } catch (error) {
        warnings.push({
          questionNumber:
            item.sourceNumber,
          message:
            error instanceof Error
              ? `Không tải được ảnh nhúng từ Word: ${error.message}`
              : "Không tải được ảnh nhúng từ Word.",
        });
      }
    }

    const content =
      textParts
        .join("\n")
        .trim();

    enrichedQuestions.push({
      ...item,
      question: {
        ...item.question,
        content:
          content ||
          item.question.content
            .replace(
              /__KIEMTRA_DOCX_ASSET_\d+__/g,
              ""
            )
            .trim(),
        contentBlocks,
        questionImageId:
          firstImage?.imageId ??
          item.question.questionImageId,
        questionImageUrl:
          firstImage?.imageUrl ??
          item.question.questionImageUrl,
      },
    });

    const tableCount =
      contentBlocks.filter(
        (block) =>
          block.type === "table"
      ).length;
    const imageCount =
      contentBlocks.filter(
        (block) =>
          block.type === "image"
      ).length;

    warnings.push({
      questionNumber:
        item.sourceNumber,
      message:
        `Đã giữ nguyên ${tableCount} bảng và gắn ${imageCount} hình từ file Word vào câu hỏi.`,
    });
  }

  return {
    questions:
      enrichedQuestions,
    warnings,
  };
}

async function attachPdfImagesToQuestions({
  file,
  questions,
}: {
  file: File;
  questions:
    ParsedImportQuestion[];
}): Promise<DuplicateCheckResult> {
  const warnings:
    ImportQuestionsResponse["warnings"] =
    [];

  if (
    questions.length === 0
  ) {
    return {
      questions,
      warnings,
    };
  }

  try {
    const hintQuestions =
      buildPdfImageHintQuestions(
        questions
      );
    const [
      rawGeometry,
      detectionPages,
    ] = await Promise.all([
      extractPdfGeometry(file),
      await renderPdfPages(
        file
      ),
    ]);
    const geometry =
      matchPdfGeometryToQuestions(
        rawGeometry,
        questions
      );
    const [
      regions,
      ruledTableRegions,
    ] = await Promise.all([
      detectPdfImageRegions(
        detectionPages,
        hintQuestions
      ),
      detectPdfRuledTableRegions({
        pages: detectionPages,
        questionRegions:
          geometry.regions,
      }),
    ]);
    const detectedRegionByQuestion =
      groupImageRegionsByQuestion(
        regions
      );
    const ruledTableByQuestion =
      groupImageRegionsByQuestion(
        ruledTableRegions
      );
    const questionRegionByNumber =
      new Map(
        geometry.regions.map(
          (region) => [
            region.sourceNumber,
            region,
          ]
        )
      );
    const regionByQuestion =
      new Map<
        number,
        PdfImageRegion
      >();

    questions.forEach((item) => {
      if (
        hasAttachedQuestionVisual(
          item
        )
      ) {
        return;
      }

      const questionRegion =
        questionRegionByNumber.get(
          item.sourceNumber
        );

      if (!questionRegion) {
        return;
      }

      const candidates = [
        ruledTableByQuestion.get(
          item.sourceNumber
        ),
        detectedRegionByQuestion.get(
          item.sourceNumber
        ),
      ]
        .filter(
          (
            region
          ): region is PdfImageRegion =>
            Boolean(region)
        )
        .filter((candidate) =>
          verifyPdfCropCandidate({
            candidate,
            questionRegion,
          })
        )
        .sort(
          (left, right) =>
            right.confidence -
              left.confidence ||
            left.width *
                left.height -
              right.width *
                right.height
        );
      const candidate =
        candidates[0];

      if (candidate) {
        regionByQuestion.set(
          item.sourceNumber,
          constrainPdfRegionToQuestion(
            candidate,
            questionRegion,
            3
          )
        );
      }
    });
    const targetPageNumbers = [
      ...new Set(
        Array.from(
          regionByQuestion.values()
        ).map(
          (region) =>
            region.pageNumber
        )
      ),
    ];
    const pages =
      targetPageNumbers.length > 0
        ? await renderPdfPages(
            file,
            {
              scale: 300 / 72,
              pageNumbers:
                targetPageNumbers,
            }
          )
        : [];
    const pageByNumber =
      new Map(
        pages.map(
          (page) => [
            page.pageNumber,
            page,
          ]
        )
      );

    for (const item of questions) {
      if (
        hasAttachedQuestionVisual(
          item
        )
      ) {
        continue;
      }

      const region =
        regionByQuestion.get(
          item.sourceNumber
        );

      if (!region) {
        if (
          extractImageHint(
            item.question.content
          ) ||
          hasExplicitPdfVisualCue(
            removeImageHintLines(
              item.question.content
            )
          )
        ) {
          warnings.push({
            questionNumber:
              item.sourceNumber,
            message:
              "Không tự gắn ảnh vì chưa tìm được vùng crop đủ tin cậy và đúng danh tính câu hỏi; vui lòng đối chiếu ảnh gốc tại câu này.",
          });
        }

        continue;
      }

      const page =
        pageByNumber.get(
          region.pageNumber
        );

      if (!page) {
        warnings.push({
          questionNumber:
            item.sourceNumber,
          message:
            "AI phát hiện hình minh họa nhưng trang PDF không nằm trong phạm vi xử lý.",
        });
        continue;
      }

      try {
        const croppedImage =
          await cropPdfImageRegion({
            page,
            region,
          });
        const uploaded =
          await uploadImportedQuestionImage({
            buffer:
              croppedImage,
            fileName:
              `pdf-cau-${item.sourceNumber}.png`,
          });

        item.question = {
          ...item.question,
          content:
            removeImageHintLines(
              item.question.content
            ) ||
            item.question.content,
          contentBlocks: [
            ...(item.question
              .contentBlocks ?? [
              {
                type:
                  "text" as const,
                content:
                  removeImageHintLines(
                    item.question.content
                  ) ||
                  item.question.content,
              },
            ]),
            {
              type:
                "image" as const,
              imageId:
                uploaded.imageId,
              imageUrl:
                uploaded.imageUrl,
              alt:
                region.description ||
                `Hình hoặc bảng minh họa câu ${item.sourceNumber}`,
            },
          ],
          questionImageId:
            uploaded.imageId,
          questionImageUrl:
            uploaded.imageUrl,
        };

        warnings.push({
          questionNumber:
            item.sourceNumber,
          message:
            region.evidence ===
            "table_border"
              ? "Đã giữ bảng có đường kẻ bằng crop 300 DPI sau khi xác minh đủ đường viền và đúng ranh giới câu hỏi."
              : "Đã tự crop đúng vùng hình minh họa ở 300 DPI sau khi xác minh danh tính và ranh giới câu hỏi.",
        });
      } catch (error) {
        warnings.push({
          questionNumber:
            item.sourceNumber,
          message:
            error instanceof Error
              ? `Không tự gắn được ảnh minh họa: ${error.message}`
              : "Không tự gắn được ảnh minh họa từ PDF.",
        });
      }
    }
  } catch (error) {
    warnings.push({
      message:
        error instanceof Error
          ? `Không thể tự tách ảnh từ PDF: ${error.message}`
          : "Không thể tự tách ảnh từ PDF.",
    });
  }

  return {
    questions,
    warnings,
  };
}

function buildSkippedPdfImageAttachWarnings(
  questions:
    ParsedImportQuestion[]
): ImportQuestionsResponse["warnings"] {
  if (questions.length === 0) {
    return [];
  }

  return [
    {
      message:
        "Hệ thống đã bỏ qua bước tự phát hiện và crop bảng/hình PDF vì PDF_IMPORT_AUTO_ATTACH_IMAGES đang tắt.",
    },
  ];
}

export async function POST(
  request: Request
) {
  try {
    const teacher =
      await getCurrentTeacher(
        request
      );

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );
    const docxAssetFile =
      formData.get(
        "docxAssetFile"
      ) ??
      formData.get(
        "assetFile"
      );

    if (
      !(file instanceof File)
    ) {
      return errorResponse(
        "Vui lòng chọn file cần nhập.",
        400
      );
    }

    const parsedFile =
      await parseImportFile(
        file,
        {
          docxAssetFile:
            docxAssetFile instanceof
            File
              ? docxAssetFile
              : undefined,
        }
      );

    let parsedQuestions:
      ParsedQuestionBatch;

    if (
      parsedFile.extension ===
      "pdf"
    ) {
      const normalizedPdfText =
        await normalizePdfWithAi(
          file
        );

      parsedQuestions =
        parseImportedQuestions(
          normalizedPdfText
        );

      const criticalWarnings =
        getCriticalImportWarnings(
          parsedQuestions
        );

      if (
        criticalWarnings.length >
        0
      ) {
        try {
          const repairedText =
            await repairNormalizedPdfWithAi({
              file,
              normalizedText:
                normalizedPdfText,
              warnings:
                criticalWarnings,
            });
          const repairedQuestions =
            parseImportedQuestions(
              repairedText
            );
          const expectedQuestionCount =
            Math.max(
              getDetectedQuestionCountHint(
                parsedQuestions
              ),
              getDetectedQuestionCountHint(
                repairedQuestions
              )
            );
          const preservesQuestionCoverage =
            parsedQuestions.questions.length >=
              expectedQuestionCount ||
            repairedQuestions.questions.length >
              parsedQuestions.questions.length;

          if (
            preservesQuestionCoverage &&
            getParsedBatchQuality(
              repairedQuestions,
              expectedQuestionCount
            ) >
            getParsedBatchQuality(
              parsedQuestions,
              expectedQuestionCount
            )
          ) {
            parsedQuestions = {
              questions:
                repairedQuestions.questions,
              warnings: [
                {
                  message:
                    "Đã tự kiểm tra và sửa lại cấu trúc các câu hỏi PDF chưa hợp lệ.",
                },
                ...repairedQuestions.warnings,
              ],
            };
          }
        } catch (repairError) {
          parsedQuestions = {
            questions:
              parsedQuestions.questions,
            warnings: [
              ...parsedQuestions.warnings,
              {
                message:
                  repairError instanceof Error
                    ? `Không thể tự sửa cấu trúc PDF: ${repairError.message}`
                    : "Không thể tự sửa cấu trúc PDF.",
              },
            ],
          };
        }
      }

      parsedQuestions =
        await applyPdfColorAnswersToParsedQuestions(
          {
            file,
            parsedQuestions,
          }
        );

      const formulaRepairResult =
        await repairPdfFormulasWithAi({
          file,
          questions:
            parsedQuestions.questions,
        });

      parsedQuestions = {
        questions:
          formulaRepairResult.questions,
        warnings: [
          ...parsedQuestions.warnings,
          ...formulaRepairResult.warnings,
        ],
      };

      const optionRepairResult =
        await repairPdfOptionsWithAi({
          file,
          questions:
            parsedQuestions.questions,
        });

      parsedQuestions = {
        questions:
          optionRepairResult.questions,
        warnings: [
          ...parsedQuestions.warnings,
          ...optionRepairResult.warnings,
        ],
      };
    } else {
      parsedQuestions =
        parseImportedQuestions(
          parsedFile.rawText
        );
    }

    if (
      parsedFile.extension ===
      "pdf"
    ) {
      parsedQuestions = {
        questions:
          parsedQuestions.questions,
        warnings: [
          {
            message:
              "Đã phân tích PDF bằng AI theo layout gốc. Công thức toán được ưu tiên giữ bằng LaTeX; hình vẽ không diễn giải được sẽ có dòng ghi chú cần chèn ảnh minh họa.",
          },
          ...parsedQuestions.warnings,
        ],
      };
    }

    const shouldNormalizeWithAi =
      parsedFile.extension !==
        "pdf" &&
      parsedQuestions.questions
        .length === 0;

    if (shouldNormalizeWithAi) {
      const normalizedText =
        await normalizeImportTextWithAi(
          {
            rawText:
              parsedFile.rawText,
            fileName:
              parsedFile.fileName,
          }
        );

      const normalizedQuestions =
        parseImportedQuestions(
          normalizedText
        );

      parsedQuestions = {
        questions:
          normalizedQuestions.questions,
        warnings: [
              {
                message:
                  "Đã tự chuẩn hóa tài liệu bằng AI theo prompt import v8 trước khi nhận diện câu hỏi.",
              },
          ...normalizedQuestions.warnings,
        ],
      };
    }

    const hasDocxAssets =
      Boolean(
        parsedFile.docxAssets &&
          parsedFile.docxAssets
            .length > 0
      );

    if (hasDocxAssets) {
      const questionsWithDocxMarkers =
        parsedFile.extension ===
        "pdf"
          ? injectDocxAssetMarkersBySourceOrder(
              {
                questions:
                  parsedQuestions.questions,
                placements:
                  parsedFile.docxAssetPlacements,
              }
            )
          : parsedQuestions.questions;
      const docxAssetResult =
        await attachDocxAssetsToQuestions({
          questions:
            questionsWithDocxMarkers,
          assets:
            parsedFile.docxAssets ??
            [],
        });

      parsedQuestions = {
        questions:
          docxAssetResult.questions,
        warnings: [
          ...(parsedFile.extension ===
            "pdf"
            ? [
                {
                  message:
                    parsedFile.docxAssetFileName
                      ? `Đã dùng PDF để đọc câu hỏi/đáp án và dùng ${parsedFile.docxAssetFileName} để lấy hình minh họa nhúng từ Word.`
                      : "Đã dùng PDF để đọc câu hỏi/đáp án và dùng file Word phụ để lấy hình minh họa nhúng.",
                },
              ]
            : []),
          ...parsedQuestions.warnings,
          ...docxAssetResult.warnings,
        ],
      };
    }

    const duplicateCheck =
      await removeDuplicateQuestions(
        {
          questions:
            parsedQuestions.questions,
          ownerId:
            teacher.uid,
        }
      );

    const imageAttachResult =
      parsedFile.extension ===
      "pdf"
        ? ENABLE_PDF_IMAGE_AUTO_ATTACH
          ? await attachPdfImagesToQuestions(
            {
              file,
              questions:
                duplicateCheck.questions,
            }
          )
          : {
              questions:
                duplicateCheck.questions,
              warnings:
                buildSkippedPdfImageAttachWarnings(
                  duplicateCheck.questions
                ),
            }
        : {
            questions:
              duplicateCheck.questions,
            warnings: [],
          };

    const response:
      ImportQuestionsResponse = {
      fileName:
        parsedFile.fileName,

      totalDetected:
        imageAttachResult
          .questions.length,

      questions:
        stripAnswerImagesFromImportQuestions(
          imageAttachResult.questions
        ),

      warnings:
        [
          ...parsedQuestions.warnings,
          ...duplicateCheck.warnings,
          ...imageAttachResult.warnings,
        ],
    };

    return NextResponse.json(
      response
    );
  } catch (error) {
    return getImportErrorResponse(
      error
    );
  }
}
