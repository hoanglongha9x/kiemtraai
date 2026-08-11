import type {
  CognitiveLevel,
  QuestionDifficulty,
  QuestionOptionId,
  QuestionType,
} from "@/components/question-bank";

import {
  normalizeSubjectName,
} from "../../../../lib/subjects";

import type {
  CreateQuestionInput,
} from "../../repositories";

import type {
  ImportAnswerSource,
  ImportQuestionWarning,
  ParsedImportQuestion,
} from "../types/import-question";

import {
  isMeaningfulImportedText,
} from "./pdfGeometry";

const QUESTION_START_PATTERN =
  /^\s*(?:câu|cau|question)\s*(\d+)\s*[\.\:\-\)]?\s*(.*)$/i;

const SECTION_START_PATTERN =
  /^\s*(?:phần|phan|part)\s+([ivx]+|\d+)\b[\.\:\-\)]?\s*(.*)$/i;

const OPTION_PATTERN =
  /^\s*([A-D])\s*[\.\:\-\)]\s*(.*)$/i;

const ANSWER_PATTERN =
  /^\s*(?:đáp\s*án|dap\s*an|answer|answers?|các\s*mệnh\s*đề\s*đúng|cac\s*menh\s*de\s*dung|mệnh\s*đề\s*đúng|menh\s*de\s*dung|các\s*ý\s*đúng|cac\s*y\s*dung|ý\s*đúng|y\s*dung)\s*[\:\-]\s*(.*)$/i;

const ANSWER_KEY_HEADING_PATTERN =
  /^\s*(?:đáp\s*án|dap\s*an|answer\s*key|answers?)\s*$/i;

const ANSWER_TABLE_QUESTION_LABEL_PATTERN =
  /^\s*(?:câu|cau|question)\s*$/i;

const ANSWER_TABLE_ANSWER_LABEL_PATTERN =
  /^\s*(?:đáp\s*án|dap\s*an|đa|da|answer|answers?)\s*$/i;

const TYPE_PATTERN =
  /^\s*(?:loại|loai|type|question\s*type)\s*[\:\-]\s*(.*)$/i;

const SUBJECT_PATTERN =
  /^\s*(?:môn|mon|subject)\s*[\:\-]\s*(.*)$/i;

const GRADE_PATTERN =
  /^\s*(?:khối|khoi|lớp|lop|grade)\s*[\:\-]\s*(.*)$/i;

const TOPIC_PATTERN =
  /^\s*(?:chủ\s*đề|chu\s*de|topic)\s*[\:\-]\s*(.*)$/i;

const KNOWLEDGE_UNIT_PATTERN =
  /^\s*(?:đơn\s*vị\s*kiến\s*thức|don\s*vi\s*kien\s*thuc|knowledge\s*unit)\s*[\:\-]\s*(.*)$/i;

const SKILL_PATTERN =
  /^\s*(?:k[ỹĩ]\s*năng|ky\s*nang|ki\s*nang|skill)\s*[\:\-]\s*(.*)$/i;

const LEARNING_OUTCOME_PATTERN =
  /^\s*(?:yêu\s*cầu\s*cần\s*đạt|yeu\s*cau\s*can\s*dat|learning\s*outcome)\s*[\:\-]\s*(.*)$/i;

const DIFFICULTY_PATTERN =
  /^\s*(?:độ\s*khó|do\s*kho|difficulty)\s*[\:\-]\s*(.*)$/i;

const COGNITIVE_PATTERN =
  /^\s*(?:mức\s*độ|muc\s*do|cognitive|cognitive\s*level)\s*[\:\-]\s*(.*)$/i;

const TAGS_PATTERN =
  /^\s*(?:thẻ|the|tags?)\s*[\:\-]\s*(.*)$/i;

const EXPLANATION_PATTERN =
  /^\s*(?:giải\s*thích|giai\s*thich|explanation)\s*[\:\-]\s*(.*)$/i;

const CASE_SENSITIVE_PATTERN =
  /^\s*(?:phân\s*biệt\s*hoa\s*thường|phan\s*biet\s*hoa\s*thuong|case\s*sensitive)\s*[\:\-]\s*(.*)$/i;

const TRIM_WHITESPACE_PATTERN =
  /^\s*(?:bỏ\s*khoảng\s*trắng|bo\s*khoang\s*trang|trim\s*whitespace)\s*[\:\-]\s*(.*)$/i;

const IMAGE_HINT_LINE_PATTERN =
  /^\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa\b.*\]\s*$/i;

const TRUE_WORDS =
  new Set([
    "dung",
    "true",
    "t",
    "yes",
    "co",
  ]);

const FALSE_WORDS =
  new Set([
    "sai",
    "false",
    "f",
    "no",
    "khong",
  ]);

const QUESTION_OPTION_IDS:
  QuestionOptionId[] = [
    "A",
    "B",
    "C",
    "D",
  ];

type RawQuestionBlock = {
  sourceNumber: number;
  lines: string[];
  sectionType?: QuestionType;
  sectionIndex: number;
};

type RawTextWithAnswerKey = {
  questionText: string;
  answerKeyText: string;
};

type ParsedAnswerKey = Map<string, string>;

type ParsedMetadata = {
  explicitType?: QuestionType;
  subject: string;
  grade: string;
  topic?: string;
  knowledgeUnit?: string;
  skill?: string;
  learningOutcome?: string;
  difficulty: QuestionDifficulty;
  cognitiveLevel: CognitiveLevel;
  tags?: string[];
  explanation?: string;
  caseSensitive: boolean;
  trimWhitespace: boolean;
};

type MetadataExtractionResult = {
  metadata: ParsedMetadata;
  contentLines: string[];
  warnings: string[];
};

type QuestionParseResult = {
  question:
    CreateQuestionInput | null;
  warnings: string[];
  answerSource?:
    ImportAnswerSource;
  needsManualReview?: boolean;
  reviewReason?: string;
};

type BooleanAnswerResult = {
  content: string;
  answer:
    boolean | null;
};

type CollectedOption = {
  id: QuestionOptionId;
  content: string;
};

function normalizeLineEndings(
  value: string
): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function cleanLine(
  value: string
): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function normalizeVietnamese(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .trim();
}

function joinContent(
  current: string,
  continuation: string
): string {
  const next =
    continuation.trim();

  if (!next) {
    return current;
  }

  if (!current) {
    return next;
  }

  return `${current}\n${next}`;
}

function createImportId(
  sourceNumber: number,
  index: number
): string {
  return [
    "import",
    sourceNumber,
    index + 1,
  ].join("-");
}

function buildAnswerKeyLookupKey(
  type: QuestionType,
  sourceNumber: number
): string {
  return `${type}:${sourceNumber}`;
}

