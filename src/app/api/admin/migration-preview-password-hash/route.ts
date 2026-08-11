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

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const db = getAdminDb();

    const snapshot = await db.collection("testAssignments").get();

    let totalAssignments = 0;
    let needMigration = 0;
    let hasPasswordTrue = 0;
    let missingPasswordHash = 0;
    let hasLegacyPlainPassword = 0;

    const samples: any[] = [];

    for (const doc of snapshot.docs) {
      totalAssignments += 1;

      const data = doc.data() || {};
      const hasPassword = Boolean(data.hasPassword);
      const passwordHash = safeString(data.passwordHash);
      const legacyPassword = safeString(data.password);

      if (hasPassword) hasPasswordTrue += 1;

      const needsHash =
        hasPassword && !passwordHash && legacyPassword.length > 0;

      if (hasPassword && !passwordHash) {
        missingPasswordHash += 1;
      }

      if (legacyPassword.length > 0) {
        hasLegacyPlainPassword += 1;
      }

      if (!needsHash) continue;

      needMigration += 1;

      if (samples.length < 50) {
        samples.push({
          id: doc.id,
          assignmentCode: safeString(data.assignmentCode),
          testId: safeString(data.testId),
          testTitle: safeString(data.testTitle),
          classId: safeString(data.classId),
          classIds: Array.isArray(data.classIds) ? data.classIds : [],
          schoolId: safeString(data.schoolId),
          teacherEmail: normalizeEmail(data.teacherEmail),
          status: safeString(data.status || "active"),
          reason: "has_legacy_password_missing_passwordHash",
        });
      }
    }

    return NextResponse.json({
      status: "success",
      generatedAt: new Date().toISOString(),
      admin,
      summary: {
        totalAssignments,
        needMigration,
        hasPasswordTrue,
        missingPasswordHash,
        hasLegacyPlainPassword,
      },
      samples,
      warning:
        "Preview only. Không hiển thị plaintext password và chưa ghi Firestore.",
    });
  } catch (error: any) {
    console.error("preview passwordHash migration error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tạo được preview passwordHash.",
      },
      { status: 500 }
    );
  }
}