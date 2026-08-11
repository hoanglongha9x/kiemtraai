import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";
import { normalizeSubjectName } from "@/lib/subjects";

export const runtime = "nodejs";

type AnswerKey = "A" | "B" | "C" | "D";
type Difficulty = "easy" | "medium" | "hard";
type Visibility = "private" | "school";

type CognitiveLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

function safeString(value: unknown) {
  return String(value || "").trim();
}


function normalizeAnswerKey(value: unknown): AnswerKey {
  const key = safeString(value).toUpperCase();

  if (key === "A" || key === "B" || key === "C" || key === "D") {
    return key;
  }

  return "A";
}

function normalizeDifficulty(value: unknown): Difficulty {
  const difficulty = safeString(value).toLowerCase();

  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    return difficulty as Difficulty;
  }

  return "medium";
}

function normalizeVisibility(value: unknown): Visibility {
  const visibility = safeString(value).toLowerCase();

  if (visibility === "private" || visibility === "school") {
    return visibility as Visibility;
  }

  return "school";
}

function normalizeCognitiveLevel(value: unknown): CognitiveLevel {
  const level = safeString(value).toLowerCase();

  if (
    level === "recognition" ||
    level === "understanding" ||
    level === "application" ||
    level === "high_application"
  ) {
    return level as CognitiveLevel;
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

function removeVietnameseAccent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeQuestionKey(value: unknown) {
  return removeVietnameseAccent(safeString(value))
    .toLowerCase()
    .replace(/\\\(|\\\)|\\\[|\\\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function buildDuplicateKey(data: {
  subject: string;
  grade: string;
  questionKey: string;
}) {
  return [
    normalizeSubjectName(
      data.subject
    ).toLowerCase(),
    safeString(data.grade).toLowerCase(),
    safeString(data.questionKey),
  ].join("||");
}

function readAnswerValue(data: any, key: AnswerKey) {
  const lowerKey = key.toLowerCase();

  if (data?.[key]) return safeString(data[key]);
  if (data?.[lowerKey]) return safeString(data[lowerKey]);

  if (data?.answers?.[key]) return safeString(data.answers[key]);
  if (data?.answers?.[lowerKey]) return safeString(data.answers[lowerKey]);

  if (data?.options?.[key]) return safeString(data.options[key]);
  if (data?.options?.[lowerKey]) return safeString(data.options[lowerKey]);

  if (Array.isArray(data?.answers)) {
    const item = data.answers.find(
      (answer: any) => safeString(answer?.key).toUpperCase() === key
    );

    if (item?.text) return safeString(item.text);
    if (item?.value) return safeString(item.value);
  }

  if (Array.isArray(data?.options)) {
    const item = data.options.find(
      (option: any) => safeString(option?.key).toUpperCase() === key
    );

    if (item?.text) return safeString(item.text);
    if (item?.value) return safeString(item.value);
  }

  return "";
}

async function buildExistingQuestionKeySet(
  teacherEmail: string,
  excludeQuestionId = ""
) {
  const db = getAdminDb();

  const snapshot = await db
    .collection("questionBank")
    .where("teacherEmail", "==", teacherEmail)
    .get();

  const existingKeys = new Set<string>();

  snapshot.docs.forEach((doc) => {
    if (excludeQuestionId && doc.id === excludeQuestionId) return;

    const data = doc.data();

    if ((data.status || "active") === "deleted") return;

    const subject = safeString(data.subject);
    const grade = safeString(data.grade);
    const questionKey =
      safeString(data.questionKey) || normalizeQuestionKey(data.question);

    if (!questionKey) return;

    existingKeys.add(
      buildDuplicateKey({
        subject,
        grade,
        questionKey,
      })
    );
  });

  return existingKeys;
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);

    const { searchParams } = new URL(request.url);

    const subjectFilter = safeString(searchParams.get("subject"));
    const gradeFilter = safeString(searchParams.get("grade")).toLowerCase();
    const topicFilter = safeString(searchParams.get("topic")).toLowerCase();
    const skillFilter = safeString(searchParams.get("skill")).toLowerCase();
    const knowledgeUnitFilter = safeString(
      searchParams.get("knowledgeUnit")
    ).toLowerCase();
    const cognitiveLevelFilter = safeString(searchParams.get("cognitiveLevel"));
    const difficultyFilter = safeString(searchParams.get("difficulty"));
    const keyword = safeString(searchParams.get("keyword")).toLowerCase();

    const db = getAdminDb();

    const snapshot = await db
      .collection("questionBank")
      .where("teacherEmail", "==", teacher.email)
      .get();

    let questions = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,

        schoolId: data.schoolId || "",
        teacherEmail: data.teacherEmail || "",
        teacherName: data.teacherName || "",

        subject: normalizeSubjectName(
          data.subject
        ),
        grade: data.grade || "",
        topic: data.topic || "",

        knowledgeUnit: data.knowledgeUnit || "",
        skill: data.skill || "",
        learningOutcome: data.learningOutcome || "",
        cognitiveLevel: data.cognitiveLevel || "understanding",

        difficulty: data.difficulty || "medium",
        tags: Array.isArray(data.tags) ? data.tags : [],
        visibility: data.visibility || "school",

        question: data.question || "",
        questionKey: data.questionKey || "",
        questionImageId: data.questionImageId || "",
        questionImageUrl: data.questionImageUrl || "",

        A: data.A || "",
        AImageId: data.AImageId || "",
        AImageUrl: data.AImageUrl || "",

        B: data.B || "",
        BImageId: data.BImageId || "",
        BImageUrl: data.BImageUrl || "",

        C: data.C || "",
        CImageId: data.CImageId || "",
        CImageUrl: data.CImageUrl || "",

        D: data.D || "",
        DImageId: data.DImageId || "",
        DImageUrl: data.DImageUrl || "",

        correct: data.correct || "A",
        explanation: data.explanation || "",

        status: data.status || "active",
        source: data.source || "manual",

        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
      };
    });

    questions = questions.filter((q) => q.status !== "deleted");

    questions = questions.filter((q) => q.teacherEmail === teacher.email);

    if (subjectFilter) {
      questions = questions.filter((q) => q.subject === subjectFilter);
    }

    if (gradeFilter) {
      questions = questions.filter((q) =>
        String(q.grade || "").toLowerCase().includes(gradeFilter)
      );
    }

    if (topicFilter) {
      questions = questions.filter((q) =>
        String(q.topic || "").toLowerCase().includes(topicFilter)
      );
    }

    if (skillFilter) {
      questions = questions.filter((q) =>
        String(q.skill || "").toLowerCase().includes(skillFilter)
      );
    }

    if (knowledgeUnitFilter) {
      questions = questions.filter((q) =>
        String(q.knowledgeUnit || "").toLowerCase().includes(knowledgeUnitFilter)
      );
    }

    if (cognitiveLevelFilter) {
      questions = questions.filter(
        (q) => q.cognitiveLevel === cognitiveLevelFilter
      );
    }

    if (difficultyFilter) {
      questions = questions.filter((q) => q.difficulty === difficultyFilter);
    }

    if (keyword) {
      questions = questions.filter((q) => {
        const text = [
          q.question,
          q.A,
          q.B,
          q.C,
          q.D,
          q.topic,
          q.knowledgeUnit,
          q.skill,
          q.learningOutcome,
          q.grade,
          q.subject,
          ...(q.tags || []),
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(keyword);
      });
    }

    questions.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    return NextResponse.json({
      status: "success",
      questions,
      count: questions.length,
    });
  } catch (error: any) {
    console.error("GET /api/teacher/question-bank error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được ngân hàng câu hỏi.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();

    const db = getAdminDb();
    const now = new Date().toISOString();

    const subject = safeString(body.subject || teacher.subject || "Khác");
    const grade = safeString(body.grade);
    const topic = safeString(body.topic);

    const knowledgeUnit = safeString(body.knowledgeUnit);
    const skill = safeString(body.skill);
    const learningOutcome = safeString(body.learningOutcome);
    const cognitiveLevel = normalizeCognitiveLevel(body.cognitiveLevel);

    const difficulty = normalizeDifficulty(body.difficulty);
    const visibility = normalizeVisibility(body.visibility);
    const tags = normalizeTags(body.tags);

    const rawQuestions = Array.isArray(body.questions) ? body.questions : [];

    const existingKeys = await buildExistingQuestionKeySet(teacher.email);
    const importKeys = new Set<string>();

    if (rawQuestions.length > 0) {
      if (rawQuestions.length > 300) {
        return NextResponse.json(
          {
            status: "error",
            message: "Mỗi lần chỉ nên import tối đa 300 câu hỏi.",
          },
          { status: 400 }
        );
      }

      const validQuestions: any[] = [];
      const errors: string[] = [];
      const duplicateQuestions: string[] = [];

      rawQuestions.forEach((item: any, index: number) => {
        const question = safeString(item.question || item.content || item.text);

        const A = readAnswerValue(item, "A");
        const B = readAnswerValue(item, "B");
        const C = readAnswerValue(item, "C");
        const D = readAnswerValue(item, "D");

        const correct = normalizeAnswerKey(
          item.correct || item.correctAnswer || item.answer || item.answerKey
        );

        if (!question) {
          errors.push(`Câu ${index + 1}: thiếu nội dung câu hỏi.`);
          return;
        }

        if (!A || !B || !C || !D) {
          errors.push(`Câu ${index + 1}: thiếu đáp án A/B/C/D.`);
          return;
        }

        const itemSubject = normalizeSubjectName(
          item.subject || subject
        );
        const itemGrade = safeString(item.grade || grade);
        const itemTopic = safeString(item.topic || topic);

        const itemKnowledgeUnit = safeString(
          item.knowledgeUnit || knowledgeUnit
        );

        const itemSkill = safeString(item.skill || skill);

        const itemLearningOutcome = safeString(
          item.learningOutcome || learningOutcome
        );

        const itemCognitiveLevel = normalizeCognitiveLevel(
          item.cognitiveLevel || cognitiveLevel
        );

        const itemDifficulty = normalizeDifficulty(
          item.difficulty || difficulty
        );

        const itemTags =
          normalizeTags(item.tags).length > 0 ? normalizeTags(item.tags) : tags;

        const questionKey = normalizeQuestionKey(question);

        if (!questionKey) {
          errors.push(`Câu ${index + 1}: không tạo được mã chống trùng.`);
          return;
        }

        const duplicateKey = buildDuplicateKey({
          subject: itemSubject,
          grade: itemGrade,
          questionKey,
        });

        if (existingKeys.has(duplicateKey) || importKeys.has(duplicateKey)) {
          duplicateQuestions.push(`Câu ${index + 1}: bị bỏ qua vì đã tồn tại.`);
          return;
        }

        importKeys.add(duplicateKey);

        validQuestions.push({
          schoolId: teacher.schoolId,
          teacherEmail: teacher.email,
          teacherName: teacher.name,

          subject: itemSubject,
          grade: itemGrade,
          topic: itemTopic,

          knowledgeUnit: itemKnowledgeUnit,
          skill: itemSkill,
          learningOutcome: itemLearningOutcome,
          cognitiveLevel: itemCognitiveLevel,

          difficulty: itemDifficulty,
          tags: itemTags,
          visibility,

          question,
          questionKey,
          questionImageId: safeString(item.questionImageId),
          questionImageUrl: safeString(item.questionImageUrl),

          A,
          AImageId: safeString(item.AImageId),
          AImageUrl: safeString(item.AImageUrl),

          B,
          BImageId: safeString(item.BImageId),
          BImageUrl: safeString(item.BImageUrl),

          C,
          CImageId: safeString(item.CImageId),
          CImageUrl: safeString(item.CImageUrl),

          D,
          DImageId: safeString(item.DImageId),
          DImageUrl: safeString(item.DImageUrl),

          correct,
          explanation: safeString(
            item.explanation || item.explain || item.solution
          ),

          status: "active",
          source: safeString(body.source || "import"),

          createdAt: now,
          updatedAt: now,
          createdBy: teacher.email,
          updatedBy: teacher.email,
        });
      });

      const allWarnings = [...errors, ...duplicateQuestions];

      if (validQuestions.length === 0) {
        if (duplicateQuestions.length > 0) {
          return NextResponse.json({
            status: "success",
            count: 0,
            importedQuestions: [],
            errors: allWarnings,
            duplicateCount: duplicateQuestions.length,
            message:
              "Không có câu hỏi mới để import. Tất cả câu hỏi hợp lệ đều đã tồn tại trong ngân hàng.",
          });
        }

        return NextResponse.json(
          {
            status: "error",
            message: "Không có câu hỏi hợp lệ để import.",
            errors: allWarnings,
            duplicateCount: duplicateQuestions.length,
          },
          { status: 400 }
        );
      }

      const batch = db.batch();
      const importedQuestions: any[] = [];

      validQuestions.forEach((questionData) => {
        const questionRef = db.collection("questionBank").doc();

        batch.set(questionRef, questionData);

        importedQuestions.push({
          id: questionRef.id,
          ...questionData,
        });
      });

      await batch.commit();

      return NextResponse.json({
        status: "success",
        count: importedQuestions.length,
        importedQuestions,
        errors: allWarnings,
        duplicateCount: duplicateQuestions.length,
        message:
          allWarnings.length > 0
            ? `Đã import ${importedQuestions.length} câu hỏi. Có ${allWarnings.length} câu bị bỏ qua/cảnh báo.`
            : `Đã import ${importedQuestions.length} câu hỏi vào ngân hàng.`,
      });
    }

    const question = safeString(body.question);

    const A = safeString(body.A);
    const B = safeString(body.B);
    const C = safeString(body.C);
    const D = safeString(body.D);

    const correct = normalizeAnswerKey(body.correct);
    const explanation = safeString(body.explanation);

    if (!question) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng nhập nội dung câu hỏi.",
        },
        { status: 400 }
      );
    }

    if (!A || !B || !C || !D) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng nhập đủ đáp án A/B/C/D.",
        },
        { status: 400 }
      );
    }

    const questionKey = normalizeQuestionKey(question);

    if (!questionKey) {
      return NextResponse.json(
        {
          status: "error",
          message: "Không tạo được mã chống trùng cho câu hỏi.",
        },
        { status: 400 }
      );
    }

    const duplicateKey = buildDuplicateKey({
      subject,
      grade,
      questionKey,
    });

    if (existingKeys.has(duplicateKey)) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Câu hỏi này đã tồn tại trong ngân hàng với cùng môn và khối/lớp.",
        },
        { status: 409 }
      );
    }

    const questionRef = db.collection("questionBank").doc();

    const questionData = {
      schoolId: teacher.schoolId,
      teacherEmail: teacher.email,
      teacherName: teacher.name,

      subject,
      grade,
      topic,

      knowledgeUnit,
      skill,
      learningOutcome,
      cognitiveLevel,

      difficulty,
      tags,
      visibility,

      question,
      questionKey,
      questionImageId: safeString(body.questionImageId),
      questionImageUrl: safeString(body.questionImageUrl),

      A,
      AImageId: safeString(body.AImageId),
      AImageUrl: safeString(body.AImageUrl),

      B,
      BImageId: safeString(body.BImageId),
      BImageUrl: safeString(body.BImageUrl),

      C,
      CImageId: safeString(body.CImageId),
      CImageUrl: safeString(body.CImageUrl),

      D,
      DImageId: safeString(body.DImageId),
      DImageUrl: safeString(body.DImageUrl),

      correct,
      explanation,

      status: "active",
      source: safeString(body.source || "manual"),

      createdAt: now,
      updatedAt: now,
      createdBy: teacher.email,
      updatedBy: teacher.email,
    };

    await questionRef.set(questionData);

    return NextResponse.json({
      status: "success",
      questionId: questionRef.id,
      question: {
        id: questionRef.id,
        ...questionData,
      },
      message: "Đã thêm câu hỏi vào ngân hàng.",
    });
  } catch (error: any) {
    console.error("POST /api/teacher/question-bank error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không thêm được câu hỏi vào ngân hàng.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();

    const questionId = safeString(body.questionId);
    const action = safeString(body.action);

    if (!questionId) {
      return NextResponse.json(
        {
          status: "error",
          message: "Thiếu mã câu hỏi cần cập nhật.",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const questionRef = db.collection("questionBank").doc(questionId);
    const questionDoc = await questionRef.get();

    if (!questionDoc.exists) {
      return NextResponse.json(
        {
          status: "error",
          message: "Không tìm thấy câu hỏi.",
        },
        { status: 404 }
      );
    }

    const question = questionDoc.data() || {};

    const isOwner = question.teacherEmail === teacher.email;

    if (!isOwner) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Chỉ người tạo câu hỏi mới được sửa/xóa câu hỏi này.",
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    if (action === "delete") {
      await questionRef.update({
        status: "deleted",
        deletedAt: now,
        deletedBy: teacher.email,
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        questionId,
        message: "Đã xóa câu hỏi khỏi ngân hàng.",
      });
    }

    if (action === "update") {
      const subject = normalizeSubjectName(
        body.subject || question.subject || teacher.subject || "Khác"
      );

      const grade = safeString(body.grade);
      const topic = safeString(body.topic);

      const knowledgeUnit = safeString(body.knowledgeUnit);
      const skill = safeString(body.skill);
      const learningOutcome = safeString(body.learningOutcome);
      const cognitiveLevel = normalizeCognitiveLevel(body.cognitiveLevel);

      const difficulty = normalizeDifficulty(body.difficulty);
      const visibility = normalizeVisibility(body.visibility);
      const tags = normalizeTags(body.tags);

      const questionText = safeString(body.question);

      const A = safeString(body.A);
      const B = safeString(body.B);
      const C = safeString(body.C);
      const D = safeString(body.D);

      const correct = normalizeAnswerKey(body.correct);
      const explanation = safeString(body.explanation);

      if (!questionText) {
        return NextResponse.json(
          {
            status: "error",
            message: "Vui lòng nhập nội dung câu hỏi.",
          },
          { status: 400 }
        );
      }

      if (!A || !B || !C || !D) {
        return NextResponse.json(
          {
            status: "error",
            message: "Vui lòng nhập đủ đáp án A/B/C/D.",
          },
          { status: 400 }
        );
      }

      const questionKey = normalizeQuestionKey(questionText);

      if (!questionKey) {
        return NextResponse.json(
          {
            status: "error",
            message: "Không tạo được mã chống trùng cho câu hỏi.",
          },
          { status: 400 }
        );
      }

      const existingKeys = await buildExistingQuestionKeySet(
        teacher.email,
        questionId
      );

      const duplicateKey = buildDuplicateKey({
        subject,
        grade,
        questionKey,
      });

      if (existingKeys.has(duplicateKey)) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Câu hỏi này đã tồn tại trong ngân hàng với cùng môn và khối/lớp.",
          },
          { status: 409 }
        );
      }

      await questionRef.update({
        subject,
        grade,
        topic,

        knowledgeUnit,
        skill,
        learningOutcome,
        cognitiveLevel,

        difficulty,
        tags,
        visibility,

        question: questionText,
        questionKey,
        questionImageId: safeString(body.questionImageId),
        questionImageUrl: safeString(body.questionImageUrl),

        A,
        AImageId: safeString(body.AImageId),
        AImageUrl: safeString(body.AImageUrl),

        B,
        BImageId: safeString(body.BImageId),
        BImageUrl: safeString(body.BImageUrl),

        C,
        CImageId: safeString(body.CImageId),
        CImageUrl: safeString(body.CImageUrl),

        D,
        DImageId: safeString(body.DImageId),
        DImageUrl: safeString(body.DImageUrl),

        correct,
        explanation,

        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        questionId,
        message: "Đã cập nhật câu hỏi.",
      });
    }

    return NextResponse.json(
      {
        status: "error",
        message: "Hành động không hợp lệ.",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("PATCH /api/teacher/question-bank error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không cập nhật được câu hỏi.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
