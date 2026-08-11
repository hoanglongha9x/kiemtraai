import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";
import { createTeacherTest } from "@/server/tests/testService";

export const runtime = "nodejs";

type AnswerKey = "A" | "B" | "C" | "D";

type CognitiveLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

type Difficulty = "easy" | "medium" | "hard";

function safeString(value: unknown) {
  return String(value || "").trim();
}


function normalizeAnswerKey(value: unknown): AnswerKey {
  const key = safeString(value).toUpperCase();

  if (key === "A" || key === "B" || key === "C" || key === "D") {
    return key;
  }

  return "A";
}

function normalizeDifficulty(value: unknown): Difficulty {
  const difficulty = safeString(value).toLowerCase();

  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    return difficulty as Difficulty;
  }

  return "medium";
}

function normalizeCognitiveLevel(value: unknown): CognitiveLevel {
  const level = safeString(value).toLowerCase();

  if (
    level === "recognition" ||
    level === "understanding" ||
    level === "application" ||
    level === "high_application"
  ) {
    return level as CognitiveLevel;
  }

  return "understanding";
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => safeString(item))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeDurationMinutes(value: unknown) {
  const duration = Number(value || 45);

  if (!Number.isFinite(duration)) return 45;
  if (duration < 1) return 45;
  if (duration > 300) return 300;

  return Math.round(duration);
}

function buildEmbeddedQuestion(data: any, questionId: string, snapshotAt: string) {
  return {
    id: questionId,
    bankQuestionId: questionId,

    question: safeString(data.question),
    questionImageId: safeString(data.questionImageId),
    questionImageUrl: safeString(data.questionImageUrl),

    A: safeString(data.A),
    AImageId: safeString(data.AImageId),
    AImageUrl: safeString(data.AImageUrl),

    B: safeString(data.B),
    BImageId: safeString(data.BImageId),
    BImageUrl: safeString(data.BImageUrl),

    C: safeString(data.C),
    CImageId: safeString(data.CImageId),
    CImageUrl: safeString(data.CImageUrl),

    D: safeString(data.D),
    DImageId: safeString(data.DImageId),
    DImageUrl: safeString(data.DImageUrl),

    correct: normalizeAnswerKey(data.correct),
    explanation: safeString(data.explanation),

    subject: safeString(data.subject),
    grade: safeString(data.grade),
    topic: safeString(data.topic),

    knowledgeUnit: safeString(data.knowledgeUnit),
    skill: safeString(data.skill),
    learningOutcome: safeString(data.learningOutcome),
    cognitiveLevel: normalizeCognitiveLevel(data.cognitiveLevel),

    difficulty: normalizeDifficulty(data.difficulty),
    tags: normalizeTags(data.tags),

    visibility: safeString(data.visibility || "school"),

    source: safeString(data.source || "questionBank"),
    originalTeacherEmail: safeString(data.teacherEmail),
    originalTeacherName: safeString(data.teacherName),

    questionBankSnapshotAt: snapshotAt,
  };
}

export async function POST(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();

    const title = safeString(body.title);
    const description = safeString(body.description);
    const durationMinutes = normalizeDurationMinutes(body.durationMinutes);

    const questionIds = Array.isArray(body.questionIds)
      ? body.questionIds.map((id: unknown) => safeString(id)).filter(Boolean)
      : [];

    if (!title) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng nhập tên đề kiểm tra.",
        },
        { status: 400 }
      );
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng chọn ít nhất 1 câu hỏi.",
        },
        { status: 400 }
      );
    }

    if (questionIds.length > 100) {
      return NextResponse.json(
        {
          status: "error",
          message: "Mỗi đề tạm thời chỉ nên có tối đa 100 câu hỏi.",
        },
        { status: 400 }
      );
    }

    const duplicatedIds = questionIds.filter(
(
  id: string,
  index: number
) =>
  questionIds.indexOf(id) !==
  index    );

    if (duplicatedIds.length > 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Danh sách câu hỏi có câu bị chọn trùng. Vui lòng kiểm tra lại.",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = new Date().toISOString();

    const questionDocs = await Promise.all(
      questionIds.map((id: string) => db.collection("questionBank").doc(id).get())
    );

    const questions: any[] = [];

    for (const questionDoc of questionDocs) {
      if (!questionDoc.exists) {
        return NextResponse.json(
          {
            status: "error",
            message: "Có câu hỏi không tồn tại trong ngân hàng.",
          },
          { status: 404 }
        );
      }

      const data = questionDoc.data() || {};

      if ((data.status || "active") === "deleted") {
        return NextResponse.json(
          {
            status: "error",
            message: "Có câu hỏi đã bị xóa khỏi ngân hàng.",
          },
          { status: 400 }
        );
      }

      if (data.schoolId !== teacher.schoolId) {
        return NextResponse.json(
          {
            status: "error",
            message: "Có câu hỏi không thuộc trường của bạn.",
          },
          { status: 403 }
        );
      }

      const canUse =
        data.teacherEmail === teacher.email;

      if (!canUse) {
        return NextResponse.json(
          {
            status: "error",
            message: "Bạn không có quyền dùng một số câu hỏi đã chọn.",
          },
          { status: 403 }
        );
      }

      const embeddedQuestion = buildEmbeddedQuestion(data, questionDoc.id, now);

      if (!embeddedQuestion.question) {
        return NextResponse.json(
          {
            status: "error",
            message: "Có câu hỏi bị thiếu nội dung.",
          },
          { status: 400 }
        );
      }

      if (
        !embeddedQuestion.A ||
        !embeddedQuestion.B ||
        !embeddedQuestion.C ||
        !embeddedQuestion.D
      ) {
        return NextResponse.json(
          {
            status: "error",
            message: "Có câu hỏi bị thiếu đáp án A/B/C/D.",
          },
          { status: 400 }
        );
      }

      questions.push(embeddedQuestion);
    }

    const testSubject = safeString(
      body.subject || questions[0]?.subject || teacher.subject || "Khác"
    );

    const testGrade = safeString(body.grade || questions[0]?.grade || "");

    const result = await createTeacherTest(request, {
      title,
      description,
      subject: testSubject,
      grade: testGrade,
      durationMinutes,
      totalScore: questions.length * 0.25,
      questions,
      source: "questionBank",
      status: "draft",
    });

    const {
      status: testStatus,
      ...responseData
    } = result;

    return NextResponse.json({
      status: "success",
      testStatus,
      ...responseData,
      message: "Đã tạo đề kiểm tra từ ngân hàng câu hỏi.",
    });
  } catch (error: any) {
    console.error("POST /api/teacher/tests/from-question-bank error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tạo được đề từ ngân hàng câu hỏi.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
