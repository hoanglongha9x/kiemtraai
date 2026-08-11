import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";

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

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function safeLower(value: unknown): string {
  return safeString(value).toLowerCase();
}

function cleanQuestionText(value: unknown): string {
  return safeString(value)
    .split("\n")
    .filter(
      (line) =>
        !/^\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa/i.test(line)
    )
    .join("\n")
    .replace(
      /\s*\[GHI CHÚ:\s*Cần chèn ảnh minh họa[^\]]*\]/gi,
      ""
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAnswer(value: unknown): string {
  const answer = safeString(value).toUpperCase();

  if (answer === "A" || answer === "B" || answer === "C" || answer === "D") {
    return answer;
  }

  return "";
}

function normalizeQuestionType(value: unknown, fallback?: unknown): string {
  const raw = `${safeString(value)} ${safeString(fallback)}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");

  if (
    raw.includes("true_false_group") ||
    raw.includes("dung sai") ||
    raw.includes("true false")
  ) {
    return "true_false_group";
  }

  if (
    raw.includes("short_answer") ||
    raw.includes("tra loi ngan") ||
    raw.includes("short answer")
  ) {
    return "short_answer";
  }

  return "single_choice";
}

function answerToDisplay(value: unknown): string {
  if (safeString(value) === "[object Object]") {
    return "";
  }

  const directAnswer = normalizeAnswer(value);

  if (directAnswer) {
    return directAnswer;
  }

  if (typeof value === "boolean") {
    return value ? "Đúng" : "Sai";
  }

  if (Array.isArray(value)) {
    return value.map(answerToDisplay).filter(Boolean).join(", ");
  }

  const record = readObject(value);
  const entries = ["A", "B", "C", "D"]
    .map((key) => {
      const item = record[key] ?? record[key.toLowerCase()];
      const normalizedItem = normalizeTrueFalseValue(item);

      if (typeof normalizedItem !== "boolean") {
        return "";
      }

      return `${key}: ${normalizedItem ? "Đúng" : "Sai"}`;
    })
    .filter(Boolean);

  if (entries.length > 0) {
    return entries.join(", ");
  }

  return safeString(value);
}

function normalizeTrueFalseValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }

  const text = safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim();

  if (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "y" ||
    text === "dung"
  ) {
    return true;
  }

  if (
    text === "false" ||
    text === "0" ||
    text === "no" ||
    text === "n" ||
    text === "sai"
  ) {
    return false;
  }

  return undefined;
}

function normalizeTrueFalseRecord(value: unknown): Record<string, boolean> {
  if (Array.isArray(value)) {
    const normalized: Record<string, boolean> = {};

    value.slice(0, 4).forEach((item, index) => {
      const key = ["A", "B", "C", "D"][index];
      const normalizedValue = normalizeTrueFalseValue(item);

      if (key && typeof normalizedValue === "boolean") {
        normalized[key] = normalizedValue;
      }
    });

    return normalized;
  }

  const record = readObject(value);
  const normalized: Record<string, boolean> = {};

  ["A", "B", "C", "D"].forEach((key) => {
    const item = record[key] ?? record[key.toLowerCase()];
    const normalizedValue = normalizeTrueFalseValue(item);

    if (typeof normalizedValue === "boolean") {
      normalized[key] = normalizedValue;
    }
  });

  return normalized;
}

function normalizeResultScore(result: any) {
  const storedScore = Number(result.score || 0);
  const storedTotalScore = Number(result.totalScore || 10);
  const storedPercentage = Number(result.percentage);
  const percentage =
    Number.isFinite(storedPercentage)
      ? storedPercentage
      : storedTotalScore > 0
        ? (storedScore / storedTotalScore) * 100
        : 0;

  return {
    score: Number(((Math.max(0, percentage) / 100) * 10).toFixed(2)),
    totalScore: 10,
  };
}

function normalizeLeaveWarnings(result: any) {
  const nested = readObject(result.antiCheat);
  const events = Array.isArray(result.suspiciousEvents)
    ? result.suspiciousEvents
    : Array.isArray(nested.suspiciousEvents)
      ? nested.suspiciousEvents
      : [];
  const visibilityLostCount = Math.max(
    0,
    Number(result.visibilityLostCount ?? nested.visibilityLostCount ?? 0)
  );
  const focusLostCount = Math.max(
    0,
    Number(result.focusLostCount ?? nested.focusLostCount ?? 0)
  );
  const count = Math.max(
    events.length,
    Number(result.suspiciousEventCount ?? nested.suspiciousEventCount ?? 0),
    visibilityLostCount + focusLostCount
  );

  return {
    count,
    events,
    visibilityLostCount,
    focusLostCount,
  };
}

function hasTrueFalseRecordValue(value: unknown): boolean {
  return Object.keys(normalizeTrueFalseRecord(value)).length > 0;
}

function calculateTrueFalseSummary(
  studentRaw: unknown,
  correctRaw: unknown
) {
  const studentAnswer =
    normalizeTrueFalseRecord(studentRaw);
  const correctAnswer =
    normalizeTrueFalseRecord(correctRaw);
  const answerKeys = ["A", "B", "C", "D"].filter(
    (key) =>
      typeof correctAnswer[key] ===
      "boolean"
  );
  const answeredStatementCount =
    answerKeys.filter(
      (key) =>
        typeof studentAnswer[key] ===
        "boolean"
    ).length;
  const correctStatementCount =
    answerKeys.filter(
      (key) =>
        typeof studentAnswer[key] ===
          "boolean" &&
        studentAnswer[key] ===
          correctAnswer[key]
    ).length;
  const totalStatementCount =
    answerKeys.length;

  return {
    answeredStatementCount,
    correctStatementCount,
    totalStatementCount,
    isAnswered:
      answeredStatementCount > 0,
    isCorrect:
      totalStatementCount > 0 &&
      correctStatementCount ===
        totalStatementCount,
  };
}

function canTeacherSeeResult(teacher: TeacherProfile, result: any): boolean {
  return safeLower(result.teacherEmail) === teacher.email;
}

function mapEmbeddedQuestion(question: any, index: number) {
  const snapshot = readObject(question.snapshot);
  const source = Object.keys(snapshot).length > 0 ? snapshot : question;
  const metadata = readObject(source.metadata);
  const options = Array.isArray(source.options) ? source.options : [];
  const optionMap = new Map<string, string>();

  options.forEach((rawOption: unknown) => {
    const option = readObject(rawOption);
    const id = safeString(option.id ?? option.key ?? option.optionId).toUpperCase();

    if (id) {
      optionMap.set(id, safeString(option.content ?? option.text ?? option.label));
    }
  });

  const statements = Array.isArray(source.statements) ? source.statements : [];
  const statementMap = new Map<string, string>();
  const statementAnswerMap: Record<string, boolean> = {};

  statements.forEach((rawStatement: unknown, statementIndex: number) => {
    const statement = readObject(rawStatement);
    const id = safeString(
      statement.id ??
        statement.key ??
        statement.statementId ??
        ["A", "B", "C", "D"][statementIndex]
    ).toUpperCase();

    if (id) {
      statementMap.set(
        id,
        safeString(
          statement.statement ??
            statement.content ??
            statement.text ??
            statement.label
        )
      );

      const correctValue = normalizeTrueFalseValue(
        statement.correct ??
          statement.correctAnswer ??
          statement.answer ??
          statement.isCorrect
      );

      if (typeof correctValue === "boolean") {
        statementAnswerMap[id] = correctValue;
      }
    }
  });

  const questionType = normalizeQuestionType(
    source.type ?? source.questionType ?? question.type ?? question.questionType,
    question.sectionTitle ?? question.section
  );
  const correctRaw =
    questionType === "true_false_group" &&
    Object.keys(statementAnswerMap).length > 0
      ? statementAnswerMap
      : source.correct ??
        source.correctAnswer ??
        source.correctOptionId ??
        source.acceptedAnswers;

  return {
    id: safeString(
      question.id ||
        source.id ||
        source.originalQuestionId ||
        source.bankQuestionId ||
        source.questionId ||
        `q-${index + 1}`
    ),
    questionNumber: Number(question.questionNumber || source.questionNumber || index + 1),
    type: questionType,

    question: cleanQuestionText(
      source.question ?? source.content ?? source.questionText ?? source.prompt
    ),
    questionImageId: safeString(source.questionImageId),
    questionImageUrl: safeString(source.questionImageUrl),

    topic: safeString(source.topic ?? metadata.topic),
    knowledgeUnit: safeString(
      source.knowledgeUnit ?? metadata.knowledgeUnit
    ),
    skill: safeString(source.skill ?? metadata.skill),
    learningOutcome: safeString(
      source.learningOutcome ?? metadata.learningOutcome
    ),
    cognitiveLevel: safeString(
      source.cognitiveLevel ?? metadata.cognitiveLevel
    ),
    difficulty: safeString(source.difficulty ?? metadata.difficulty),
    explanation: safeString(source.explanation ?? metadata.explanation),

    A: safeString(source.A) || optionMap.get("A") || statementMap.get("A") || "",
    AImageId: safeString(source.AImageId),
    AImageUrl: safeString(source.AImageUrl),

    B: safeString(source.B) || optionMap.get("B") || statementMap.get("B") || "",
    BImageId: safeString(source.BImageId),
    BImageUrl: safeString(source.BImageUrl),

    C: safeString(source.C) || optionMap.get("C") || statementMap.get("C") || "",
    CImageId: safeString(source.CImageId),
    CImageUrl: safeString(source.CImageUrl),

    D: safeString(source.D) || optionMap.get("D") || statementMap.get("D") || "",
    DImageId: safeString(source.DImageId),
    DImageUrl: safeString(source.DImageUrl),

    correctRaw,
    correct: answerToDisplay(correctRaw),
  };
}

function normalizeQuestionSequence(questions: any[]) {
  return questions.map((question, index) => ({
    ...question,
    questionNumber: index + 1,
  }));
}

async function loadQuestions(testId: string, result: any) {
  const db = getAdminDb();

  const questionSnapshot = await db
    .collection("questions")
    .where("testId", "==", testId)
    .get();

  if (!questionSnapshot.empty) {
    return normalizeQuestionSequence(questionSnapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          questionNumber: Number(data.questionNumber || 0),

          question: cleanQuestionText(data.question),
          questionImageId: safeString(data.questionImageId),
          questionImageUrl: safeString(data.questionImageUrl),

          topic: safeString(data.topic),
          knowledgeUnit: safeString(data.knowledgeUnit),
          skill: safeString(data.skill),
          learningOutcome: safeString(data.learningOutcome),
          cognitiveLevel: safeString(data.cognitiveLevel),
          difficulty: safeString(data.difficulty),
          explanation: safeString(data.explanation),

          A: safeString(data.A),
          AImageId: safeString(data.AImageId),
          AImageUrl: safeString(data.AImageUrl),

          B: safeString(data.B),
          BImageId: safeString(data.BImageId),
          BImageUrl: safeString(data.BImageUrl),

          C: safeString(data.C),
          CImageId: safeString(data.CImageId),
          CImageUrl: safeString(data.CImageUrl),

          D: safeString(data.D),
          DImageId: safeString(data.DImageId),
          DImageUrl: safeString(data.DImageUrl),

          type: normalizeQuestionType(data.type ?? data.questionType),
          correctRaw: data.correct,
          correct: answerToDisplay(data.correct),
        };
      })
      .sort(
        (a, b) => Number(a.questionNumber || 0) - Number(b.questionNumber || 0)
      ));
  }

  const testDoc = await db.collection("tests").doc(testId).get();

  if (testDoc.exists) {
    const test = testDoc.data() || {};

    if (Array.isArray(test.questions)) {
      return normalizeQuestionSequence(
        test.questions
          .map((question: any, index: number) => mapEmbeddedQuestion(question, index))
          .sort(
            (a: any, b: any) =>
              Number(a.questionNumber || 0) - Number(b.questionNumber || 0)
          )
      );
    }
  }

  const assignmentId = safeString(result.assignmentId);

  if (assignmentId) {
    const [assignmentDoc, legacyAssignmentDoc] = await Promise.all([
      db.collection("assignments").doc(assignmentId).get(),
      db.collection("testAssignments").doc(assignmentId).get(),
    ]);

    const assignment = assignmentDoc.exists
      ? assignmentDoc.data()
      : legacyAssignmentDoc.exists
        ? legacyAssignmentDoc.data()
        : null;

    const testSnapshot = readObject(assignment?.testSnapshot);
    const sections = Array.isArray(testSnapshot.sections)
      ? testSnapshot.sections
      : [];
    const snapshotQuestions: any[] = [];

    sections.forEach((rawSection, sectionIndex) => {
      const section = readObject(rawSection);
      const sectionQuestions = Array.isArray(section.questions)
        ? section.questions
        : [];
      const sectionTitle =
        safeString(section.title ?? section.sectionTitle ?? section.name) ||
        `Phần ${sectionIndex + 1}`;

      sectionQuestions.forEach((rawQuestion, questionIndex) => {
        snapshotQuestions.push(
          mapEmbeddedQuestion(
            {
              ...readObject(rawQuestion),
              sectionTitle,
            },
            snapshotQuestions.length
          )
        );
      });
    });

    if (snapshotQuestions.length > 0) {
      return normalizeQuestionSequence(snapshotQuestions);
    }
  }

  const resultDetail = Array.isArray(result.detail) ? result.detail : [];

  return normalizeQuestionSequence(
    resultDetail.map((item: any, index: number) =>
      mapEmbeddedQuestion(
        {
          id: item.questionId,
          questionNumber: item.questionNumber,
          question: cleanQuestionText(item.question || item.prompt || ""),
          correct: item.correctAnswer ?? item.correct,
          type: item.type,
          sectionTitle: item.sectionTitle,
          topic: item.topic,
          knowledgeUnit: item.knowledgeUnit,
          skill: item.skill,
          learningOutcome: item.learningOutcome,
          cognitiveLevel: item.cognitiveLevel,
          difficulty: item.difficulty,
          explanation: item.explanation,
        },
        index
      )
    )
  );
}

function getAnswerFromResultDetail(
  result: any,
  questionId: string,
  questionNumber: number
) {
  const detail = Array.isArray(result.detail) ? result.detail : [];

  const foundDetail = detail.find((item: any) => {
    const itemQuestionId = safeString(item.questionId || item.id);
    const itemQuestionNumber = Number(item.questionNumber || 0);

    return itemQuestionId === questionId || itemQuestionNumber === questionNumber;
  });

  if (foundDetail) {
    const rawStudentAnswer = foundDetail.studentAnswer ?? foundDetail.answer;
    const rawCorrectAnswer = foundDetail.correctAnswer ?? foundDetail.correct;

    return {
      studentAnswer: answerToDisplay(rawStudentAnswer),
      correctAnswer: answerToDisplay(rawCorrectAnswer),
      studentAnswerRaw: rawStudentAnswer,
      correctAnswerRaw: rawCorrectAnswer,
      isCorrect: Boolean(foundDetail.isCorrect),
      isAnswered: Boolean(foundDetail.isAnswered),
      correctStatementCount: Number(foundDetail.correctStatementCount || 0),
      totalStatementCount: Number(foundDetail.totalStatementCount || 0),
    };
  }

  const answers = result.answers || {};

  if (answers && typeof answers === "object") {
    const byId = answerToDisplay(answers[questionId]);

    if (byId) {
      return {
        studentAnswer: byId,
        correctAnswer: "",
        studentAnswerRaw: answers[questionId],
        correctAnswerRaw: null,
        isCorrect: false,
        isAnswered: true,
        correctStatementCount: 0,
        totalStatementCount: 0,
      };
    }

    const byNumber = answerToDisplay(answers[String(questionNumber)]);

    if (byNumber) {
      return {
        studentAnswer: byNumber,
        correctAnswer: "",
        studentAnswerRaw: answers[String(questionNumber)],
        correctAnswerRaw: null,
        isCorrect: false,
        isAnswered: true,
        correctStatementCount: 0,
        totalStatementCount: 0,
      };
    }
  }

  return {
    studentAnswer: "",
    correctAnswer: "",
    studentAnswerRaw: null,
    correctAnswerRaw: null,
    isCorrect: false,
    isAnswered: false,
    correctStatementCount: 0,
    totalStatementCount: 0,
  };
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const db = getAdminDb();

    const url = new URL(request.url);
    const resultId = safeString(url.searchParams.get("resultId"));

    if (!resultId) {
      throw new ApiError("Thiếu resultId.", 400);
    }

    const resultDoc = await db.collection("results").doc(resultId).get();

    if (!resultDoc.exists) {
      throw new ApiError("Không tìm thấy kết quả bài làm.", 404);
    }

    const result = resultDoc.data() || {};
    const normalizedScore = normalizeResultScore(result);
    const leaveWarnings = normalizeLeaveWarnings(result);

    if (!canTeacherSeeResult(teacher, result)) {
      throw new ApiError("Bạn không có quyền xem kết quả này.", 403);
    }

    const testId = safeString(result.testId);

    if (!testId) {
      throw new ApiError("Kết quả này thiếu testId.", 400);
    }

    const questions = await loadQuestions(testId, result);

    if (questions.length === 0) {
      throw new ApiError("Không tìm thấy câu hỏi của bài kiểm tra này.", 404);
    }

    const detailQuestions = questions.map((question: any, index: number) => {
      const questionId = safeString(question.id || `q-${index + 1}`);
      const questionNumber = index + 1;

      const answerInfo = getAnswerFromResultDetail(
        result,
        questionId,
        questionNumber
      );

      const isTrueFalseQuestion =
        question.type === "true_false_group";
      const fallbackCorrectRaw =
        question.correctRaw ?? question.correct;
      const answerCorrectRaw =
        answerInfo.correctAnswerRaw;
      const correctRaw =
        isTrueFalseQuestion &&
        !hasTrueFalseRecordValue(answerCorrectRaw)
          ? fallbackCorrectRaw
          : answerCorrectRaw ?? fallbackCorrectRaw;
      const correctAnswer =
        answerToDisplay(correctRaw) ||
        answerInfo.correctAnswer ||
        answerToDisplay(question.correct);

      const studentAnswer = answerInfo.studentAnswer;
      const studentRaw = answerInfo.studentAnswerRaw;
      const trueFalseSummary =
        isTrueFalseQuestion
          ? calculateTrueFalseSummary(
              studentRaw,
              correctRaw
            )
          : null;

      const isCorrect =
        trueFalseSummary?.isCorrect ??
        (answerInfo.isCorrect ||
          (Boolean(studentAnswer) &&
            Boolean(correctAnswer) &&
            studentAnswer === correctAnswer));

      return {
        questionId,
        questionNumber,
        type: question.type || "single_choice",

        question: question.question || "",
        questionImageId: question.questionImageId || "",
        questionImageUrl: question.questionImageUrl || "",

        topic: question.topic || "",
        knowledgeUnit: question.knowledgeUnit || "",
        skill: question.skill || "",
        learningOutcome: question.learningOutcome || "",
        cognitiveLevel: question.cognitiveLevel || "",
        difficulty: question.difficulty || "",
        explanation: question.explanation || "",

        A: question.A || "",
        AImageId: question.AImageId || "",
        AImageUrl: question.AImageUrl || "",

        B: question.B || "",
        BImageId: question.BImageId || "",
        BImageUrl: question.BImageUrl || "",

        C: question.C || "",
        CImageId: question.CImageId || "",
        CImageUrl: question.CImageUrl || "",

        D: question.D || "",
        DImageId: question.DImageId || "",
        DImageUrl: question.DImageUrl || "",

        studentAnswer,
        studentAnswerRaw:
          isTrueFalseQuestion
            ? normalizeTrueFalseRecord(studentRaw)
            : studentRaw,
        correct: correctAnswer,
        correctRaw:
          isTrueFalseQuestion
            ? normalizeTrueFalseRecord(correctRaw)
            : correctRaw,
        isCorrect,
        isAnswered:
          trueFalseSummary?.isAnswered ??
          answerInfo.isAnswered,
        correctStatementCount:
          trueFalseSummary?.correctStatementCount ??
          answerInfo.correctStatementCount,
        totalStatementCount:
          trueFalseSummary?.totalStatementCount ??
          answerInfo.totalStatementCount,
      };
    });

    return NextResponse.json({
      status: "success",
      result: {
        id: resultDoc.id,

        assignmentId: result.assignmentId || "",
        assignmentCode: result.assignmentCode || "",

        testId: result.testId || "",
        testTitle: result.testTitle || "",
        subject: result.subject || "",

        classId: result.classId || "",
        className: result.className || "",

        studentId: result.studentId || "",
        studentCode: result.studentCode || "",
        studentName: result.studentName || "",

        teacherEmail: result.teacherEmail || "",
        teacherName: result.teacherName || "",

        correctCount: Number(
          result.correctCount ?? result.correctQuestionCount ?? 0
        ),
        totalQuestions: Number(result.totalQuestions || detailQuestions.length),
        score: normalizedScore.score,
        totalScore: normalizedScore.totalScore,

        duration: Number(result.duration || result.durationMinutes || 0),
        durationMinutes: Number(result.durationMinutes || result.duration || 0),
        timeSpentSeconds: Number(result.timeSpentSeconds || 0),

        startedAt: result.startedAt || "",
        submittedAt: result.submittedAt || "",
        createdAt: result.createdAt || "",

        status: result.status || "submitted",
        autoSubmit: Boolean(result.autoSubmit),

        visibilityLostCount: leaveWarnings.visibilityLostCount,
        focusLostCount: leaveWarnings.focusLostCount,
        suspiciousEventCount: leaveWarnings.count,
        hasSuspiciousActivity: leaveWarnings.count > 0,
        suspiciousEvents: leaveWarnings.events,
        antiCheat: {
          ...(readObject(result.antiCheat) as Record<string, unknown>),
          focusLostCount: leaveWarnings.focusLostCount,
          suspiciousEventCount: leaveWarnings.count,
          visibilityLostCount: leaveWarnings.visibilityLostCount,
          suspiciousEvents: leaveWarnings.events,
        },
      },
      questions: detailQuestions,
    });
  } catch (error: any) {
    console.error("GET /api/teacher/results/detail error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được chi tiết bài làm.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
