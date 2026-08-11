type AnswerKey = "A" | "B" | "C" | "D";

type ParsedQuestion = {
  question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  correct: AnswerKey;
  explanation?: string;
};

type ParseResult = {
  questions: ParsedQuestion[];
  warnings: string[];
};

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeCorrect(value: unknown): AnswerKey {
  const key = safeString(value).toUpperCase();

  if (key === "A" || key === "B" || key === "C" || key === "D") {
    return key;
  }

  return "A";
}

function cleanMathText(text: string): string {
  return text
    .replace(/\$begin:math:text\$/gi, "\\(")
    .replace(/\\?\$end:math:text\$/gi, "\\)")
    .replace(/begin:math:text/gi, "")
    .replace(/end:math:text/gi, "")
    .replace(/\$begin:math:display\$/gi, "\\[")
    .replace(/\\?\$end:math:display\$/gi, "\\]")
    .replace(/begin:math:display/gi, "")
    .replace(/end:math:display/gi, "");
}

function normalizeText(rawText: string): string {
  let text = rawText || "";

  text = cleanMathText(text);

  text = text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function removeAnswerKeySection(text: string): string {
  const markers = [
    /\n\s*BẢNG\s+ĐÁP\s+ÁN\s*/i,
    /\n\s*BANG\s+DAP\s+AN\s*/i,
    /\n\s*ANSWER\s+KEY\s*/i,
    /\n\s*ĐÁP\s+ÁN\s+THAM\s+KHẢO\s*/i,
    /\n\s*DAP\s+AN\s+THAM\s+KHAO\s*/i,
  ];

  let cutIndex = -1;

  for (const marker of markers) {
    const match = text.match(marker);

    if (match && typeof match.index === "number") {
      if (cutIndex === -1 || match.index < cutIndex) {
        cutIndex = match.index;
      }
    }
  }

  if (cutIndex >= 0) {
    return text.slice(0, cutIndex).trim();
  }

  return text;
}

function normalizeQuestionNumber(text: string): string {
  return text.replace(
    /(?:^|\n)\s*(?:Câu|Cau|Question)\s*(\d+)\s*[\.:：-]\s*/gi,
    "\nCâu $1. "
  );
}

function normalizeOptions(text: string): string {
  return text
    .replace(/(?:^|\n)\s*A\s*[\.\):：-]\s*/gi, "\nA. ")
    .replace(/(?:^|\n)\s*B\s*[\.\):：-]\s*/gi, "\nB. ")
    .replace(/(?:^|\n)\s*C\s*[\.\):：-]\s*/gi, "\nC. ")
    .replace(/(?:^|\n)\s*D\s*[\.\):：-]\s*/gi, "\nD. ");
}

function normalizeAnswerLine(text: string): string {
  return text.replace(
    /(?:^|\n)\s*(?:Đáp án đúng|Đáp án|Dap an dung|Dap an|Correct|Answer)\s*[:：-]\s*([ABCD])\b/gi,
    "\nĐáp án: $1"
  );
}

function getQuestionBlocks(text: string): string[] {
  return text
    .split(/(?=\nCâu\s+\d+\.\s*)/gi)
    .map((block) => block.trim())
    .filter((block) => /^Câu\s+\d+\.\s*/i.test(block));
}

function extractQuestionNumber(block: string, fallback: number): number {
  const match = block.match(/^Câu\s+(\d+)\./i);
  const value = Number(match?.[1] || fallback);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return fallback;
}

function cleanField(value: string): string {
  return cleanMathText(value)
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseBlock(block: string, fallbackIndex: number): ParsedQuestion | null {
  const questionNumber = extractQuestionNumber(block, fallbackIndex);

  const questionMatch = block.match(
    /^Câu\s+\d+\.\s*([\s\S]*?)(?=\nA\.\s*)/i
  );

  const aMatch = block.match(/\nA\.\s*([\s\S]*?)(?=\nB\.\s*)/i);
  const bMatch = block.match(/\nB\.\s*([\s\S]*?)(?=\nC\.\s*)/i);
  const cMatch = block.match(/\nC\.\s*([\s\S]*?)(?=\nD\.\s*)/i);
  const dMatch = block.match(
    /\nD\.\s*([\s\S]*?)(?=\nĐáp án:\s*[ABCD]\b|\nGiải thích\s*:|\nLời giải\s*:|\s*$)/i
  );

  const correctMatch = block.match(/\nĐáp án:\s*([ABCD])\b/i);

  const explanationMatch = block.match(
    /(?:\nGiải thích\s*:|\nLời giải\s*:)\s*([\s\S]*)$/i
  );

  const question = cleanField(questionMatch?.[1] || "");
  const A = cleanField(aMatch?.[1] || "");
  const B = cleanField(bMatch?.[1] || "");
  const C = cleanField(cMatch?.[1] || "");
  const D = cleanField(dMatch?.[1] || "");
  const correct = normalizeCorrect(correctMatch?.[1]);
  const explanation = cleanField(explanationMatch?.[1] || "");

  if (!question || !A || !B || !C || !D) {
    return null;
  }

  return {
    question,
    A,
    B,
    C,
    D,
    correct,
    explanation,
  };
}

export function parseQuestionsFromText(rawText: string): ParseResult {
  const warnings: string[] = [];

  let text = normalizeText(rawText);

  text = removeAnswerKeySection(text);
  text = normalizeQuestionNumber(text);
  text = normalizeOptions(text);
  text = normalizeAnswerLine(text);
  text = normalizeText(text);

  const blocks = getQuestionBlocks(text);

  if (blocks.length === 0) {
    return {
      questions: [],
      warnings: [
        "Không tìm thấy câu hỏi. File nên có dạng: Câu 1. ... A. ... B. ... C. ... D. ... Đáp án: A",
      ],
    };
  }

  const questions: ParsedQuestion[] = [];

  blocks.forEach((block, index) => {
    const questionNumber = extractQuestionNumber(block, index + 1);
    const parsed = parseBlock(block, index + 1);

    if (!parsed) {
      const looksLikeAnswerKey =
        !/\nA\.\s*/i.test(block) &&
        !/\nB\.\s*/i.test(block) &&
        !/\nC\.\s*/i.test(block) &&
        !/\nD\.\s*/i.test(block) &&
        /Đáp án|Dap an|Answer|Correct/i.test(block);

      if (!looksLikeAnswerKey) {
        warnings.push(
          `Câu ${questionNumber}: Không tìm đủ 4 đáp án A/B/C/D. Vui lòng kiểm tra lại format.`
        );
      }

      return;
    }

    questions.push(parsed);
  });

  return {
    questions,
    warnings,
  };
}