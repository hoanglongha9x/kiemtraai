import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";
import { hashPassword } from "@/lib/security/password";

export const runtime = "nodejs";

const REQUIRED_CONFIRM_TEXT = "MIGRATE PASSWORDHASH";

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

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const body = await request.json();

    const confirmText = safeString(body.confirmText);
    const limit = Number(body.limit || 500);

    if (confirmText !== REQUIRED_CONFIRM_TEXT) {
      return NextResponse.json(
        {
          status: "error",
          message: `Xác nhận chưa đúng. Vui lòng nhập chính xác: ${REQUIRED_CONFIRM_TEXT}`,
        },
        { status: 400 }
      );
    }

    if (limit <= 0 || limit > 1000) {
      return NextResponse.json(
        {
          status: "error",
          message: "limit phải nằm trong khoảng 1 đến 1000.",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const snapshot = await db.collection("testAssignments").get();

    let scanned = 0;
    let migrated = 0;
    let skipped = 0;

    let batch = db.batch();
    let batchCount = 0;

    const samples: any[] = [];

    async function commitBatchIfNeeded(force = false) {
      if (batchCount === 0) return;

      if (force || batchCount >= 450) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    for (const doc of snapshot.docs) {
      scanned += 1;

      if (migrated >= limit) {
        skipped += 1;
        continue;
      }

      const data = doc.data() || {};
      const hasPassword = Boolean(data.hasPassword);
      const passwordHash = safeString(data.passwordHash);
      const legacyPassword = safeString(data.password);

      const shouldMigrate =
        hasPassword && !passwordHash && legacyPassword.length > 0;

      if (!shouldMigrate) {
        skipped += 1;
        continue;
      }

      const newPasswordHash = await hashPassword(legacyPassword);

      batch.update(doc.ref, {
        passwordHash: newPasswordHash,
        hasPassword: true,

        passwordHashMigratedAt: new Date().toISOString(),
        passwordHashMigratedBy: admin.email,
        passwordHashMigrationNote:
          "Migrated legacy plaintext assignment password to passwordHash.",

        updatedAt: new Date().toISOString(),
      });

      batchCount += 1;
      migrated += 1;

      if (samples.length < 30) {
        samples.push({
          id: doc.id,
          assignmentCode: safeString(data.assignmentCode),
          testTitle: safeString(data.testTitle),
          teacherEmail: normalizeEmail(data.teacherEmail),
          schoolId: safeString(data.schoolId),
          status: safeString(data.status || "active"),
        });
      }

      await commitBatchIfNeeded(false);
    }

    await commitBatchIfNeeded(true);

    return NextResponse.json({
      status: "success",
      migratedAt: new Date().toISOString(),
      admin,
      confirmText,
      limit,
      summary: {
        totalCollections: 1,
        totalScanned: scanned,
        totalMigrated: migrated,
        totalSkipped: skipped,
      },
      result: {
        collection: "testAssignments",
        scanned,
        migrated,
        skipped,
        samples,
      },
      note:
        "Migration passwordHash đã chạy thật. Plaintext password cũ chưa bị xóa để tránh làm hỏng dữ liệu; có thể dọn sau khi xác nhận hệ thống ổn.",
    });
  } catch (error: any) {
    console.error("migrate passwordHash error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không migrate được passwordHash.",
      },
      { status: 500 }
    );
  }
}