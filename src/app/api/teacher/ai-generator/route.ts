import {
  NextResponse,
} from "next/server";

import type {
  CreateQuestionInput,
} from "@/features/question-bank/repositories";

import {
  validateQuestionInput,
} from "@/features/question-bank/lib/validateQuestionInput";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  ApiError,
  isApiError,
} from "@/server/http/apiError";

import {
  generateGeminiText,
} from "@/server/ai/geminiClient";

export const runtime =
  "nodejs";

const QUESTION_TYPES = [
  "single_choice",
  "true_false_group",
  "short_answer",
] as const;

const DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const;

const COGNITIVE_LEVELS = [
  "recognition",
  "understanding",
  "application",
  "high_application",
] as const;

type GenerateQuestionsRequest = {
  subject?: unknown;
  grade?: unknown;
  topic?: unknown;
  questionType?: unknown;
  difficulty?: unknown;
  cognitiveLevel?: unknown;
  count?: unknown;
  requirements?: unknown;
};

type GenerateQuestionsResponse = {
  status: "success";
  questions: CreateQuestionInput[];
  model: string;
};

type ErrorResponse = {
  status: "error";
  message: string;
};

function safeString(
  value: unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function parseCount(
  value: unknown
): number {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.min(
    20,
    Math.max(
      1,
      Math.trunc(parsed)
    )
  );
}

function oneOf<
  Value extends readonly string[],
>(
  value: unknown,
  values: Value,
  fallback: Value[number]
): Value[number] {
  return values.includes(
    value as Value[number]
  )
    ? (value as Value[number])
    : fallback;
}

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json<ErrorResponse>(
    {
      status: "error",
      message,
    },
    {
      status,
    }
  );
}

function buildPrompt(
  input: Required<
    Omit<
      GenerateQuestionsRequest,
      "count"
    >
  > & {
    count: number;
  }
): string {
  return `Bạn là chuyên gia biên soạn câu hỏi kiểm tra cho học sinh Việt Nam.

Nhiệm vụ: tạo ${input.count} câu hỏi chất lượng cao cho ngân hàng câu hỏi KIEMTRA.AI.

Thông tin bắt buộc:
- Môn học: ${input.subject}
- Khối lớp: ${input.grade}
- Chủ đề: ${input.topic || "theo chủ đề giáo viên nhập"}
- Loại câu hỏi: ${input.questionType}
- Độ khó: ${input.difficulty}
- Mức độ nhận thức: ${input.cognitiveLevel}
- Yêu cầu thêm: ${input.requirements || "không có"}

Quy tắc nội dung:
- Viết bằng tiếng Việt, rõ ràng, không mơ hồ.
- Không tạo câu hỏi trùng ý nhau.
- Nếu có công thức Toán, dùng LaTeX với \\( ... \\), \\[ ... \\] hoặc $...$.
- Nếu có công thức Hóa, dùng mhchem: \\(\\ce{H2O}\\), \\(\\ce{HCl + NaOH -> NaCl + H2O}\\).
- Không dùng Markdown ngoài chuỗi nội dung.
- Không thêm lời giải dài trừ trường explanation của câu trả lời ngắn.

Schema JSON trả về duy nhất:
{
  "questions": [
    {
      "type": "single_choice",
      "content": "...",
      "subject": "...",
      "grade": "...",
      "topic": "...",
      "knowledgeUnit": "...",
      "skill": "...",
      "learningOutcome": "...",
      "explanation": "Giải thích ngắn gọn đáp án đúng và lỗi thường gặp",
      "difficulty": "easy|medium|hard",
      "cognitiveLevel": "recognition|understanding|application|high_application",
      "tags": ["..."],
      "options": [
        {"id":"A","content":"..."},
        {"id":"B","content":"..."},
        {"id":"C","content":"..."},
        {"id":"D","content":"..."}
      ],
      "correctOptionId": "A|B|C|D"
    }
  ]
}

Nếu loại câu hỏi là true_false_group, mỗi item phải có:
"statements": [
  {"id":"A","content":"...","correctAnswer":true},
  {"id":"B","content":"...","correctAnswer":false},
  {"id":"C","content":"...","correctAnswer":true},
  {"id":"D","content":"...","correctAnswer":false}
]

	Nếu loại câu hỏi là short_answer, mỗi item phải có:
	"acceptedAnswers": ["..."], "caseSensitive": false, "trimWhitespace": true

Chỉ trả về JSON hợp lệ, không bọc bằng code fence.`;
}

