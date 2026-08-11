import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type MigrationResult = {
  collection: "testAssignments";
  scanned: number;
  migrated: number;
  skipped: number;
  samples: {
    id: string;
    assignmentCode: string;
    testTitle: string;
    previousClassId: string;
    previousClassName: string;
    newClassIds: string[];
    newClassNames: string[];
  }[];
};

const REQUIRED_CONFIRM_TEXT = "MIGRATE CLASSIDS";

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

function getMigrationReason(data: any):
  | "missing_classIds_has_classId"
  | "empty_classIds_has_classId"
  | "invalid_classIds_has_classId"
  | "" {
  const classId = safeString(data.classId);

  if (!classId) {
    return "";
  }

  if (data.classIds === undefined || data.classIds === null) {
    return "missing_classIds_has_classId";
  }

  if (Array.isArray(data.classIds) && data.classIds.length === 0) {
    return "empty_classIds_has_classId";
  }

  if (!Array.isArray(data.classIds)) {
    return "invalid_classIds_has_classId";
  }

  return "";
}

function shouldMigrateClassIds(data: any): boolean {
  return Boolean(getMigrationReason(data));
}

async function migrateClassIds({
  adminEmail,
  limit,
}: {
  adminEmail: string;
  limit: number;
}): Promise<MigrationResult> {
  const db = getAdminDb();
  const snapshot = await db.collection("testAssignments").get();

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

    if (!shouldMigrateClassIds(data)) {
      skipped += 1;
      continue;
    }

    const classId = safeString(data.classId);
    const className = safeString(data.className);

    if (!classId) {
      skipped += 1;
      continue;
    }

    const newClassIds = [classId];
    const newClassNames = className ? [className] : [];

    batch.update(doc.ref, {
      classIds: newClassIds,
      classNames: newClassNames,
      classCount: 1,

      classIdsMigratedAt: new Date().toISOString(),
      classIdsMigratedBy: adminEmail,
      classIdsMigrationNote:
        "Migrated legacy classId/className to classIds/classNames.",

      updatedAt: new Date().toISOString(),
    });

    batchCount += 1;
    migrated += 1;

    if (samples.length < 30) {
      samples.push({
        id: doc.id,
        assignmentCode: safeString(data.assignmentCode),
        testTitle: safeString(data.testTitle || data.title),
        previousClassId: classId,
        previousClassName: className,
        newClassIds,
        newClassNames,
      });
    }

    await commitBatchIfNeeded(false);
  }

  await commitBatchIfNeeded(true);

  return {
    collection: "testAssignments",
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

    const result = await migrateClassIds({
      adminEmail: admin.email,
      limit,
    });

    return NextResponse.json({
      status: "success",
      migratedAt: new Date().toISOString(),
      admin,
      confirmText,
      limit,
      summary: {
        totalCollections: 1,
        totalScanned: result.scanned,
        totalMigrated: result.migrated,
        totalSkipped: result.skipped,
      },
      result,
      note:
        "Migration classIds đã chạy thật và đã update Firestore. Hãy chạy lại Data Health để kiểm tra.",
    });
  } catch (error: any) {
    console.error("admin migrate classIds API error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không migrate được classIds.",
      },
      { status: 500 }
    );
  }
}