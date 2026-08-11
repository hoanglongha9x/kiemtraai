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

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const db = getAdminDb();

    const testSnapshot = await db
      .collection("tests")
      .where("schoolId", "==", admin.schoolId)
      .get();

    let totalTests = 0;
    let testsWithEmbeddedQuestions = 0;
    let testsNeedMigration = 0;

    let totalEmbeddedQuestions = 0;
    let questionsMissingMetadata = 0;
    let questionsWithBankQuestionId = 0;
    let questionsCanUpdateFromBank = 0;
    let questionsCannotUpdate = 0;

    const bankQuestionIds = new Set<string>();

    const testPreviews: any[] = [];

    for (const testDoc of testSnapshot.docs) {
      totalTests++;

      const test = testDoc.data() || {};
      const questions = Array.isArray(test.questions) ? test.questions : [];

      if (questions.length === 0) continue;

      testsWithEmbeddedQuestions++;
      totalEmbeddedQuestions += questions.length;

      let testMissingMetadata = 0;
      let testCanUpdate = 0;
      let testCannotUpdate = 0;

      for (const question of questions) {
        const missingMetadata = !hasMetadata(question);

        if (!missingMetadata) continue;

        testMissingMetadata++;

        const bankQuestionId = safeString(
          question.bankQuestionId || question.questionBankId || question.id
        );

        if (bankQuestionId) {
          questionsWithBankQuestionId++;
          bankQuestionIds.add(bankQuestionId);
        } else {
          testCannotUpdate++;
        }
      }

      if (testMissingMetadata > 0) {
        testPreviews.push({
          id: testDoc.id,
          title: safeString(test.title),
          subject: safeString(test.subject),
          grade: safeString(test.grade),
          teacherEmail: safeString(test.teacherEmail),
          schoolId: safeString(test.schoolId),
          status: safeString(test.status),
          source: safeString(test.source),
          questionCount: questions.length,
          missingMetadataCount: testMissingMetadata,
          canUpdateFromBankCount: 0,
          cannotUpdateCount: testCannotUpdate,
        });
      }
    }

    const bankMap = new Map<string, any>();

    if (bankQuestionIds.size > 0) {
      const ids = Array.from(bankQuestionIds);

      for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);

        const bankSnapshot = await db
          .collection("questionBank")
          .where("__name__", "in", chunk)
          .get();

        bankSnapshot.docs.forEach((doc) => {
          bankMap.set(doc.id, doc.data() || {});
        });
      }
    }

    for (const testDoc of testSnapshot.docs) {
      const test = testDoc.data() || {};
      const questions = Array.isArray(test.questions) ? test.questions : [];

      if (questions.length === 0) continue;

      for (const question of questions) {
        if (hasMetadata(question)) continue;

        questionsMissingMetadata++;

        const bankQuestionId = safeString(
          question.bankQuestionId || question.questionBankId || question.id
        );

        if (!bankQuestionId) {
          questionsCannotUpdate++;
          continue;
        }

        const bankQuestion = bankMap.get(bankQuestionId);

        if (!bankQuestion) {
          questionsCannotUpdate++;
          continue;
        }

        const bankHasMetadata = hasMetadata(bankQuestion);

        if (bankHasMetadata) {
          questionsCanUpdateFromBank++;
        } else {
          questionsCannotUpdate++;
        }
      }
    }

    testPreviews.forEach((preview) => {
      preview.canUpdateFromBankCount = 0;
      preview.cannotUpdateCount = 0;
    });

    for (const testDoc of testSnapshot.docs) {
      const test = testDoc.data() || {};
      const questions = Array.isArray(test.questions) ? test.questions : [];

      if (questions.length === 0) continue;

      const preview = testPreviews.find((item) => item.id === testDoc.id);

      if (!preview) continue;

      for (const question of questions) {
        if (hasMetadata(question)) continue;

        const bankQuestionId = safeString(
          question.bankQuestionId || question.questionBankId || question.id
        );

        if (!bankQuestionId) {
          preview.cannotUpdateCount++;
          continue;
        }

        const bankQuestion = bankMap.get(bankQuestionId);

        if (bankQuestion && hasMetadata(bankQuestion)) {
          preview.canUpdateFromBankCount++;
        } else {
          preview.cannotUpdateCount++;
        }
      }

      if (preview.canUpdateFromBankCount > 0) {
        testsNeedMigration++;
      }
    }

    return NextResponse.json({
      status: "success",
      generatedAt: new Date().toISOString(),
      admin: {
        email: admin.email,
        role: admin.role,
        schoolId: admin.schoolId,
      },
      summary: {
        totalTests,
        testsWithEmbeddedQuestions,
        testsNeedMigration,
        totalEmbeddedQuestions,
        questionsMissingMetadata,
        questionsWithBankQuestionId,
        questionsCanUpdateFromBank,
        questionsCannotUpdate,
      },
      samples: testPreviews
        .filter((item) => item.canUpdateFromBankCount > 0)
        .slice(0, 80),
      warning:
        "Preview chỉ kiểm tra đề có embedded questions[] và câu hỏi có bankQuestionId để đối chiếu với questionBank.",
    });
  } catch (error: any) {
    console.error(
      "GET /api/admin/migration-preview-test-question-metadata error:",
      error
    );

    return NextResponse.json(
      {
        status: "error",
        message:
          error?.message || "Không tạo được preview test question metadata.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}