import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type MigrationResult = {
  collection: string;
  scanned: number;
  migrated: number;
  skipped: number;
  samples: {
    id: string;
    previousSchoolId: string;
    newSchoolId: string;
    title: string;
  }[];
};

const ALLOWED_COLLECTIONS = [
  "classes",
  "students",
  "tests",
  "testAssignments",
  "results",
  "questionBank",
];

const REQUIRED_CONFIRM_TEXT = "MIGRATE SCHOOLID TO FPT";

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown): string {
  return safeString(value).toLowerCase();
}

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.replace("Bearer ", "").trim();
}

function shouldMigrateSchoolId(data: any) {
  if (data.schoolId === undefined || data.schoolId === null) {
    return true;
  }

  const schoolId = safeString(data.schoolId);

  if (!schoolId) return true;

  if (schoolId === "default") return true;

  return false;
}

function getPreviousSchoolId(data: any) {
  if (data.schoolId === undefined || data.schoolId === null) {
    return "__missing__";
  }

  const schoolId = safeString(data.schoolId);

  if (!schoolId) {
    return "__empty__";
  }

  return schoolId;
}

function buildTitle(collection: string, data: any) {
  if (collection === "classes") {
    return safeString(data.className || data.name || "Không có tên lớp");
  }

  if (collection === "students") {
    return safeString(data.studentName || data.name || "Không có tên học sinh");
  }

  if (collection === "tests") {
    return safeString(data.title || data.testTitle || "Không có tên đề");
  }

  if (collection === "testAssignments") {
    return safeString(data.testTitle || data.assignmentCode || "Giao đề");
  }

  if (collection === "results") {
    return safeString(
      `${data.studentName || "Học sinh"} - ${data.testTitle || "Bài làm"}`
    );
  }

  if (collection === "questionBank") {
    const question = safeString(data.question);
    return question ? question.slice(0, 80) : "Câu hỏi";
  }

  return "Document";
}

function sanitizeCollections(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ALLOWED_COLLECTIONS;
  }

  const requested = value
    .map((item) => safeString(item))
    .filter((item) => ALLOWED_COLLECTIONS.includes(item));

  if (requested.length === 0) {
    return ALLOWED_COLLECTIONS;
  }

  return requested;
}

async function migrateCollection({
  collection,
  targetSchoolId,
  adminEmail,
  limit,
}: {
  collection: string;
  targetSchoolId: string;
  adminEmail: string;
  limit: number;
}): Promise<MigrationResult> {
  const db = getAdminDb();
  const snapshot = await db.collection(collection).get();

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  const samples: MigrationResult["samples"] = [];

  let batch = db.batch();
  let batchCount = 0;

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

    if (!shouldMigrateSchoolId(data)) {
      skipped += 1;
      continue;
    }

    const previousSchoolId = getPreviousSchoolId(data);

    batch.update(doc.ref, {
      schoolId: targetSchoolId,

      previousSchoolIdBeforeMigration: previousSchoolId,
      schoolIdMigratedAt: new Date().toISOString(),
      schoolIdMigratedBy: adminEmail,
      schoolIdMigrationNote:
        "Migrated schoolId from missing/empty/default to target schoolId.",

      updatedAt: new Date().toISOString(),
    });

    batchCount += 1;
    migrated += 1;

    if (samples.length < 20) {
      samples.push({
        id: doc.id,
        previousSchoolId,
        newSchoolId: targetSchoolId,
        title: buildTitle(collection, data),
      });
    }

    await commitBatchIfNeeded(false);
  }

  await commitBatchIfNeeded(true);

  return {
    collection,
    scanned,
    migrated,
    skipped,
    samples,
  };
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);

    const body = await request.json();

    const confirmText = safeString(body.confirmText);
    const targetSchoolId = safeString(body.targetSchoolId || "fpt");
    const collections = sanitizeCollections(body.collections);

    const limitPerCollection = Number(body.limitPerCollection || 500);

    if (confirmText !== REQUIRED_CONFIRM_TEXT) {
      return NextResponse.json(
        {
          status: "error",
          message: `Xác nhận chưa đúng. Vui lòng nhập chính xác: ${REQUIRED_CONFIRM_TEXT}`,
        },
        { status: 400 }
      );
    }

    if (!targetSchoolId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Thiếu targetSchoolId.",
        },
        { status: 400 }
      );
    }

    if (targetSchoolId === "default") {
      return NextResponse.json(
        {
          status: "error",
          message: "Không được migrate sang schoolId = default.",
        },
        { status: 400 }
      );
    }

    if (limitPerCollection <= 0 || limitPerCollection > 1000) {
      return NextResponse.json(
        {
          status: "error",
          message: "limitPerCollection phải nằm trong khoảng 1 đến 1000.",
        },
        { status: 400 }
      );
    }

    const results: MigrationResult[] = [];

    for (const collection of collections) {
      const result = await migrateCollection({
        collection,
        targetSchoolId,
        adminEmail: admin.email,
        limit: limitPerCollection,
      });

      results.push(result);
    }

    const totalScanned = results.reduce((sum, item) => sum + item.scanned, 0);
    const totalMigrated = results.reduce((sum, item) => sum + item.migrated, 0);
    const totalSkipped = results.reduce((sum, item) => sum + item.skipped, 0);

    return NextResponse.json({
      status: "success",
      migratedAt: new Date().toISOString(),
      admin,
      targetSchoolId,
      confirmText,
      limitPerCollection,
      summary: {
        totalCollections: results.length,
        totalScanned,
        totalMigrated,
        totalSkipped,
      },
      results,
      note:
        "Migration đã chạy thật và đã update Firestore. Hãy chạy lại Data Health để kiểm tra.",
    });
  } catch (error: any) {
    console.error("admin migrate schoolId API error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không migrate được schoolId.",
      },
      { status: 500 }
    );
  }
}