function splitTrailingAnswerKey(
  rawText: string
): RawTextWithAnswerKey {
  const lines =
    normalizeLineEndings(
      rawText
    ).split("\n");

  let questionStartCount =
    0;

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line =
      cleanLine(
        lines[index]
      );

    if (
      QUESTION_START_PATTERN.test(
        line
      )
    ) {
      questionStartCount +=
        1;
    }

    if (
      questionStartCount > 0 &&
      ANSWER_KEY_HEADING_PATTERN.test(
        line
      )
    ) {
      return {
        questionText:
          lines
            .slice(0, index)
            .join("\n"),
        answerKeyText:
          lines
            .slice(index)
            .join("\n"),
      };
    }
  }

  return {
    questionText:
      rawText,
    answerKeyText:
      "",
  };
}

function cleanAnswerKeyLine(
  value: string
): string {
  return value
    .replace(/\u00a0/g, " ")
    .trim();
}

function parseAnswerKeyQuestionNumbers(
  value: string
): number[] {
  const withoutLabel =
    value
      .replace(
        /^\s*(?:câu|cau|question)\s*[\.\:\-\)]?\s*/i,
        ""
      )
      .trim();

  if (!withoutLabel) {
    return [];
  }

  const withoutNumbers =
    withoutLabel
      .replace(/\d+/g, "")
      .replace(/[\s\t,;|\.\:\-\)]+/g, "");

  if (withoutNumbers) {
    return [];
  }

  return Array.from(
    withoutLabel.matchAll(
      /\d{1,3}/g
    )
  ).map((match) =>
    Number(match[0])
  );
}

function splitShortAnswerKeyValues(
  value: string,
  remainingCount: number
): string[] {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.includes("\t")) {
    return trimmed
      .split(/\t+/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  const delimitedValues =
    trimmed
      .split(/[;|]+/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  if (delimitedValues.length > 1) {
    return delimitedValues;
  }

  const whitespaceValues =
    trimmed
      .split(/\s+/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  if (
    remainingCount > 1 &&
    whitespaceValues.length ===
      remainingCount
  ) {
    return whitespaceValues;
  }

  return [trimmed];
}

function splitAnswerKeyValues(
  value: string,
  type: QuestionType,
  remainingCount: number
): string[] {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return [];
  }

  if (type === "short_answer") {
    return splitShortAnswerKeyValues(
      trimmed,
      remainingCount
    );
  }

  if (type === "single_choice") {
    return trimmed
      .split(/[\t,;|\s]+/)
      .map((item) =>
        item
          .replace(
            /^[\(\[]|[\)\]\.\:\-]+$/g,
            ""
          )
          .trim()
      )
      .filter((item) =>
        /^[A-D]$/i.test(item)
      )
      .map((item) =>
        item.toUpperCase()
      );
  }

  if (
    parseTrueFalseAnswers(
      trimmed
    ).size ===
    QUESTION_OPTION_IDS.length
  ) {
    return [trimmed];
  }

  const tokens =
    trimmed
      .split(/[\t,;|\s]+/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  if (
    tokens.length > 1 &&
    tokens.every(
      (token) =>
        parseTrueFalseAnswers(
          token
        ).size ===
        QUESTION_OPTION_IDS.length
    )
  ) {
    return tokens;
  }

  return [trimmed];
}

function parseGlobalAnswerKey(
  answerKeyText: string
): ParsedAnswerKey {
  const answerKey:
    ParsedAnswerKey =
    new Map();

  if (
    !answerKeyText.trim()
  ) {
    return answerKey;
  }

  const lines =
    normalizeLineEndings(
      answerKeyText
    )
      .split("\n")
      .map(
        cleanAnswerKeyLine
      )
      .filter(Boolean);

  let currentType:
    QuestionType | null =
    null;
  let pendingQuestionNumbers:
    number[] = [];

  const storeAnswers = (
    answers: string[]
  ) => {
    if (!currentType) {
      return;
    }

    const answerType =
      currentType;

    pendingQuestionNumbers.forEach(
      (
        sourceNumber,
        index
      ) => {
        const answer =
          answers[index]
            ?.trim();

        if (!answer) {
          return;
        }

        answerKey.set(
          buildAnswerKeyLookupKey(
            answerType,
            sourceNumber
          ),
          answer
        );
      }
    );
  };

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    const line =
      lines[index];
    const clean =
      cleanLine(line);
    const sectionType =
      detectSectionQuestionType(
        clean
      );

    if (sectionType) {
      currentType =
        sectionType;
      pendingQuestionNumbers =
        [];
      continue;
    }

    if (!currentType) {
      continue;
    }

    if (
      ANSWER_TABLE_QUESTION_LABEL_PATTERN.test(
        clean
      )
    ) {
      const numbers:
        number[] = [];
      let cursor =
        index + 1;

      while (
        cursor < lines.length
      ) {
        const nextLine =
          cleanLine(
            lines[cursor]
          );

        if (
          detectSectionQuestionType(
            nextLine
          ) ||
          ANSWER_TABLE_ANSWER_LABEL_PATTERN.test(
            nextLine
          )
        ) {
          break;
        }

        const nextNumbers =
          parseAnswerKeyQuestionNumbers(
            nextLine
          );

        if (
          nextNumbers.length ===
          0
        ) {
          break;
        }

        numbers.push(
          ...nextNumbers
        );
        cursor += 1;
      }

      pendingQuestionNumbers =
        numbers;
      index =
        cursor - 1;
      continue;
    }

    const headerNumbers =
      parseAnswerKeyQuestionNumbers(
        clean
      );

    if (
      /^câu|^cau|^question/i.test(
        clean
      ) &&
      headerNumbers.length > 0
    ) {
      pendingQuestionNumbers =
        headerNumbers;
      continue;
    }

    if (
      ANSWER_TABLE_ANSWER_LABEL_PATTERN.test(
        clean
      )
    ) {
      const answers:
        string[] = [];
      let cursor =
        index + 1;

      while (
        cursor < lines.length &&
        answers.length <
          pendingQuestionNumbers.length
      ) {
        const nextLine =
          lines[cursor];
        const nextClean =
          cleanLine(
            nextLine
          );

        if (
          detectSectionQuestionType(
            nextClean
          ) ||
          ANSWER_TABLE_QUESTION_LABEL_PATTERN.test(
            nextClean
          )
        ) {
          break;
        }

        answers.push(
          ...splitAnswerKeyValues(
            nextLine,
            currentType,
            pendingQuestionNumbers.length -
              answers.length
          )
        );
        cursor += 1;
      }

      storeAnswers(
        answers
      );
      pendingQuestionNumbers =
        [];
      index =
        cursor - 1;
    }
  }

  return answerKey;
}

function parseBooleanSetting(
  value: string,
  fallback: boolean
): boolean {
  const normalized =
    normalizeVietnamese(
      value
    );

  if (
    TRUE_WORDS.has(
      normalized
    )
  ) {
    return true;
  }

  if (
    FALSE_WORDS.has(
      normalized
    )
  ) {
    return false;
  }

  return fallback;
}

function parseQuestionType(
  value: string
): QuestionType | null {
  const normalized =
    normalizeVietnamese(
      value
    )
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalized.includes(
      "true false"
    ) ||
    normalized.includes(
      "dung sai"
    ) ||
    normalized.includes(
      "true false group"
    )
  ) {
    return "true_false_group";
  }

  if (
    normalized.includes(
      "single choice"
    ) ||
    normalized.includes(
      "multiple choice"
    ) ||
    normalized.includes(
      "trac nghiem"
    )
  ) {
    return "single_choice";
  }

  if (
    normalized.includes(
      "short answer"
    ) ||
    normalized.includes(
      "tra loi ngan"
    )
  ) {
    return "short_answer";
  }

  return null;
}

function parseDifficulty(
  value: string
): QuestionDifficulty | null {
  const normalized =
    normalizeVietnamese(
      value
    );

  if (
    normalized === "kho" ||
    normalized === "hard"
  ) {
    return "hard";
  }

  if (
    normalized ===
      "trung binh" ||
    normalized === "medium"
  ) {
    return "medium";
  }

  if (
    normalized === "de" ||
    normalized === "easy"
  ) {
    return "easy";
  }

  return null;
}

function parseCognitiveLevel(
  value: string
): CognitiveLevel | null {
  const normalized =
    normalizeVietnamese(
      value
    )
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalized ===
      "van dung cao" ||
    normalized ===
      "high application"
  ) {
    return "high_application";
  }

  if (
    normalized ===
      "van dung" ||
    normalized ===
      "application"
  ) {
    return "application";
  }

  if (
    normalized ===
      "thong hieu" ||
    normalized ===
      "understanding"
  ) {
    return "understanding";
  }

  if (
    normalized ===
      "nhan biet" ||
    normalized ===
      "recognition"
  ) {
    return "recognition";
  }

  return null;
}

