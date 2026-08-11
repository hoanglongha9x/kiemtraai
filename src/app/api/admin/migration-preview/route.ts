import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type PreviewItem = {
  id: string;
  collection: string;
  currentSchoolId: string;
  proposedSchoolId: string;
  reason: "missing_schoolId" | "empty_schoolId" | "default_schoolId";
  title: string;
  teacherEmail: string;
  className: string;
  studentCode: string;
  assignmentCode: string;
  testId: string;
};

type CollectionPreview = {
  collection: string;
  totalNeedMigration: number;
  missingSchoolId: number;
  emptySchoolId: number;
  defaultSchoolId: number;
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

function getSchoolIdReason(data: any):
  | "missing_schoolId"
  | "empty_schoolId"
  | "default_schoolId"
  | "" {
  if (data.schoolId === undefined || data.schoolId === null) {
    return "missing_schoolId";
  }

  const schoolId = safeString(data.schoolId);

  if (!schoolId) {
    return "empty_schoolId";
  }

  if (schoolId === "default") {
    return "default_schoolId";
  }

  return "";
}

function getCurrentSchoolId(data: any) {
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

function buildPreviewItem(
  collection: string,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  proposedSchoolId: string
): PreviewItem | null {
  const data = doc.data() || {};
  const reason = getSchoolIdReason(data);

  if (!reason) return null;

  return {
    id: doc.id,
    collection,
    currentSchoolId: getCurrentSchoolId(data),
    proposedSchoolId,
    reason,
    title: buildTitle(collection, data),
    teacherEmail: normalizeEmail(data.teacherEmail),
    className: safeString(data.className),
    studentCode: safeString(data.studentCode),
    assignmentCode: safeString(data.assignmentCode),
    testId: safeString(data.testId),
  };
}

async function previewCollection(
  collection: string,
  proposedSchoolId: string
): Promise<CollectionPreview> {
  const db = getAdminDb();
  const snapshot = await db.collection(collection).get();

  let missingSchoolId = 0;
  let emptySchoolId = 0;
  let defaultSchoolId = 0;

  const samples: PreviewItem[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const reason = getSchoolIdReason(data);

    if (!reason) continue;

    if (reason === "missing_schoolId") missingSchoolId += 1;
    if (reason === "empty_schoolId") emptySchoolId += 1;
    if (reason === "default_schoolId") defaultSchoolId += 1;

    if (samples.length < 30) {
      const item = buildPreviewItem(collection, doc, proposedSchoolId);

      if (item) {
        samples.push(item);
      }
    }
  }

  return {
    collection,
    totalNeedMigration: missingSchoolId + emptySchoolId + defaultSchoolId,
    missingSchoolId,
    emptySchoolId,
    defaultSchoolId,
    samples,
  };
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);

    const url = new URL(request.url);
    const targetSchoolId =
      safeString(url.searchParams.get("targetSchoolId")) ||
      safeString(admin.schoolId) ||
      "fpt";

    const collectionsToPreview = [
      "classes",
      "students",
      "tests",
      "testAssignments",
      "results",
      "questionBank",
    ];

    const previews = await Promise.all(
      collectionsToPreview.map((collection) =>
        previewCollection(collection, targetSchoolId)
      )
    );

    const totalNeedMigration = previews.reduce(
      (sum, item) => sum + item.totalNeedMigration,
      0
    );

    return NextResponse.json({
      status: "success",
      generatedAt: new Date().toISOString(),
      admin,
      targetSchoolId,
      summary: {
        totalCollections: previews.length,
        totalNeedMigration,
        collectionsNeedMigration: previews.filter(
          (item) => item.totalNeedMigration > 0
        ).length,
      },
      previews,
      warning:
        "Đây chỉ là preview. API này chưa ghi dữ liệu vào Firestore.",
    });
  } catch (error: any) {
    console.error("admin migration preview API error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tạo được migration preview.",
      },
      { status: 500 }
    );
  }
}