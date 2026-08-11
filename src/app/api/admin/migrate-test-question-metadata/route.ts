import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

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

function safeString(value: unknown) {
  return String(value || "").trim();
}

function safeLower(value: unknown) {
  return safeString(value).toLowerCase();
}

function hasMetadata(question: any) {
  return Boolean(
    safeString(question.knowledgeUnit) ||
      safeString(question.skill) ||
      safeString(question.learningOutcome) ||
      safeString(question.cognitiveLevel)
  );
}

function normalizeCognitiveLevel(value: unknown) {
  const level = safeString(value).toLowerCase();

  if (
    level === "recognition" ||
    level === "understanding" ||
    level === "application" ||
    level === "high_application"
  ) {
    return level;
  }

  return "understanding";
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => safeString(item))
    .filter(Boolean)
    .slice(0, 20);
}

function enrichQuestionWithBankMetadata(question: any, bankQuestion: any) {
  return {
    ...question,

    subject: safeString(question.subject || bankQuestion.subject),
    grade: safeString(question.grade || bankQuestion.grade),
    topic: safeString(question.topic || bankQuestion.topic),

    knowledgeUnit: safeString(bankQuestion.knowledgeUnit),
    skill: safeString(bankQuestion.skill),
    learningOutcome: safeString(bankQuestion.learningOutcome),
    cognitiveLevel: normalizeCognitiveLevel(bankQuestion.cognitiveLevel),

    difficulty: safeString(question.difficulty || bankQuestion.difficulty || "medium"),
    tags:
      normalizeTags(question.tags).length > 0
        ? normalizeTags(question.tags)
        : normalizeTags(bankQuestion.tags),

    metadataMigratedAt: new Date().toISOString(),
    metadataMigratedFrom: "questionBank",
  };
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const body = await request.json();

    const requiredText = "MIGRATE TEST QUESTION METADATA";
    const confirmText = safeString(body.confirmText);
    const limit = Number(body.limit || 300);

    if (confirmText !== requiredText) {
      throw new ApiError(`Bạn cần nhập chính xác: ${requiredText}`, 400);
    }

    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.round(limit), 1), 500)
      : 300;

    const db = getAdminDb();

    const testSnapshot = await db
      .collection("tests")
      .where("schoolId", "==", admin.schoolId)
      .limit(safeLimit)
      .get();

    let scanned = 0;
    let migrated = 0;
    let skipped = 0;
    let updatedQuestions = 0;
    let cannotUpdateQuestions = 0;

    const samples: any[] = [];

    const bankCache = new Map<string, any | null>();

    async function getBankQuestion(bankQuestionId: string) {
      if (bankCache.has(bankQuestionId)) {
        return bankCache.get(bankQuestionId);
      }

      const bankDoc = await db.collection("questionBank").doc(bankQuestionId).get();

      if (!bankDoc.exists) {
        bankCache.set(bankQuestionId, null);
        return null;
      }

      const data = bankDoc.data() || {};
      bankCache.set(bankQuestionId, data);

      return data;
    }

    for (const testDoc of testSnapshot.docs) {
      scanned++;

      const test = testDoc.data() || {};
      const questions = Array.isArray(test.questions) ? test.questions : [];

      if (questions.length === 0) {
        skipped++;
        continue;
      }

      let changed = false;
      let changedCount = 0;
      let cannotCount = 0;

      const nextQuestions = [];

      for (const question of questions) {
        if (hasMetadata(question)) {
          nextQuestions.push(question);
          continue;
        }

        const bankQuestionId = safeString(
          question.bankQuestionId || question.questionBankId || question.id
        );

        if (!bankQuestionId) {
          cannotCount++;
          nextQuestions.push(question);
          continue;
        }

        const bankQuestion = await getBankQuestion(bankQuestionId);

        if (!bankQuestion || !hasMetadata(bankQuestion)) {
          cannotCount++;
          nextQuestions.push(question);
          continue;
        }

        nextQuestions.push(enrichQuestionWithBankMetadata(question, bankQuestion));
        changed = true;
        changedCount++;
      }

      if (!changed) {
        skipped++;
        cannotUpdateQuestions += cannotCount;
        continue;
      }

      await testDoc.ref.update({
        questions: nextQuestions,
        metadataMigratedAt: new Date().toISOString(),
        metadataMigratedBy: admin.email,
        updatedAt: new Date().toISOString(),
        updatedBy: admin.email,
      });

      migrated++;
      updatedQuestions += changedCount;
      cannotUpdateQuestions += cannotCount;

      samples.push({
        id: testDoc.id,
        title: safeString(test.title),
        subject: safeString(test.subject),
        grade: safeString(test.grade),
        teacherEmail: safeString(test.teacherEmail),
        schoolId: safeString(test.schoolId),
        updatedQuestionCount: changedCount,
        cannotUpdateQuestionCount: cannotCount,
      });
    }

    return NextResponse.json({
      status: "success",
      migratedAt: new Date().toISOString(),
      confirmText: requiredText,
      limit: safeLimit,
      admin: {
        email: admin.email,
        role: admin.role,
        schoolId: admin.schoolId,
      },
      summary: {
        totalCollections: 1,
        totalScanned: scanned,
        totalMigrated: migrated,
        totalSkipped: skipped,
        updatedQuestions,
        cannotUpdateQuestions,
      },
      result: {
        collection: "tests",
        scanned,
        migrated,
        skipped,
        updatedQuestions,
        cannotUpdateQuestions,
        samples: samples.slice(0, 50),
      },
      note:
        "Migration chỉ cập nhật metadata cho tests.questions[] có bankQuestionId và tìm được metadata trong questionBank.",
    });
  } catch (error: any) {
    console.error("POST /api/admin/migrate-test-question-metadata error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không chạy được migration metadata câu hỏi.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}