function parseGrade(
  value: string
): string {
  const normalized =
    value
      .replace(
        /^(?:khối|khoi|lớp|lop|grade)\s*/i,
        ""
      )
      .trim();

  const numericMatch =
    normalized.match(
      /\d{1,2}/
    );

  if (numericMatch) {
    return numericMatch[0];
  }

  return normalized;
}

function parseTags(
  value: string
): string[] {
  const seen =
    new Set<string>();

  const tags:
    string[] = [];

  value
    .split(/[,;|]/)
    .map((item) =>
      item.trim()
    )
    .filter(Boolean)
    .forEach((tag) => {
      const normalized =
        normalizeVietnamese(
          tag
        );

      if (
        seen.has(
          normalized
        )
      ) {
        return;
      }

      seen.add(
        normalized
      );

      tags.push(tag);
    });

  return tags;
}

function parseSectionOrdinal(
  value: string
): number | null {
  const normalized =
    normalizeVietnamese(
      value
    );

  const numericValue =
    Number(normalized);

  if (
    Number.isInteger(
      numericValue
    )
  ) {
    return numericValue;
  }

  const romanValues =
    new Map([
      ["i", 1],
      ["ii", 2],
      ["iii", 3],
      ["iv", 4],
      ["v", 5],
      ["vi", 6],
      ["vii", 7],
      ["viii", 8],
      ["ix", 9],
      ["x", 10],
    ]);

  return (
    romanValues.get(
      normalized
    ) ?? null
  );
}

function detectSectionQuestionType(
  line: string
): QuestionType | null {
  const sectionMatch =
    line.match(
      SECTION_START_PATTERN
    );

  if (!sectionMatch) {
    return null;
  }

  const normalized =
    normalizeVietnamese(line)
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalized.includes("dung sai") ||
    normalized.includes("true false")
  ) {
    return "true_false_group";
  }

  if (
    normalized.includes("tra loi ngan") ||
    normalized.includes("short answer")
  ) {
    return "short_answer";
  }

  if (
    normalized.includes("trac nghiem") ||
    normalized.includes("nhieu phuong an") ||
    normalized.includes("multiple choice") ||
    normalized.includes("single choice")
  ) {
    return "single_choice";
  }

  const sectionOrdinal =
    parseSectionOrdinal(
      sectionMatch[1] ?? ""
    );

  if (sectionOrdinal === 1) {
    return "single_choice";
  }

  if (sectionOrdinal === 2) {
    return "true_false_group";
  }

  if (sectionOrdinal === 3) {
    return "short_answer";
  }

  return null;
}

function splitIntoQuestionBlocks(
  rawText: string
): RawQuestionBlock[] {
  const lines =
    normalizeLineEndings(
      rawText
    )
      .split("\n")
      .map(cleanLine);

  const blocks:
    RawQuestionBlock[] = [];

  let currentBlock:
    RawQuestionBlock | null =
    null;
  let currentSectionType:
    QuestionType | undefined;
  let currentSectionIndex =
    0;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const sectionType =
      detectSectionQuestionType(
        line
      );

    if (sectionType) {
      if (currentBlock) {
        blocks.push(
          currentBlock
        );
        currentBlock =
          null;
      }

      currentSectionType =
        sectionType;
      currentSectionIndex +=
        1;

      continue;
    }

    const questionMatch =
      line.match(
        QUESTION_START_PATTERN
      );

    if (questionMatch) {
      if (currentBlock) {
        blocks.push(
          currentBlock
        );
      }

      const initialContent =
        questionMatch[2]
          ?.trim() ?? "";

      currentBlock = {
        sourceNumber:
          Number(
            questionMatch[1]
          ),

        lines:
          initialContent
            ? [
                initialContent,
              ]
            : [],

        sectionType:
          currentSectionType,

        sectionIndex:
          currentSectionIndex,
      };

      continue;
    }

    if (currentBlock) {
      currentBlock.lines.push(
        line
      );
    }
  }

  if (currentBlock) {
    blocks.push(
      currentBlock
    );
  }

  return blocks;
}

