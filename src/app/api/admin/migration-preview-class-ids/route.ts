import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type PreviewItem = {
  id: string;
  assignmentCode: string;
  testId: string;
  testTitle: string;

  currentClassId: string;
  currentClassName: string;

  proposedClassIds: string[];
  proposedClassNames: string[];
  proposedClassCount: number;

  schoolId: string;
  teacherEmail: string;
  status: string;

  reason:
    | "missing_classIds_has_classId"
    | "empty_classIds_has_classId"
    | "invalid_classIds_has_classId";
};

type CollectionPreview = {
  collection: "testAssignments";
  totalNeedMigration: number;
  missingClassIds: number;
  emptyClassIds: number;
  invalidClassIds: number;
  samples: PreviewItem[];
};

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

function buildPreviewItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): PreviewItem | null {
  const data = doc.data() || {};
  const reason = getMigrationReason(data);

  if (!reason) return null;

  const classId = safeString(data.classId);
  const className = safeString(data.className);

  if (!classId) return null;

  return {
    id: doc.id,
    assignmentCode: safeString(data.assignmentCode),
    testId: safeString(data.testId),
    testTitle: safeString(data.testTitle || data.title),

    currentClassId: classId,
    currentClassName: className,

    proposedClassIds: [classId],
    proposedClassNames: className ? [className] : [],
    proposedClassCount: 1,

    schoolId: safeString(data.schoolId),
    teacherEmail: normalizeEmail(data.teacherEmail),
    status: safeString(data.status || "active"),

    reason,
  };
}

async function previewClassIdsMigration(): Promise<CollectionPreview> {
  const db = getAdminDb();
  const snapshot = await db.collection("testAssignments").get();

  let missingClassIds = 0;
  let emptyClassIds = 0;
  let invalidClassIds = 0;

  const samples: PreviewItem[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const reason = getMigrationReason(data);

    if (!reason) continue;

    if (reason === "missing_classIds_has_classId") {
      missingClassIds += 1;
    }

    if (reason === "empty_classIds_has_classId") {
      emptyClassIds += 1;
    }

    if (reason === "invalid_classIds_has_classId") {
      invalidClassIds += 1;
    }

    if (samples.length < 50) {
      const item = buildPreviewItem(doc);

      if (item) {
        samples.push(item);
      }
    }
  }

  return {
    collection: "testAssignments",
    totalNeedMigration: missingClassIds + emptyClassIds + invalidClassIds,
    missingClassIds,
    emptyClassIds,
    invalidClassIds,
    samples,
  };
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);

    const preview = await previewClassIdsMigration();

    return NextResponse.json({
      status: "success",
      generatedAt: new Date().toISOString(),
      admin,
      summary: {
        totalCollections: 1,
        totalNeedMigration: preview.totalNeedMigration,
        collectionsNeedMigration: preview.totalNeedMigration > 0 ? 1 : 0,
      },
      preview,
      warning:
        "Đây chỉ là preview. API này chưa ghi dữ liệu vào Firestore.",
    });
  } catch (error: any) {
    console.error("admin migration preview classIds API error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error?.message || "Không tạo được preview migration classIds.",
      },
      { status: 500 }
    );
  }
}