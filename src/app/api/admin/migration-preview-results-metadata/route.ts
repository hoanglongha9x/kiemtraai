import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown): string {
  return safeString(value).toLowerCase();
}

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.replace("Bearer ", "").trim();
}

function hasMissingResultMetadata(data: any) {
  return (
    !safeString(data.testId) ||
    !safeString(data.assignmentCode) ||
    !safeString(data.teacherEmail) ||
    !safeString(data.classId) ||
    data.score === undefined ||
    data.score === null
  );
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const db = getAdminDb();

    const resultsSnapshot = await db.collection("results").get();
    const assignmentsSnapshot = await db.collection("testAssignments").get();

    const assignmentById = new Map<string, any>();
    const assignmentByCode = new Map<string, any>();

    for (const doc of assignmentsSnapshot.docs) {
      const data = doc.data() || {};
      assignmentById.set(doc.id, { id: doc.id, ...data });

      const code = safeString(data.assignmentCode);
      if (code) {
        assignmentByCode.set(code, { id: doc.id, ...data });
      }
    }

    let totalResults = 0;
    let needReview = 0;
    let canAutoFillFromAssignment = 0;
    let cannotAutoFill = 0;

    const samples: any[] = [];

    for (const doc of resultsSnapshot.docs) {
      totalResults += 1;

      const data = doc.data() || {};

      if (!hasMissingResultMetadata(data)) continue;

      needReview += 1;

      const assignmentId = safeString(data.assignmentId);
      const assignmentCode = safeString(data.assignmentCode);

      const assignment =
        assignmentById.get(assignmentId) || assignmentByCode.get(assignmentCode);

      if (assignment) {
        canAutoFillFromAssignment += 1;
      } else {
        cannotAutoFill += 1;
      }

      if (samples.length < 80) {
        samples.push({
          id: doc.id,
          studentCode: safeString(data.studentCode),
          studentName: safeString(data.studentName),
          current: {
            testId: safeString(data.testId),
            assignmentId,
            assignmentCode,
            teacherEmail: normalizeEmail(data.teacherEmail),
            classId: safeString(data.classId),
            className: safeString(data.className),
            score: data.score ?? null,
          },
          proposedFromAssignment: assignment
            ? {
                assignmentId: assignment.id,
                assignmentCode: safeString(assignment.assignmentCode),
                testId: safeString(assignment.testId),
                testTitle: safeString(assignment.testTitle),
                teacherEmail: normalizeEmail(assignment.teacherEmail),
                teacherName: safeString(assignment.teacherName),
                classIds: Array.isArray(assignment.classIds)
                  ? assignment.classIds
                  : [],
                classNames: Array.isArray(assignment.classNames)
                  ? assignment.classNames
                  : [],
                schoolId: safeString(assignment.schoolId),
              }
            : null,
          reason: "missing_result_metadata",
        });
      }
    }

    return NextResponse.json({
      status: "success",
      generatedAt: new Date().toISOString(),
      admin,
      summary: {
        totalResults,
        needReview,
        canAutoFillFromAssignment,
        cannotAutoFill,
      },
      samples,
      warning:
        "Preview only. Results metadata cần rất cẩn thận; chỉ auto-fill khi tìm được assignment rõ ràng.",
    });
  } catch (error: any) {
    console.error("preview results metadata error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error?.message || "Không tạo được preview results metadata.",
      },
      { status: 500 }
    );
  }
}