function extractMetadata(
  lines: string[]
): MetadataExtractionResult {
  const metadata:
    ParsedMetadata = {
      subject:
        "Chưa phân loại",

      grade: "10",

      difficulty:
        "medium",

      cognitiveLevel:
        "recognition",

      caseSensitive:
        false,

      trimWhitespace:
        true,
    };

  const warnings:
    string[] = [];

  const contentLines:
    string[] = [];

  for (const line of lines) {
    if (
      IMAGE_HINT_LINE_PATTERN.test(
        line
      )
    ) {
      continue;
    }

    const typeMatch =
      line.match(
        TYPE_PATTERN
      );

    if (typeMatch) {
      const parsedType =
        parseQuestionType(
          typeMatch[1]
        );

      if (parsedType) {
        metadata.explicitType =
          parsedType;
      } else {
        warnings.push(
          `Không nhận diện được loại câu hỏi “${typeMatch[1].trim()}”.`
        );
      }

      continue;
    }

    const subjectMatch =
      line.match(
        SUBJECT_PATTERN
      );

    if (subjectMatch) {
      metadata.subject =
        normalizeSubjectName(
          subjectMatch[1]
        ) ||
        "Chưa phân loại";

      continue;
    }

    const gradeMatch =
      line.match(
        GRADE_PATTERN
      );

    if (gradeMatch) {
      const grade =
        parseGrade(
          gradeMatch[1]
        );

      if (grade) {
        metadata.grade =
          grade;
      } else {
        warnings.push(
          "Khối lớp đang để trống."
        );
      }

      continue;
    }

    const topicMatch =
      line.match(
        TOPIC_PATTERN
      );

    if (topicMatch) {
      metadata.topic =
        topicMatch[1]
          .trim() ||
        undefined;

      continue;
    }

    const knowledgeUnitMatch = line.match(KNOWLEDGE_UNIT_PATTERN);

    if (knowledgeUnitMatch) {
      metadata.knowledgeUnit = knowledgeUnitMatch[1].trim() || undefined;
      continue;
    }

    const skillMatch = line.match(SKILL_PATTERN);

    if (skillMatch) {
      metadata.skill = skillMatch[1].trim() || undefined;
      continue;
    }

    const learningOutcomeMatch = line.match(LEARNING_OUTCOME_PATTERN);

    if (learningOutcomeMatch) {
      metadata.learningOutcome = learningOutcomeMatch[1].trim() || undefined;
      continue;
    }

    const difficultyMatch =
      line.match(
        DIFFICULTY_PATTERN
      );

    if (difficultyMatch) {
      const difficulty =
        parseDifficulty(
          difficultyMatch[1]
        );

      if (difficulty) {
        metadata.difficulty =
          difficulty;
      } else {
        warnings.push(
          `Độ khó “${difficultyMatch[1].trim()}” không hợp lệ. Đã sử dụng mức Trung bình.`
        );
      }

      continue;
    }

    const cognitiveMatch =
      line.match(
        COGNITIVE_PATTERN
      );

    if (cognitiveMatch) {
      const cognitiveLevel =
        parseCognitiveLevel(
          cognitiveMatch[1]
        );

      if (cognitiveLevel) {
        metadata.cognitiveLevel =
          cognitiveLevel;
      } else {
        warnings.push(
          `Mức độ nhận thức “${cognitiveMatch[1].trim()}” không hợp lệ. Đã sử dụng Nhận biết.`
        );
      }

      continue;
    }

    const tagsMatch =
      line.match(
        TAGS_PATTERN
      );

    if (tagsMatch) {
      const tags =
        parseTags(
          tagsMatch[1]
        );

      metadata.tags =
        tags.length > 0
          ? tags
          : undefined;

      continue;
    }

    const explanationMatch =
      line.match(
        EXPLANATION_PATTERN
      );

    if (explanationMatch) {
      metadata.explanation =
        explanationMatch[1]
          .trim() ||
        undefined;

      continue;
    }

    const caseSensitiveMatch =
      line.match(
        CASE_SENSITIVE_PATTERN
      );

    if (
      caseSensitiveMatch
    ) {
      metadata.caseSensitive =
        parseBooleanSetting(
          caseSensitiveMatch[1],
          false
        );

      continue;
    }

    const trimWhitespaceMatch =
      line.match(
        TRIM_WHITESPACE_PATTERN
      );

    if (
      trimWhitespaceMatch
    ) {
      metadata.trimWhitespace =
        parseBooleanSetting(
          trimWhitespaceMatch[1],
          true
        );

      continue;
    }

    contentLines.push(
      line
    );
  }

  return {
    metadata,
    contentLines,
    warnings,
  };
}

function extractBooleanFromText(
  value: string
): BooleanAnswerResult {
  const endingMatch =
    value.match(
      /(?:^|\s)[\(\[]?\s*(đúng|dung|sai|true|false|đ|s|t|f)\s*[\)\]]?\s*[\.\,\;\:!！。]*\s*$/i
    );

  if (!endingMatch) {
    return {
      content:
        value.trim(),

      answer: null,
    };
  }

  const normalizedAnswer =
    normalizeVietnamese(
      endingMatch[1]
    );

  const contentEndIndex =
    endingMatch.index ?? 0;

  return {
    content: value
      .slice(
        0,
        contentEndIndex
      )
      .trim(),

    answer:
      /^đ$/i.test(
        endingMatch[1]
      ) ||
      TRUE_WORDS.has(
        normalizedAnswer
      ),
  };
}

function parseAnswerTokens(
  answerText: string
): string[] {
  return answerText
    .split(/[,;|/\s]+/)
    .map((item) =>
      item
        .replace(
          /^[a-d]\s*[\.\:\-\)]?/i,
          ""
        )
        .trim()
    )
    .filter(Boolean);
}

function parseSequentialBooleanAnswers(
  answerText: string
): Map<QuestionOptionId, boolean> {
  const result =
    new Map<
      QuestionOptionId,
      boolean
    >();

  const compactAnswerText =
    answerText
      .replace(/[,;|/\s]+/g, "")
      .trim();
  const compactAnswerTokens =
    Array.from(
      compactAnswerText
    );

  if (
    compactAnswerTokens.length ===
    QUESTION_OPTION_IDS.length
  ) {
    const compactAnswers =
      compactAnswerTokens.map(
        (token) => {
          const normalized =
            normalizeVietnamese(
              token
            );

          if (
            normalized === "d" ||
            normalized === "t"
          ) {
            return true;
          }

          if (
            normalized === "s" ||
            normalized === "f"
          ) {
            return false;
          }

          return null;
        }
      );

    if (
      compactAnswers.every(
        (
          answer
        ): answer is boolean =>
          answer !== null
      )
    ) {
      compactAnswers.forEach(
        (answer, index) => {
          result.set(
            QUESTION_OPTION_IDS[
              index
            ],
            answer
          );
        }
      );

      return result;
    }
  }

  const parsedAnswers =
    answerText
      .split(/[,;|/\s]+/)
      .map((item) =>
        item
          .replace(
            /^[a-d]\s*[\.\:\-\)]?/i,
            ""
          )
          .replace(
            /^[\(\[]|[\)\]\.\:\-]+$/g,
            ""
          )
          .trim()
      )
      .filter(Boolean)
      .map((token) => {
        const normalized =
          normalizeVietnamese(
            token
          );

        if (
          /^đ$/i.test(token) ||
          TRUE_WORDS.has(
            normalized
          )
        ) {
          return true;
        }

        if (
          /^s$/i.test(token) ||
          FALSE_WORDS.has(
            normalized
          )
        ) {
          return false;
        }

        return null;
      })
      .filter(
        (
          answer
        ): answer is boolean =>
          answer !== null
      );

  if (
    parsedAnswers.length !==
    QUESTION_OPTION_IDS.length
  ) {
    return result;
  }

  parsedAnswers.forEach(
    (answer, index) => {
      result.set(
        QUESTION_OPTION_IDS[
          index
        ],
        answer
      );
    }
  );

  return result;
}

