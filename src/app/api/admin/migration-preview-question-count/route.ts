import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type PreviewItem = {
  id: string;
  title: string;
  teacherEmail: string;
  schoolId: string;
  status: string;
  source: string;

  currentQuestionCount: number | null;
  proposedQuestionCount: number;

  embeddedQuestionCount: number;
  questionCollectionCount: number;

  reason:
    | "missing_questionCount"
    | "mismatched_questionCount"
    | "invalid_questionCount";
};

type QuestionCountPreviewResponse = {
  status: "success";
  generatedAt: string;
  admin: {
    email: string;
    role: string;
    schoolId: string;
  };
  summary: {
    totalTests: number;
    totalNeedMigration: number;
    missingQuestionCount: number;
    invalidQuestionCount: number;
    mismatchedQuestionCount: number;
    testsWithEmbeddedQuestions: number;
    testsWithQuestionsCollection: number;
    testsWithNoQuestions: number;
  };
  samples: PreviewItem[];
  warning: string;
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

function getEmbeddedQuestionCount(test: any): number {
  if (!Array.isArray(test.questions)) {
    return 0;
  }

  return test.questions.length;
}

function getCurrentQuestionCount(test: any): number | null {
  if (test.questionCount === undefined || test.questionCount === null) {
    return null;
  }

  const count = Number(test.questionCount);

  if (!Number.isFinite(count) || count < 0) {
    return null;
  }

  return count;
}

function getReason({
  currentQuestionCount,
  proposedQuestionCount,
  rawQuestionCount,
}: {
  currentQuestionCount: number | null;
  proposedQuestionCount: number;
  rawQuestionCount: unknown;
}): PreviewItem["reason"] | "" {
  if (rawQuestionCount !== undefined && rawQuestionCount !== null) {
    const rawNumber = Number(rawQuestionCount);

    if (!Number.isFinite(rawNumber) || rawNumber < 0) {
      return "invalid_questionCount";
    }
  }

  if (currentQuestionCount === null) {
    return "missing_questionCount";
  }

  if (currentQuestionCount !== proposedQuestionCount) {
    return "mismatched_questionCount";
  }

  return "";
}

async function buildQuestionsCountMap() {
  const db = getAdminDb();
  const snapshot = await db.collection("questions").get();

  const map = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const testId = safeString(data.testId);

    if (!testId) continue;

    map.set(testId, (map.get(testId) || 0) + 1);
  }

  return map;
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const db = getAdminDb();

    const testsSnapshot = await db.collection("tests").get();
    const questionCountMap = await buildQuestionsCountMap();

    let totalTests = 0;
    let missingQuestionCount = 0;
    let invalidQuestionCount = 0;
    let mismatchedQuestionCount = 0;
    let testsWithEmbeddedQuestions = 0;
    let testsWithQuestionsCollection = 0;
    let testsWithNoQuestions = 0;

    const samples: PreviewItem[] = [];

    for (const testDoc of testsSnapshot.docs) {
      totalTests += 1;

      const test = testDoc.data() || {};
      const embeddedQuestionCount = getEmbeddedQuestionCount(test);
      const questionCollectionCount = questionCountMap.get(testDoc.id) || 0;

      if (embeddedQuestionCount > 0) {
        testsWithEmbeddedQuestions += 1;
      } else if (questionCollectionCount > 0) {
        testsWithQuestionsCollection += 1;
      }

      const proposedQuestionCount =
        embeddedQuestionCount > 0
          ? embeddedQuestionCount
          : questionCollectionCount;

      if (proposedQuestionCount === 0) {
        testsWithNoQuestions += 1;
      }

      const currentQuestionCount = getCurrentQuestionCount(test);

      const reason = getReason({
        currentQuestionCount,
        proposedQuestionCount,
        rawQuestionCount: test.questionCount,
      });

      if (!reason) {
        continue;
      }

      if (reason === "missing_questionCount") {
        missingQuestionCount += 1;
      }

      if (reason === "invalid_questionCount") {
        invalidQuestionCount += 1;
      }

      if (reason === "mismatched_questionCount") {
        mismatchedQuestionCount += 1;
      }

      if (samples.length < 80) {
        samples.push({
          id: testDoc.id,
          title: safeString(test.title || test.testTitle || "Không có tên đề"),
          teacherEmail: normalizeEmail(test.teacherEmail),
          schoolId: safeString(test.schoolId),
          status: safeString(test.status || "draft"),
          source: safeString(test.source || "manual"),

          currentQuestionCount,
          proposedQuestionCount,

          embeddedQuestionCount,
          questionCollectionCount,

          reason,
        });
      }
    }

    const totalNeedMigration =
      missingQuestionCount + invalidQuestionCount + mismatchedQuestionCount;

    const response: QuestionCountPreviewResponse = {
      status: "success",
      generatedAt: new Date().toISOString(),
      admin,
      summary: {
        totalTests,
        totalNeedMigration,
        missingQuestionCount,
        invalidQuestionCount,
        mismatchedQuestionCount,
        testsWithEmbeddedQuestions,
        testsWithQuestionsCollection,
        testsWithNoQuestions,
      },
      samples,
      warning:
        "Đây chỉ là preview. API này chưa ghi dữ liệu vào Firestore.",
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("admin migration preview questionCount API error:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          error?.message || "Không tạo được preview migration questionCount.",
      },
      { status: 500 }
    );
  }
}