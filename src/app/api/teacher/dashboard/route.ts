import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type TeacherProfile = {
  email: string;
  name?: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  schoolId?: string;
};

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTimestamp(value: unknown): number {
  const text = safeString(value);
  if (!text) return 0;

  const timestamp = new Date(text).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeEmail(value: unknown): string {
  return safeString(value).toLowerCase();
}

function belongsToTeacher(item: any, teacher: TeacherProfile): boolean {
  const teacherEmail = normalizeEmail(teacher.email);

  const candidateEmails = [
    item.teacherEmail,
    item.ownerEmail,
    item.createdByEmail,
    item.updatedByEmail,
    item.teacher?.email,
    item.owner?.email,
    item.creator?.email,
    item.metadata?.owner?.email,
  ].map(normalizeEmail);

  return candidateEmails.includes(teacherEmail);
}

async function getCollectionItems(collectionName: string, teacher: TeacherProfile) {
  const db = getAdminDb();
  const snapshot = await db.collection(collectionName).get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((item) => belongsToTeacher(item, teacher)) as any[];
}

function getResultPercent(item: any): number {
  const score = safeNumber(item.score ?? item.totalScoreAchieved);
  const totalScore = safeNumber(item.totalScore, 10) || 10;

  return Math.max(0, Math.min(100, (score / totalScore) * 100));
}

function getResultDisplayScore(item: any): string {
  const score = safeNumber(item.score ?? item.totalScoreAchieved);
  const totalScore = safeNumber(item.totalScore, 10) || 10;

  return `${Number(score.toFixed(2))}/${Number(totalScore.toFixed(2))}`;
}

function getTestQuestionCount(item: any): number {
  return safeNumber(
    item.totalQuestions ??
      item.metadata?.totalQuestions ??
      item.summary?.totalQuestions
  );
}

function serializeRecentTest(item: any) {
  return {
    id: safeString(item.id),
    title: safeString(item.title) || "Đề chưa có tên",
    subject: safeString(item.subject ?? item.metadata?.subject),
    grade: safeString(item.grade ?? item.metadata?.grade),
    status: safeString(item.status) || "draft",
    totalQuestions: getTestQuestionCount(item),
    totalScore: safeNumber(item.totalScore ?? item.metadata?.totalScore),
    updatedAt: safeString(item.updatedAt || item.createdAt),
  };
}

function serializeRecentAssignment(item: any) {
  return {
    id: safeString(item.id),
    title:
      safeString(item.title) ||
      safeString(item.testTitle) ||
      safeString(item.testSnapshot?.title) ||
      "Bài giao chưa có tên",
    className:
      safeString(item.className) ||
      safeString(item.classSnapshot?.className),
    subject:
      safeString(item.subject) ||
      safeString(item.testSnapshot?.subject),
    status: safeString(item.status),
    assignmentCode: safeString(item.assignmentCode),
    createdAt: safeString(item.createdAt),
  };
}

function serializeRecentResult(item: any) {
  return {
    id: safeString(item.id),
    studentName:
      safeString(item.studentName) ||
      safeString(item.student?.name) ||
      "Học sinh",
    testTitle:
      safeString(item.testTitle) ||
      safeString(item.assignmentTitle) ||
      safeString(item.testSnapshot?.title) ||
      "Bài kiểm tra",
    subject: safeString(item.subject),
    scoreText: getResultDisplayScore(item),
    percent: Number(getResultPercent(item).toFixed(1)),
    submittedAt: safeString(item.submittedAt || item.createdAt),
  };
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);

    const [tests, classes, students, assignments, results, questions] =
      await Promise.all([
        getCollectionItems("tests", teacher),
        getCollectionItems("classes", teacher),
        getCollectionItems("students", teacher),
        getCollectionItems("testAssignments", teacher),
        getCollectionItems("results", teacher),
        getCollectionItems("questions", teacher),
      ]);

    const visibleTests = tests.filter((item) => item.status !== "deleted");
    const draftTests = visibleTests.filter((item) => item.status === "draft");
    const publishedTests = visibleTests.filter(
      (item) => item.status === "published"
    );
    const archivedTests = visibleTests.filter((item) => item.status === "archived");

    const activeClasses = classes.filter((item) => item.status !== "archived");
    const activeStudents = students.filter((item) => item.status !== "locked");
    const activeAssignments = assignments.filter((item) => item.status === "active");
    const scheduledAssignments = assignments.filter(
      (item) => item.status === "scheduled"
    );
    const closedAssignments = assignments.filter((item) => item.status === "closed");

    const totalSubmits = results.length;
    const averagePercent =
      totalSubmits > 0
        ? Number(
            (
              results.reduce((sum, item) => sum + getResultPercent(item), 0) /
              totalSubmits
            ).toFixed(1)
          )
        : 0;
    const passedCount = results.filter((item) => getResultPercent(item) >= 50).length;
    const passRate =
      totalSubmits > 0
        ? Number(((passedCount / totalSubmits) * 100).toFixed(1))
        : 0;

    const recentTests = visibleTests
      .slice()
      .sort(
        (a, b) =>
          getTimestamp(b.updatedAt || b.createdAt) -
          getTimestamp(a.updatedAt || a.createdAt)
      )
      .slice(0, 5)
      .map(serializeRecentTest);

    const recentResults = results
      .slice()
      .sort(
        (a, b) =>
          getTimestamp(b.submittedAt || b.createdAt) -
          getTimestamp(a.submittedAt || a.createdAt)
      )
      .slice(0, 5)
      .map(serializeRecentResult);

    const recentAssignments = assignments
      .slice()
      .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
      .slice(0, 5)
      .map(serializeRecentAssignment);

    return NextResponse.json({
      status: "success",
      teacher,
      summary: {
        totalTests: visibleTests.length,
        draftTests: draftTests.length,
        publishedTests: publishedTests.length,
        archivedTests: archivedTests.length,
        totalClasses: activeClasses.length,
        totalStudents: activeStudents.length,
        totalAssignments: assignments.length,
        activeAssignments: activeAssignments.length,
        scheduledAssignments: scheduledAssignments.length,
        closedAssignments: closedAssignments.length,
        totalQuestions: questions.length,
        totalSubmits,
        averagePercent,
        passRate,
        passedCount,
      },
      recentTests,
      recentResults,
      recentAssignments,
    });
  } catch (error: any) {
    console.error("GET /api/teacher/dashboard error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được dashboard.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