function parseTrueStatementIds(
  answerText: string
): QuestionOptionId[] {
  const allowedWords =
    new Set([
      "cac",
      "nhung",
      "menh",
      "de",
      "nhan",
      "dinh",
      "y",
      "dung",
      "true",
      "correct",
      "la",
      "gom",
      "va",
      "and",
      "duoc",
      "to",
      "mau",
      "danh",
      "dau",
      "phuong",
      "an",
      "lua",
      "chon",
    ]);

  const tokens =
    normalizeVietnamese(
      answerText
    )
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

  const ids:
    QuestionOptionId[] = [];
  const seen =
    new Set<
      QuestionOptionId
    >();
  const unexpectedTokens:
    string[] = [];

  tokens.forEach((token) => {
    if (
      /^[a-d]$/.test(token)
    ) {
      const id =
        token.toUpperCase() as
        QuestionOptionId;

      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }

      return;
    }

    if (
      /^\d+$/.test(token) ||
      allowedWords.has(token)
    ) {
      return;
    }

    unexpectedTokens.push(
      token
    );
  });

  if (
    ids.length === 0 ||
    unexpectedTokens.length > 0
  ) {
    return [];
  }

  return ids;
}

function parseTrueFalseAnswers(
  answerText: string,
  {
    inferTrueStatementIds = false,
  }: {
    inferTrueStatementIds?: boolean;
  } = {}
): Map<
  QuestionOptionId,
  boolean
> {
  const result =
    new Map<
      QuestionOptionId,
      boolean
    >();

  const explicitMatches =
    Array.from(
      answerText.matchAll(
        /([A-Da-d])\s*[\.\:\-\)]?\s*(đúng|dung|sai|true|false|t|f)/gi
      )
    );

  for (
    const match of
    explicitMatches
  ) {
    const id =
      match[1]
        .toUpperCase() as
        QuestionOptionId;

    const normalizedAnswer =
      normalizeVietnamese(
        match[2]
      );

    if (
      TRUE_WORDS.has(
        normalizedAnswer
      )
    ) {
      result.set(
        id,
        true
      );

      continue;
    }

    if (
      FALSE_WORDS.has(
        normalizedAnswer
      )
    ) {
      result.set(
        id,
        false
      );
    }
  }

  if (result.size > 0) {
    return result;
  }

  const sequentialAnswers =
    parseSequentialBooleanAnswers(
      answerText
    );

  if (
    sequentialAnswers.size > 0
  ) {
    return sequentialAnswers;
  }

  const tokens =
    parseAnswerTokens(
      answerText
    );

  tokens
    .slice(
      0,
      QUESTION_OPTION_IDS.length
    )
    .forEach(
      (
        token,
        index
      ) => {
        const normalized =
          normalizeVietnamese(
            token
          );

        const id =
          QUESTION_OPTION_IDS[
            index
          ];

        if (
          TRUE_WORDS.has(
            normalized
          )
        ) {
          result.set(
            id,
            true
          );

          return;
        }

        if (
          FALSE_WORDS.has(
            normalized
          )
        ) {
          result.set(
            id,
            false
          );
        }
      }
    );

  if (result.size > 0) {
    return result;
  }

  if (
    inferTrueStatementIds
  ) {
    const trueStatementIds =
      parseTrueStatementIds(
        answerText
      );

    if (
      trueStatementIds.length > 0
    ) {
      QUESTION_OPTION_IDS.forEach(
        (id) => {
          result.set(
            id,
            trueStatementIds.includes(
              id
            )
          );
        }
      );
    }
  }

  return result;
}

function getInlineOptionMarkers(
  line: string
): {
  start: number;
}[] {
  const markers:
    {
      start: number;
    }[] = [];
  const markerPattern =
    /(^|[\s\u00a0])([A-Da-d])\s*[\.\)]\s+/g;

  for (
    const match of
    line.matchAll(
      markerPattern
    )
  ) {
    markers.push({
      start:
        (match.index ?? 0) +
        match[1].length,
    });
  }

  return markers;
}

function expandInlineOptionLines(
  lines: string[]
): string[] {
  const expanded:
    string[] = [];

  for (const line of lines) {
    const markers =
      getInlineOptionMarkers(
        line
      );

    if (
      markers.length === 0 ||
      (
        markers.length === 1 &&
        markers[0].start === 0
      )
    ) {
      expanded.push(line);
      continue;
    }

    const firstMarker =
      markers[0];
    const prefix =
      line
        .slice(
          0,
          firstMarker.start
        )
        .trim();

    if (prefix) {
      expanded.push(
        prefix
      );
    }

    markers.forEach(
      (
        marker,
        index
      ) => {
        const nextMarker =
          markers[
            index + 1
          ];
        const optionText =
          line
            .slice(
              marker.start,
              nextMarker?.start ??
                line.length
            )
            .trim();

        if (optionText) {
          expanded.push(
            optionText
          );
        }
      }
    );
  }

  return expanded;
}