function extractJsonText(
  text: string
): string {
  const cleanText =
    text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

  if (cleanText.startsWith("{")) {
    return cleanText;
  }

  const firstBrace =
    cleanText.indexOf("{");
  const lastBrace =
    cleanText.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    return cleanText.slice(
      firstBrace,
      lastBrace + 1
    );
  }

  return cleanText;
}

function escapeInvalidJsonBackslashes(
  value: string
): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const char = value[index];

    if (!inString) {
      result += char;

      if (char === '"') {
        inString = true;
        escaped = false;
      }

      continue;
    }

    if (escaped) {
      if (
        !'"\\/bfnrtu'.includes(char)
      ) {
        result += "\\";
      }

      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    result += char;

    if (char === '"') {
      inString = false;
    }
  }

  if (escaped) {
    result += "\\";
  }

  return result;
}

function parseAiJson(
  text: string
): {
  questions?: unknown[];
} {
  const jsonText =
    extractJsonText(text);

  try {
    return JSON.parse(jsonText) as {
      questions?: unknown[];
    };
  } catch (firstError) {
    try {
      return JSON.parse(
        escapeInvalidJsonBackslashes(
          jsonText
        )
      ) as {
        questions?: unknown[];
      };
    } catch (secondError) {
      console.error(
        "AI generator JSON parse error:",
        {
          firstError,
          secondError,
          preview:
            jsonText.slice(0, 800),
        }
      );

      throw new ApiError(
        "AI trả về JSON chưa hợp lệ. Vui lòng bấm tạo lại hoặc mô tả yêu cầu ngắn hơn.",
        502
      );
    }
  }
}

function normalizeTags(
  value: unknown
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags =
    Array.from(
      new Set(
        value
          .map(safeString)
          .filter(Boolean)
      )
    ).slice(0, 8);

  return tags.length > 0
    ? tags
    : undefined;
}

function normalizeGeneratedQuestion(
  value: unknown,
  defaults: {
    subject: string;
    grade: string;
    topic: string;
    difficulty: CreateQuestionInput["difficulty"];
    cognitiveLevel: CreateQuestionInput["cognitiveLevel"];
  }
): CreateQuestionInput | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const source =
    value as Record<string, unknown>;
  const type =
    oneOf(
      source.type,
      QUESTION_TYPES,
      "single_choice"
    );
  const base = {
    content:
      safeString(source.content),
    subject:
      safeString(source.subject) ||
      defaults.subject,
    grade:
      safeString(source.grade) ||
      defaults.grade,
    topic:
      safeString(source.topic) ||
      defaults.topic,
    knowledgeUnit:
      safeString(source.knowledgeUnit),
    skill:
      safeString(source.skill),
    learningOutcome:
      safeString(source.learningOutcome),
    explanation:
      safeString(source.explanation),
    difficulty:
      oneOf(
        source.difficulty,
        DIFFICULTIES,
        defaults.difficulty
      ),
    cognitiveLevel:
      oneOf(
        source.cognitiveLevel,
        COGNITIVE_LEVELS,
        defaults.cognitiveLevel
      ),
    tags:
      normalizeTags(source.tags),
    updatedAt:
      new Date().toISOString(),
  };

  if (type === "single_choice") {
    const options =
      Array.isArray(source.options)
        ? source.options
        : [];
    const normalizedOptions =
      ["A", "B", "C", "D"].map(
        (id) => {
          const option =
            options.find(
              (item) =>
                item &&
                typeof item ===
                  "object" &&
                safeString(
                  (
                    item as Record<
                      string,
                      unknown
                    >
                  ).id
                ).toUpperCase() === id
            ) as
              | Record<
                  string,
                  unknown
                >
              | undefined;

          return {
            id:
              id as
                | "A"
                | "B"
                | "C"
                | "D",
            content:
              safeString(
                option?.content
              ),
          };
        }
      );

    return {
      ...base,
      type,
      options:
        normalizedOptions,
      correctOptionId:
        oneOf(
          safeString(
            source.correctOptionId
          ).toUpperCase(),
          ["A", "B", "C", "D"] as const,
          "A"
        ),
    };
  }

  if (type === "true_false_group") {
    const statements =
      Array.isArray(source.statements)
        ? source.statements
        : [];

    return {
      ...base,
      type,
      statements: [
        "A",
        "B",
        "C",
        "D",
      ].map((id) => {
        const statement =
          statements.find(
            (item) =>
              item &&
              typeof item ===
                "object" &&
              safeString(
                (
                  item as Record<
                    string,
                    unknown
                  >
                ).id
              ).toUpperCase() === id
          ) as
            | Record<
                string,
                unknown
              >
            | undefined;

        return {
          id:
            id as
              | "A"
              | "B"
              | "C"
              | "D",
          content:
            safeString(
              statement?.content
            ),
          correctAnswer:
            Boolean(
              statement?.correctAnswer
            ),
        };
      }),
    };
  }

  const acceptedAnswers =
    Array.isArray(
      source.acceptedAnswers
    )
      ? source.acceptedAnswers
          .map(safeString)
          .filter(Boolean)
      : [];

  return {
    ...base,
    type,
    acceptedAnswers,
    caseSensitive:
      source.caseSensitive === true,
    trimWhitespace:
      source.trimWhitespace !== false,
  };
}

