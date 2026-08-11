import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type TeacherProfile = {
  email: string;
  name: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  schoolId?: string;
};

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function safeLower(value: unknown): string {
  return safeString(value).toLowerCase();
}

function safeUpper(value: unknown): string {
  return safeString(value).toUpperCase();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => safeString(item)).filter(Boolean);
}

function normalizeResultScore(data: any) {
  const storedScore = Number(data.score || 0);
  const storedTotalScore = Number(data.totalScore || 10);
  const storedPercentage = Number(data.percentage);
  const percentage =
    Number.isFinite(storedPercentage)
      ? storedPercentage
      : storedTotalScore > 0
        ? (storedScore / storedTotalScore) * 100
        : 0;

  return {
    score: Number(((Math.max(0, percentage) / 100) * 10).toFixed(2)),
    totalScore: 10,
  };
}

function normalizeAntiCheat(data: any) {
  const nested =
    data.antiCheat && typeof data.antiCheat === "object" ? data.antiCheat : {};
  const events = Array.isArray(data.suspiciousEvents)
    ? data.suspiciousEvents
    : Array.isArray(nested.suspiciousEvents)
      ? nested.suspiciousEvents
      : [];
  const visibilityLostCount = Math.max(
    0,
    Number(data.visibilityLostCount ?? nested.visibilityLostCount ?? 0)
  );
  const focusLostCount = Math.max(
    0,
    Number(data.focusLostCount ?? nested.focusLostCount ?? 0)
  );
  const suspiciousEventCount = Math.max(
    events.length,
    Number(data.suspiciousEventCount ?? nested.suspiciousEventCount ?? 0),
    visibilityLostCount + focusLostCount
  );

  return {
    visibilityLostCount,
    focusLostCount,
    suspiciousEventCount,
  };
}

function canTeacherSeeResult(teacher: TeacherProfile, result: any): boolean {
  return safeLower(result.teacherEmail) === teacher.email;
}

async function getTestTitleById(testId: string): Promise<string> {
  if (!testId) return "";

  const db = getAdminDb();
  const testDoc = await db.collection("tests").doc(testId).get();

  if (!testDoc.exists) return "";

  const test = testDoc.data() || {};

  return safeString(test.title);
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const db = getAdminDb();

    const url = new URL(request.url);

    const testId = safeString(url.searchParams.get("testId"));
    const classId = safeString(url.searchParams.get("classId"));
    const assignmentId = safeString(url.searchParams.get("assignmentId"));
    const assignmentCode = safeUpper(url.searchParams.get("assignmentCode"));
    const studentCode = safeUpper(url.searchParams.get("studentCode"));

    const selectedTestTitle = testId ? await getTestTitleById(testId) : "";

    const snapshot = await db.collection("results").get();

    let results = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        const classIds = normalizeStringArray(data.classIds);
        const classNames = normalizeStringArray(data.classNames);
        const normalizedScore = normalizeResultScore(data);
        const antiCheat = normalizeAntiCheat(data);

        return {
          id: doc.id,

          assignmentId: data.assignmentId || "",
          assignmentCode: data.assignmentCode || "",

          testId: data.testId || "",
          testTitle: data.testTitle || "",

          classIds,
          classNames,
          classCount: Number(data.classCount || classIds.length || 0),

          // Lớp thực tế của học sinh khi nộp bài.
          classId: data.classId || "",
          className: data.className || "",

          subject: data.subject || "",

          studentId: data.studentId || "",
          studentCode: data.studentCode || "",
          studentName: data.studentName || "",

          teacherEmail: data.teacherEmail || "",
          teacherName: data.teacherName || "",
          schoolId: data.schoolId || "",

          answers: data.answers || {},
          detail: Array.isArray(data.detail) ? data.detail : [],

          correctCount: Number(
            data.correctCount ?? data.correctQuestionCount ?? 0
          ),
          totalQuestions: Number(data.totalQuestions || 0),
          score: normalizedScore.score,
          totalScore: normalizedScore.totalScore,

          duration: Number(data.duration || data.durationMinutes || 0),
          durationMinutes: Number(data.durationMinutes || data.duration || 0),
          timeSpentSeconds: Number(data.timeSpentSeconds || 0),

          startedAt: data.startedAt || "",
          submittedAt: data.submittedAt || "",
          createdAt: data.createdAt || "",

          status: data.status || "submitted",
          autoSubmit: Boolean(data.autoSubmit),
          visibilityLostCount: antiCheat.visibilityLostCount,
          focusLostCount: antiCheat.focusLostCount,
          suspiciousEventCount: antiCheat.suspiciousEventCount,
          hasSuspiciousActivity: antiCheat.suspiciousEventCount > 0,
        };
      })
      .filter((item) => canTeacherSeeResult(teacher, item));

    if (testId) {
      results = results.filter((item) => {
        const sameTestId = safeString(item.testId) === testId;

        const sameTestTitle =
          selectedTestTitle &&
          safeLower(item.testTitle) === safeLower(selectedTestTitle);

        return sameTestId || sameTestTitle;
      });
    }

    if (classId) {
      results = results.filter((item) => safeString(item.classId) === classId);
    }

    if (assignmentId) {
      results = results.filter(
        (item) => safeString(item.assignmentId) === assignmentId
      );
    }

    if (assignmentCode) {
      results = results.filter(
        (item) => safeUpper(item.assignmentCode) === assignmentCode
      );
    }

    if (studentCode) {
      results = results.filter(
        (item) => safeUpper(item.studentCode) === studentCode
      );
    }

    results.sort((a, b) =>
      safeString(b.submittedAt || b.createdAt).localeCompare(
        safeString(a.submittedAt || a.createdAt)
      )
    );

    const totalSubmits = results.length;

    const averageScore =
      totalSubmits > 0
        ? Number(
            (
              results.reduce((sum, item) => sum + Number(item.score || 0), 0) /
              totalSubmits
            ).toFixed(2)
          )
        : 0;

    const passedCount = results.filter((item) => {
      const score = Number(item.score || 0);
      const totalScore = Number(item.totalScore || 10);

      return score >= totalScore / 2;
    }).length;

    return NextResponse.json({
      status: "success",
      results,
      summary: {
        totalSubmits,
        averageScore,
        passedCount,
      },
    });
  } catch (error: any) {
    console.error("GET /api/teacher/results error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được kết quả.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