function collectOptions(
  lines: string[],
  trueFalseMode = false
): {
  options:
    CollectedOption[];
  answerText: string;
  nonOptionLines:
    string[];
  warnings: string[];
} {
  const optionMap =
    new Map<
      QuestionOptionId,
      string
    >();

  const warnings:
    string[] = [];

  const nonOptionLines:
    string[] = [];

  let answerText = "";

  let currentOptionId:
    QuestionOptionId | null =
    null;

  for (const line of
    expandInlineOptionLines(
      lines
    )) {
    const answerMatch =
      line.match(
        ANSWER_PATTERN
      );

    if (answerMatch) {
      answerText =
        answerMatch[1]
          .trim();

      currentOptionId =
        null;

      continue;
    }

    const optionMatch =
      line.match(
        OPTION_PATTERN
      );

    if (optionMatch) {
      const optionId =
        optionMatch[1]
          .toUpperCase() as
          QuestionOptionId;
      const nextContent =
        optionMatch[2]
          .trim();

      if (
        optionMap.has(
          optionId
        )
      ) {
        const currentContent =
          optionMap.get(
            optionId
          ) ?? "";
        const currentBoolean =
          extractBooleanFromText(
            currentContent
          );
        const nextBoolean =
          extractBooleanFromText(
            nextContent
          );
        const currentIsBooleanOnly =
          currentBoolean.answer !== null &&
          !currentBoolean.content;
        const nextIsBooleanOnly =
          nextBoolean.answer !== null &&
          !nextBoolean.content;

        if (
          trueFalseMode &&
          (
            currentBoolean.answer !== null ||
            nextBoolean.answer !== null
          )
        ) {
          const currentStatement =
            currentBoolean.content ||
            currentContent;
          const nextStatement =
            nextBoolean.content ||
            nextContent;
          const normalizedCurrentStatement =
            normalizeVietnamese(
              currentStatement
            );
          const normalizedNextStatement =
            normalizeVietnamese(
              nextStatement
            );
          let statementContent =
            currentStatement ||
            nextStatement;

          if (
            currentStatement &&
            nextStatement &&
            normalizedCurrentStatement !==
              normalizedNextStatement
          ) {
            if (
              normalizedCurrentStatement.includes(
                normalizedNextStatement
              )
            ) {
              statementContent =
                currentStatement;
            } else if (
              normalizedNextStatement.includes(
                normalizedCurrentStatement
              )
            ) {
              statementContent =
                nextStatement;
            } else {
              statementContent = [
                currentStatement,
                nextStatement,
              ].join(" ");
            }
          }

          const booleanAnswer =
            nextBoolean.answer ??
            currentBoolean.answer;

          optionMap.set(
            optionId,
            `${statementContent} ${booleanAnswer ? "Đúng" : "Sai"}`.trim()
          );
        } else if (trueFalseMode) {
          const mergedContent =
            normalizeVietnamese(
              currentContent
            ) ===
            normalizeVietnamese(
              nextContent
            )
              ? currentContent
              : [
                  currentContent,
                  nextContent,
                ]
                  .filter(Boolean)
                  .join(" ");

          optionMap.set(
            optionId,
            mergedContent.trim()
          );
        } else if (nextIsBooleanOnly && !currentIsBooleanOnly) {
          optionMap.set(
            optionId,
            `${currentContent} ${nextContent}`.trim()
          );
        } else if (currentIsBooleanOnly && !nextIsBooleanOnly) {
          optionMap.set(
            optionId,
            `${nextContent} ${currentContent}`.trim()
          );
        } else if (
          normalizeVietnamese(currentContent) !==
          normalizeVietnamese(nextContent)
        ) {
          warnings.push(
            `${trueFalseMode ? "Mệnh đề" : "Phương án"} ${optionId} xuất hiện nhiều lần.`
          );

          if (nextContent.length > currentContent.length) {
            optionMap.set(
              optionId,
              nextContent
            );
          }
        }

        currentOptionId =
          optionId;

        continue;
      }

      optionMap.set(
        optionId,
        nextContent
      );

      currentOptionId =
        optionId;

      continue;
    }

    if (currentOptionId) {
      optionMap.set(
        currentOptionId,
        joinContent(
          optionMap.get(
            currentOptionId
          ) ?? "",
          line
        )
      );

      continue;
    }

    nonOptionLines.push(
      line
    );
  }

  return {
    options:
      QUESTION_OPTION_IDS
        .filter((id) =>
          optionMap.has(id)
        )
        .map((id) => ({
          id,
          content:
            optionMap.get(
              id
            ) ?? "",
        })),

    answerText,
    nonOptionLines,
    warnings,
  };
}

function detectQuestionType(
  lines: string[],
  explicitType?: QuestionType
): QuestionType {
  if (explicitType) {
    return explicitType;
  }

  const expandedLines =
    expandInlineOptionLines(
      lines
    );

  const answerLine =
    expandedLines.find((line) =>
      ANSWER_PATTERN.test(
        line
      )
    );

  const answerValue =
    answerLine?.match(
      ANSWER_PATTERN
    )?.[1] ?? "";

  const optionMatches =
    expandedLines
      .map((line) =>
        line.match(
          OPTION_PATTERN
        )
      )
      .filter(
        (
          match
        ): match is RegExpMatchArray =>
          Boolean(match)
      );

  const inlineBooleanCount =
    optionMatches.filter(
      (match) =>
        extractBooleanFromText(
          match[2]
        ).answer !== null
    ).length;
  const lowercaseOptionCount =
    optionMatches.filter(
      (match) =>
        match[1] ===
        match[1].toLowerCase()
    ).length;

  const answerMap =
    parseTrueFalseAnswers(
      answerValue
    );

  const hasBooleanKeywords =
    /đúng|dung|sai|true|false/i.test(
      answerValue
    );
  const normalizedQuestionText =
    normalizeVietnamese(
      expandedLines.join(" ")
    );
  const hasTrueFalseInstruction =
    /(?:dung\s*(?:\/|hoac)?\s*sai|moi\s+y|cac\s+(?:menh\s+de|nhan\s+dinh|quan\s+diem))/.test(
      normalizedQuestionText
    );

  if (
    optionMatches.length >=
      2 &&
    (
      inlineBooleanCount >=
        2 ||
      answerMap.size >= 2 ||
      hasBooleanKeywords ||
      (
        lowercaseOptionCount >= 3 &&
        hasTrueFalseInstruction
      )
    )
  ) {
    return "true_false_group";
  }

  if (
    optionMatches.length >=
    2
  ) {
    return "single_choice";
  }

  return "short_answer";
}