export async function POST(
  request: Request
) {
  try {
    await getCurrentTeacher(request);

    const body =
      (await request.json()) as
        GenerateQuestionsRequest;
    const subject =
      safeString(body.subject);
    const grade =
      safeString(body.grade);
    const topic =
      safeString(body.topic);
    const count =
      parseCount(body.count);
    const questionType =
      oneOf(
        body.questionType,
        QUESTION_TYPES,
        "single_choice"
      );
    const difficulty =
      oneOf(
        body.difficulty,
        DIFFICULTIES,
        "medium"
      );
    const cognitiveLevel =
      oneOf(
        body.cognitiveLevel,
        COGNITIVE_LEVELS,
        "understanding"
      );
    const requirements =
      safeString(
        body.requirements
      );

    if (!subject || !grade) {
      throw new ApiError(
        "Vui lòng nhập môn học và khối lớp.",
        400
      );
    }

    const prompt =
      buildPrompt({
        subject,
        grade,
        topic,
        questionType,
        difficulty,
        cognitiveLevel,
        requirements,
        count,
      });

    const aiResult =
      await generateGeminiText({
        parts: [
          {
            text: prompt,
          },
        ],
        generationConfig: {
          temperature: 0.45,
          responseMimeType:
            "application/json",
        },
        cacheKeyParts: [
          "teacher-ai-generator",
          subject,
          grade,
          topic,
          questionType,
          difficulty,
          cognitiveLevel,
          requirements,
          count,
        ],
      });
    const parsed =
      parseAiJson(aiResult.text);

    const questions =
      (parsed.questions ?? [])
        .map((question) =>
          normalizeGeneratedQuestion(
            question,
            {
              subject,
              grade,
              topic,
              difficulty,
              cognitiveLevel,
            }
          )
        )
        .filter(
          (
            question
          ): question is CreateQuestionInput =>
            Boolean(question)
        )
        .filter((question) =>
          validateQuestionInput(
            question
          ).valid
        );

    if (questions.length === 0) {
      throw new ApiError(
        "AI đã trả về dữ liệu nhưng chưa có câu hỏi hợp lệ. Hãy thử mô tả yêu cầu cụ thể hơn.",
        422
      );
    }

    return NextResponse.json<GenerateQuestionsResponse>({
      status: "success",
      questions,
      model: aiResult.model,
    });
  } catch (error) {
    if (isApiError(error)) {
      return errorResponse(
        error.message,
        error.statusCode
      );
    }

    console.error(
      "POST /api/teacher/ai-generator error:",
      error
    );

    return errorResponse(
      "Không tạo được câu hỏi bằng AI.",
      500
    );
  }
}