function parseSingleChoiceQuestion(
  lines: string[],
  metadata: ParsedMetadata,
  fallbackAnswerText = ""
): QuestionParseResult {
  const collected =
    collectOptions(
      lines
    );

  const warnings = [
    ...collected.warnings,
  ];

  const content =
    collected.nonOptionLines
      .join("\n")
      .trim();

  if (!content) {
    warnings.push(
      "Thiếu nội dung câu hỏi."
    );
  }

  const optionMap =
    new Map(
      collected.options.map(
        (option) => [
          option.id,
          option.content,
        ]
      )
    );

  const missingOptions =
    QUESTION_OPTION_IDS.filter(
      (id) =>
        !optionMap.get(id)
          ?.trim()
    );

  const unreadableOptions =
    QUESTION_OPTION_IDS.filter(
      (id) => {
        const option =
          optionMap.get(id);

        return (
          Boolean(
            option?.trim()
          ) &&
          !isMeaningfulImportedText(
            option
          )
        );
      }
    );

  if (
    missingOptions.length > 0
  ) {
    warnings.push(
      `Thiếu phương án ${missingOptions.join(
        ", "
      )}.`
    );
  }

  if (
    unreadableOptions.length > 0
  ) {
    warnings.push(
      `Không nhận diện được nội dung có nghĩa ở phương án ${unreadableOptions.join(
        ", "
      )}; cần đọc lại công thức hoặc giữ ảnh gốc.`
    );
  }

  const answerMatch =
    (
      collected.answerText ||
      fallbackAnswerText
    ).match(
      /(?:^|[^A-Za-z])([A-D])(?:[^A-Za-z]|$)/i
    );

  const correctOptionId =
    answerMatch
      ? (answerMatch[1]
          .toUpperCase() as
          QuestionOptionId)
      : null;

  const hasInvalidAnswer =
    correctOptionId
      ? !optionMap.has(
          correctOptionId
        )
      : false;

  if (!correctOptionId) {
    warnings.push(
      "Chưa xác định được đáp án trắc nghiệm; cần giáo viên xác nhận trước khi sử dụng."
    );
  } else if (hasInvalidAnswer) {
    warnings.push(
      `Đáp án ${correctOptionId} không tồn tại trong danh sách phương án.`
    );
  }

  if (
    !content ||
    missingOptions.length >
      0
  ) {
    return {
      question: null,
      warnings,
    };
  }

  const needsManualAnswerReview =
    !correctOptionId ||
    hasInvalidAnswer;
  const safeCorrectOptionId:
    QuestionOptionId =
    needsManualAnswerReview
      ? QUESTION_OPTION_IDS.find(
          (id) =>
            optionMap.has(id)
        ) ?? "A"
      : correctOptionId ?? "A";
  const manualReviewNotice =
    needsManualAnswerReview
      ? "Cảnh báo import: Chưa xác định được đáp án trắc nghiệm; cần giáo viên xác nhận trước khi sử dụng."
      : "";
  const explanation =
    [
      metadata.explanation,
      manualReviewNotice,
    ]
      .filter(Boolean)
      .join("\n")
      .trim() || undefined;

  return {
    question: {
      type:
        "single_choice",

      content,

      subject:
        metadata.subject,

      grade:
        metadata.grade,

      topic:
        metadata.topic,

      knowledgeUnit:
        metadata.knowledgeUnit,

      skill:
        metadata.skill,

      learningOutcome:
        metadata.learningOutcome,

      explanation:
        explanation,

      difficulty:
        metadata.difficulty,

      cognitiveLevel:
        metadata.cognitiveLevel,

      tags:
        metadata.tags,

      updatedAt:
        new Date().toISOString(),

      options:
        QUESTION_OPTION_IDS.map(
          (id) => ({
            id,
            content:
              optionMap.get(
                id
              ) ?? "",
          })
        ),

      correctOptionId:
        safeCorrectOptionId,
    },

    warnings,

    answerSource:
      needsManualAnswerReview
        ? "manual_required"
        : undefined,

    needsManualReview:
      needsManualAnswerReview,

    reviewReason:
      needsManualAnswerReview
        ? "Chưa xác định được đáp án trắc nghiệm."
        : undefined,
  };
}

function parseTrueFalseQuestion(
  lines: string[],
  metadata: ParsedMetadata,
  fallbackAnswerText = ""
): QuestionParseResult {
  const collected =
    collectOptions(
      lines,
      true
    );

  const warnings = [
    ...collected.warnings,
  ];

  const content =
    collected.nonOptionLines
      .join("\n")
      .trim();

  if (!content) {
    warnings.push(
      "Thiếu nội dung câu hỏi."
    );
  }

  const statementContents =
    new Map<
      QuestionOptionId,
      string
    >();

  const inlineAnswers =
    new Map<
      QuestionOptionId,
      boolean
    >();

  for (
    const option of
    collected.options
  ) {
    const parsedStatement =
      extractBooleanFromText(
        option.content
      );

    statementContents.set(
      option.id,
      parsedStatement.content
    );

    if (
      parsedStatement.answer !==
      null
    ) {
      inlineAnswers.set(
        option.id,
        parsedStatement.answer
      );
    }
  }

  const answerMap =
    parseTrueFalseAnswers(
      collected.answerText ||
        fallbackAnswerText,
      {
        inferTrueStatementIds:
          true,
      }
    );

  const missingStatements =
    QUESTION_OPTION_IDS.filter(
      (id) =>
        !statementContents
          .get(id)
          ?.trim()
    );

  if (
    missingStatements.length >
    0
  ) {
    warnings.push(
      `Thiếu mệnh đề ${missingStatements.join(
        ", "
      )}.`
    );
  }

  const missingAnswers =
    QUESTION_OPTION_IDS.filter(
      (id) =>
        !inlineAnswers.has(
          id
        ) &&
        !answerMap.has(id)
    );

  if (
    missingAnswers.length > 0
  ) {
    warnings.push(
      `Chưa xác định được đáp án Đúng/Sai cho mệnh đề ${missingAnswers.join(
        ", "
      )}; cần giáo viên xác nhận trước khi sử dụng.`
    );
  }

  if (
    !content ||
    missingStatements.length >
      0
  ) {
    return {
      question: null,
      warnings,
    };
  }

  const missingAnswerNotice =
    missingAnswers.length > 0
      ? `Cảnh báo import: Chưa xác định được đáp án Đúng/Sai cho mệnh đề ${missingAnswers.join(
          ", "
        )}; cần giáo viên xác nhận trước khi sử dụng.`
      : "";
  const explanation =
    [
      metadata.explanation,
      missingAnswerNotice,
    ]
      .filter(Boolean)
      .join("\n")
      .trim() || undefined;

  return {
    question: {
      type:
        "true_false_group",

      content,

      subject:
        metadata.subject,

      grade:
        metadata.grade,

      topic:
        metadata.topic,

      knowledgeUnit:
        metadata.knowledgeUnit,

      skill:
        metadata.skill,

      learningOutcome:
        metadata.learningOutcome,

      explanation:
        explanation,

      difficulty:
        metadata.difficulty,

      cognitiveLevel:
        metadata.cognitiveLevel,

      tags:
        metadata.tags,

      updatedAt:
        new Date().toISOString(),

      statements:
        QUESTION_OPTION_IDS.map(
          (id) => ({
            id,

            content:
              statementContents.get(
                id
              ) ?? "",

            correctAnswer:
              inlineAnswers.get(
                id
              ) ??
              answerMap.get(
                id
              ) ??
              false,
          })
        ),
    },

    warnings,

    answerSource:
      missingAnswers.length > 0
        ? "manual_required"
        : undefined,

    needsManualReview:
      missingAnswers.length > 0,

    reviewReason:
      missingAnswers.length > 0
        ? `Chưa xác định được đáp án Đúng/Sai cho mệnh đề ${missingAnswers.join(
            ", "
          )}.`
        : undefined,
  };
}

function parseShortAnswerQuestion(
  lines: string[],
  metadata: ParsedMetadata,
  fallbackAnswerText = ""
): QuestionParseResult {
  const warnings:
    string[] = [];

  const contentLines:
    string[] = [];

  let answerText = "";

  for (const line of lines) {
    const answerMatch =
      line.match(
        ANSWER_PATTERN
      );

    if (answerMatch) {
      answerText =
        answerMatch[1]
          .trim();

      continue;
    }

    contentLines.push(
      line
    );
  }

  const content =
    contentLines
      .join("\n")
      .trim();

  const resolvedAnswerText =
    answerText ||
    fallbackAnswerText;

  const acceptedAnswers =
    Array.from(
      new Set(
        resolvedAnswerText
          .split(/[,;|]/)
          .map((answer) =>
            answer.trim()
          )
          .filter(Boolean)
      )
    );

  if (!content) {
    warnings.push(
      "Thiếu nội dung câu hỏi."
    );
  }

  if (
    acceptedAnswers.length ===
    0
  ) {
    warnings.push(
      "Chưa xác định được đáp án trả lời ngắn; cần giáo viên xác nhận trước khi sử dụng."
    );
  }

  if (!content) {
    return {
      question: null,
      warnings,
    };
  }

  const needsManualAnswerReview =
    acceptedAnswers.length ===
    0;
  const manualReviewNotice =
    needsManualAnswerReview
      ? "Cảnh báo import: Chưa xác định được đáp án trả lời ngắn; cần giáo viên xác nhận trước khi sử dụng."
      : "";
  const explanation =
    [
      metadata.explanation,
      manualReviewNotice,
    ]
      .filter(Boolean)
      .join("\n")
      .trim() || undefined;

  return {
    question: {
      type:
        "short_answer",

      content,

      subject:
        metadata.subject,

      grade:
        metadata.grade,

      topic:
        metadata.topic,

      knowledgeUnit:
        metadata.knowledgeUnit,

      skill:
        metadata.skill,

      learningOutcome:
        metadata.learningOutcome,

      difficulty:
        metadata.difficulty,

      cognitiveLevel:
        metadata.cognitiveLevel,

      tags:
        metadata.tags,

      updatedAt:
        new Date().toISOString(),

      acceptedAnswers,

      caseSensitive:
        metadata.caseSensitive,

      trimWhitespace:
        metadata.trimWhitespace,

      explanation:
        explanation,
    },

    warnings,

    answerSource:
      needsManualAnswerReview
        ? "manual_required"
        : undefined,

    needsManualReview:
      needsManualAnswerReview,

    reviewReason:
      needsManualAnswerReview
        ? "Chưa xác định được đáp án trả lời ngắn."
        : undefined,
  };
}

function parseQuestionBlock(
  block: RawQuestionBlock,
  answerKey: ParsedAnswerKey =
    new Map()
): QuestionParseResult {
  const extracted =
    extractMetadata(
      block.lines
    );

  const questionType =
    detectQuestionType(
      extracted.contentLines,
      block.sectionType ??
        extracted.metadata
          .explicitType
    );
  const fallbackAnswerText =
    answerKey.get(
      buildAnswerKeyLookupKey(
        questionType,
        block.sourceNumber
      )
    ) ?? "";

  let result:
    QuestionParseResult;

  if (
    questionType ===
    "single_choice"
  ) {
    result =
      parseSingleChoiceQuestion(
        extracted.contentLines,
        extracted.metadata,
        fallbackAnswerText
      );
  } else if (
    questionType ===
    "true_false_group"
  ) {
    result =
      parseTrueFalseQuestion(
        extracted.contentLines,
        extracted.metadata,
        fallbackAnswerText
      );
  } else {
    result =
      parseShortAnswerQuestion(
        extracted.contentLines,
        extracted.metadata,
        fallbackAnswerText
      );
  }

  return {
    question:
      result.question,

    warnings: [
      ...extracted.warnings,
      ...result.warnings,
    ],

    answerSource:
      result.answerSource,

    needsManualReview:
      result.needsManualReview,

    reviewReason:
      result.reviewReason,
  };
}

export function parseImportedQuestions(
  rawText: string
): {
  questions:
    ParsedImportQuestion[];

  warnings:
    ImportQuestionWarning[];
} {
  const separatedText =
    splitTrailingAnswerKey(
      rawText
    );
  const answerKey =
    parseGlobalAnswerKey(
      separatedText.answerKeyText
    );
  const blocks =
    splitIntoQuestionBlocks(
      separatedText.questionText
    );

  const questions:
    ParsedImportQuestion[] =
    [];

  const warnings:
    ImportQuestionWarning[] =
    [];

  if (blocks.length === 0) {
    warnings.push({
      message:
        "Không tìm thấy câu hỏi. Mỗi câu cần bắt đầu bằng “Câu 1.”, “Câu 2.”...",
    });

    return {
      questions,
      warnings,
    };
  }

  const sourceNumberCounts =
    new Map<
      string,
      number
    >();

  for (const block of blocks) {
    const sourceKey =
      `${block.sectionIndex}:${block.sourceNumber}`;

    sourceNumberCounts.set(
      sourceKey,
      (
        sourceNumberCounts.get(
          sourceKey
        ) ?? 0
      ) + 1
    );
  }

  blocks.forEach(
    (
      block,
      index
    ) => {
      if (
        (
          sourceNumberCounts.get(
            `${block.sectionIndex}:${block.sourceNumber}`
          ) ?? 0
        ) > 1
      ) {
        warnings.push({
          questionNumber:
            block.sourceNumber,

          message:
            "Số câu bị trùng trong tài liệu.",
        });
      }

      try {
        const parsed =
          parseQuestionBlock(
            block,
            answerKey
          );

        parsed.warnings.forEach(
          (message) => {
            warnings.push({
              questionNumber:
                block.sourceNumber,

              message,
            });
          }
        );

        if (
          !parsed.question
        ) {
          return;
        }

        questions.push({
          importId:
            createImportId(
              block.sourceNumber,
              index
            ),

          sourceNumber:
            block.sourceNumber,

          question:
            parsed.question,

          answerSource:
            parsed.answerSource,

          answer_source:
            parsed.answerSource,

          needsManualReview:
            parsed.needsManualReview,

          needs_manual_review:
            parsed.needsManualReview,

          reviewReason:
            parsed.reviewReason,
        });
      } catch (error) {
        console.error(
          `Failed to parse imported question ${block.sourceNumber}:`,
          error
        );

        warnings.push({
          questionNumber:
            block.sourceNumber,

          message:
            "Không thể phân tích câu hỏi này do cấu trúc không hợp lệ.",
        });
      }
    }
  );

  return {
    questions,
    warnings,
  };
}
