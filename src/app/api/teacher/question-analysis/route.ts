import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";
import { getLearningAssessment } from "@/server/analytics/learningAssessment";
import type { EvidenceConfidence } from "@/server/analytics/learningAssessment";
import { normalizeSubjectName } from "@/lib/subjects";

export const runtime = "nodejs";

type TeacherProfile = {
  email: string;
  name: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  schoolId?: string;
};

type AnswerKey = "A" | "B" | "C" | "D" | "";
type QuestionAnalysisType = "single_choice" | "true_false_group" | "short_answer";

type LearningLevel = "good" | "average" | "weak" | "very_weak" | "no_data";

type AnalysisItem = {
  questionId: string;
  questionNumber: number;

  question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  correct: AnswerKey;

  subject: string;
  grade: string;
  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;
  cognitiveLevel: string;
  difficulty: string;
  tags: string[];

  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  correctRate: number;
  wrongRate: number;

  level: string;
  learningLevel: LearningLevel;
  recommendation: string;
};

type EmbeddedQuestion = {
  id: string;
  questionNumber: number;
  type: QuestionAnalysisType;

  question: string;
  A: string;
  B: string;
  C: string;
  D: string;
  correct: AnswerKey;

  subject: string;
  grade: string;
  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;
  cognitiveLevel: string;
  difficulty: string;
  tags: string[];
};

type StudentQuestionResult = {
  answer: AnswerKey;
  isBlank: boolean;
  isCorrect: boolean;
};

type GroupAnalysisItem = {
  key: string;

  subject: string;
  grade: string;
  topic: string;
  knowledgeUnit: string;
  skill: string;
  learningOutcome: string;
  cognitiveLevel: string;
  difficulty: string;

  totalQuestions: number;
  totalAnswers: number;
  correctAnswers: number;
  wrongAnswers: number;
  blankAnswers: number;

  correctRate: number;
  wrongRate: number;

  level: LearningLevel;
  levelLabel: string;
  evidenceCount: number;
  evidenceLabel: string;
  confidence: EvidenceConfidence;
  confidenceLabel: string;
  classificationEligible: boolean;
  recommendations: string[];
};

type StudentWeaknessItem = {
  resultId: string;

  studentName: string;
  studentCode: string;
  className: string;
  classId: string;

  score: number;
  percentage: number;
  averagePercentage: number;
  attemptCount: number;
  trendPercentagePoints: number | null;
  evidenceQuestionCount: number;

  weakTopics: string[];
  weakSkills: string[];
  strongTopics: string[];
  strongSkills: string[];

  recommendations: string[];
};

type MetadataCompleteness = {
  totalQuestions: number;
  labeledTopicQuestions: number;
  missingTopicQuestions: number;
  labeledSkillQuestions: number;
  missingSkillQuestions: number;
  labeledCognitiveLevelQuestions: number;
  missingCognitiveLevelQuestions: number;
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

function safeLower(value: unknown): string {
  return safeString(value).toLowerCase();
}

function safeUpper(value: unknown): string {
  return safeString(value).toUpperCase();
}

function normalizeAnswer(value: unknown): AnswerKey {
  const answer = safeUpper(value);

  if (answer === "A" || answer === "B" || answer === "C" || answer === "D") {
    return answer as AnswerKey;
  }

  return "";
}

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function normalizeQuestionType(value: unknown, fallback?: unknown): QuestionAnalysisType {
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

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => safeString(item))
    .filter(Boolean)
    .slice(0, 20);
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function getLearningLevel(correctRate: number, totalAnswers: number): LearningLevel {
  if (totalAnswers <= 0) return "no_data";
  if (correctRate >= 80) return "good";
  if (correctRate >= 60) return "average";
  if (correctRate >= 40) return "weak";
  return "very_weak";
}

function getLearningLevelLabel(level: LearningLevel) {
  if (level === "good") return "Tốt";
  if (level === "average") return "Cần củng cố";
  if (level === "weak") return "Yếu";
  if (level === "very_weak") return "Rất yếu";
  return "Chưa có dữ liệu";
}

function getQuestionDifficultyLabel(correctRate: number, totalAnswered: number) {
  if (totalAnswered <= 0) return "Chưa có dữ liệu";
  if (correctRate >= 80) return "Dễ";
  if (correctRate >= 50) return "Trung bình";
  return "Khó";
}

function getGenericRecommendation(params: {
  level: LearningLevel;
  topic?: string;
  skill?: string;
  learningOutcome?: string;
}) {
  const topic = safeString(params.topic) || "chủ đề này";
  const skill = safeString(params.skill);
  const learningOutcome = safeString(params.learningOutcome);

  if (params.level === "good") {
    return skill
      ? `Học sinh đã nắm khá tốt kỹ năng "${skill}". Có thể giao thêm bài vận dụng hoặc mở rộng.`
      : `Học sinh đã nắm khá tốt ${topic}. Có thể giao thêm bài vận dụng hoặc mở rộng.`;
  }

  if (params.level === "average") {
    return skill
      ? `Cần củng cố thêm kỹ năng "${skill}", đặc biệt qua các bài tập mức cơ bản và trung bình.`
      : `Cần củng cố thêm ${topic} bằng bài tập ngắn và kiểm tra lại kiến thức nền.`;
  }

  if (params.level === "weak") {
    if (learningOutcome) {
      return `Cần ôn lại mục tiêu: ${learningOutcome}. Nên luyện thêm bài cơ bản trước khi làm bài vận dụng.`;
    }

    return skill
      ? `Học sinh còn yếu ở kỹ năng "${skill}". Nên ôn lại lý thuyết và làm thêm bài tập mẫu.`
      : `Học sinh còn yếu ở ${topic}. Nên ôn lại kiến thức nền và làm thêm bài tập cơ bản.`;
  }

  if (params.level === "very_weak") {
    if (learningOutcome) {
      return `Cần học lại từ đầu mục tiêu: ${learningOutcome}. Nên có bài ôn riêng và kiểm tra lại sau khi luyện tập.`;
    }

    return skill
      ? `Học sinh rất yếu ở kỹ năng "${skill}". Cần học lại kiến thức nền, làm bài mẫu có hướng dẫn rồi mới luyện độc lập.`
      : `Học sinh rất yếu ở ${topic}. Cần học lại kiến thức nền và luyện lại từ mức nhận biết/thông hiểu.`;
  }

  return "Chưa có đủ dữ liệu để đưa ra khuyến nghị.";
}

const SUBJECT_SKILL_RECOMMENDATIONS: Record<string, Record<string, string[]>> = {
  "Tin học": {
    "Câu lệnh điều kiện": [
      "Ôn cấu trúc if/elif/else.",
      "Luyện điều kiện so sánh và toán tử logic.",
      "Làm bài tập phân nhánh theo tình huống thực tế.",
    ],
    "Sử dụng if/else": [
      "Ôn cú pháp if/else.",
      "Luyện cách xác định điều kiện đúng/sai.",
      "Làm thêm bài tập xử lý tình huống có nhiều nhánh.",
    ],
    "Vòng lặp for": [
      "Ôn cú pháp for và hàm range().",
      "Luyện bài tập có biến đếm.",
      "Phân biệt số lần lặp và điều kiện dừng.",
    ],
    "Vòng lặp while": [
      "Ôn điều kiện dừng của vòng lặp while.",
      "Luyện bài tập tránh lặp vô hạn.",
      "So sánh khi nào dùng for và khi nào dùng while.",
    ],
  },

  Hóa: {
    "Cân bằng phương trình hóa học": [
      "Ôn cách đếm số nguyên tử mỗi nguyên tố.",
      "Luyện đặt hệ số trước công thức hóa học.",
      "Kiểm tra lại số nguyên tử ở hai vế sau khi cân bằng.",
    ],
    "Tính theo phương trình hóa học": [
      "Ôn công thức số mol.",
      "Luyện xác định chất đã biết và chất cần tìm.",
      "Luyện chuyển đổi giữa mol, khối lượng và thể tích khí.",
    ],
    "Nhận biết chất": [
      "Ôn tính chất hóa học đặc trưng của từng nhóm chất.",
      "Luyện bài tập nhận biết qua hiện tượng phản ứng.",
    ],
  },

  Lý: {
    "Vận dụng công thức": [
      "Ôn ý nghĩa từng đại lượng trong công thức.",
      "Luyện đổi đơn vị trước khi thay số.",
      "Làm bài tập từ mức cơ bản đến vận dụng.",
    ],
    "Chuyển động thẳng đều": [
      "Ôn công thức v = s/t.",
      "Luyện xác định quãng đường, vận tốc, thời gian.",
      "Chú ý đổi đơn vị trước khi tính.",
    ],
    "Lực": [
      "Ôn khái niệm lực và biểu diễn lực.",
      "Luyện phân tích các lực tác dụng lên vật.",
    ],
  },

  Sinh: {
    "Di truyền học": [
      "Ôn khái niệm kiểu gen, kiểu hình.",
      "Luyện sơ đồ lai và tỉ lệ phân li.",
      "Phân biệt gen trội và gen lặn.",
    ],
    "Quy luật phân li": [
      "Ôn thí nghiệm Mendel.",
      "Luyện xác định giao tử và tổ hợp giao tử.",
      "Luyện tính tỉ lệ kiểu gen, kiểu hình.",
    ],
  },

  KTPL: {
    "Nhận biết hành vi vi phạm pháp luật": [
      "Ôn khái niệm vi phạm pháp luật.",
      "Phân biệt hành vi đúng pháp luật và trái pháp luật.",
      "Luyện phân tích tình huống thực tế.",
    ],
    "Quyền và nghĩa vụ công dân": [
      "Ôn khái niệm quyền, nghĩa vụ và trách nhiệm công dân.",
      "Luyện phân biệt quyền được làm và nghĩa vụ phải làm.",
      "Luyện bài tập tình huống liên hệ thực tế.",
    ],
  },
};

function getSubjectSpecificRecommendations(params: {
  subject: string;
  skill: string;
  topic: string;
}) {
  const subject = normalizeSubjectName(
    params.subject
  );
  const skill = safeString(params.skill);
  const topic = safeString(params.topic);

  const subjectMap = SUBJECT_SKILL_RECOMMENDATIONS[subject];

  if (!subjectMap) return [];

  if (skill && subjectMap[skill]) {
    return subjectMap[skill];
  }

  if (topic && subjectMap[topic]) {
    return subjectMap[topic];
  }

  return [];
}

function buildRecommendations(params: {
  subject: string;
  topic: string;
  skill: string;
  learningOutcome: string;
  level: LearningLevel;
}) {
  if (params.level === "no_data") {
    return ["Chưa có đủ dữ liệu để đưa ra khuyến nghị."];
  }

  const subjectSpecific = getSubjectSpecificRecommendations({
    subject: params.subject,
    skill: params.skill,
    topic: params.topic,
  });

  const generic = getGenericRecommendation({
    level: params.level,
    topic: params.topic,
    skill: params.skill,
    learningOutcome: params.learningOutcome,
  });

  if (params.level === "good") {
    return [generic];
  }

  return subjectSpecific.length > 0 ? [...subjectSpecific, generic] : [generic];
}

function canAccessTest(teacher: TeacherProfile, test: any): boolean {
  const testTeacherEmail = safeLower(test.teacherEmail);

  return testTeacherEmail === teacher.email;
}

function resultBelongsToTeacher(teacher: TeacherProfile, result: any) {
  return safeLower(result.teacherEmail) === teacher.email;
}

function getQuestionResultDetail(
  result: any,
  questionId: string,
  questionNumber: number
) {
  const detail = Array.isArray(result.detail) ? result.detail : [];

  for (const item of detail) {
    const itemQuestionId = safeString(item.questionId || item.id);
    const itemQuestionNumber = Number(item.questionNumber || 0);

    if (itemQuestionId === questionId || itemQuestionNumber === questionNumber) {
      return item;
    }
  }

  return null;
}

function getStudentQuestionResult(
  result: any,
  question: EmbeddedQuestion
) : StudentQuestionResult {
  const detail = getQuestionResultDetail(
    result,
    question.id,
    question.questionNumber
  );

  if (detail) {
    const isAnswered =
      detail.isAnswered !== undefined
        ? Boolean(detail.isAnswered)
        : Boolean(
            normalizeAnswer(detail.studentAnswer ?? detail.answer) ||
              safeString(detail.studentAnswer ?? detail.answer)
          );

    return {
      answer: normalizeAnswer(detail.studentAnswer ?? detail.answer),
      isBlank: !isAnswered,
      isCorrect: Boolean(detail.isCorrect),
    };
  }

  const answer = getStudentAnswerFromLegacyResult(
    result,
    question.id,
    question.questionNumber
  );

  return {
    answer,
    isBlank: !answer,
    isCorrect: Boolean(answer && answer === question.correct),
  };
}

function getStudentAnswerFromLegacyResult(
  result: any,
  questionId: string,
  questionNumber: number
) {
  const answers = result.answers || {};

  if (answers && typeof answers === "object") {
    const answerById = normalizeAnswer(answers[questionId]);

    if (answerById) {
      return answerById;
    }

    const answerByNumber = normalizeAnswer(answers[String(questionNumber)]);

    if (answerByNumber) {
      return answerByNumber;
    }
  }

  return "";
}

function mapQuestionData(question: any, index: number, docId = ""): EmbeddedQuestion {
  const snapshot = readObject(question.snapshot);
  const source = Object.keys(snapshot).length > 0 ? snapshot : question;
  const type = normalizeQuestionType(
    source.type ?? source.questionType ?? question.type ?? question.questionType,
    question.sectionTitle ?? question.section
  );
  const options = Array.isArray(source.options) ? source.options : [];
  const optionMap = new Map<string, string>();

  options.forEach((rawOption: unknown) => {
    const option = readObject(rawOption);
    const id = safeUpper(option.id ?? option.key ?? option.optionId);

    if (id) {
      optionMap.set(
        id,
        safeString(option.content ?? option.text ?? option.label)
      );
    }
  });

  const statements = Array.isArray(source.statements) ? source.statements : [];
  const statementMap = new Map<string, string>();

  statements.forEach((rawStatement: unknown) => {
    const statement = readObject(rawStatement);
    const id = safeUpper(statement.id ?? statement.key ?? statement.statementId);

    if (id) {
      statementMap.set(
        id,
        safeString(statement.content ?? statement.text ?? statement.label)
      );
    }
  });

  return {
    id: safeString(
      question.id ||
        source.id ||
        source.originalQuestionId ||
        source.bankQuestionId ||
        source.questionId ||
        docId ||
        `q-${index + 1}`
    ),
    questionNumber: Number(question.questionNumber || source.questionNumber || index + 1),
    type,

    question: safeString(
      source.question ??
        source.content ??
        source.questionText ??
        source.prompt
    ),
    A: safeString(source.A) || optionMap.get("A") || statementMap.get("A") || "",
    B: safeString(source.B) || optionMap.get("B") || statementMap.get("B") || "",
    C: safeString(source.C) || optionMap.get("C") || statementMap.get("C") || "",
    D: safeString(source.D) || optionMap.get("D") || statementMap.get("D") || "",
    correct: normalizeAnswer(
      source.correct ??
        source.correctAnswer ??
        source.correctOptionId
    ),

    subject: safeString(source.subject),
    grade: safeString(source.grade),
    topic: safeString(source.topic),
    knowledgeUnit: safeString(source.knowledgeUnit),
    skill: safeString(source.skill),
    learningOutcome: safeString(source.learningOutcome),
    cognitiveLevel: safeString(source.cognitiveLevel),
    difficulty: safeString(source.difficulty || "medium"),
    tags: normalizeTags(source.tags),
  };
}

function normalizeQuestionSequence(questions: EmbeddedQuestion[]) {
  return questions.map((question, index) => ({
    ...question,
    questionNumber: index + 1,
  }));
}

function buildMetadataCompleteness(
  questions: EmbeddedQuestion[]
): MetadataCompleteness {
  const labeledTopicQuestions = questions.filter((question) =>
    safeString(question.topic)
  ).length;
  const labeledSkillQuestions = questions.filter((question) =>
    safeString(question.skill)
  ).length;
  const labeledCognitiveLevelQuestions = questions.filter((question) =>
    safeString(question.cognitiveLevel)
  ).length;

  return {
    totalQuestions: questions.length,
    labeledTopicQuestions,
    missingTopicQuestions: questions.length - labeledTopicQuestions,
    labeledSkillQuestions,
    missingSkillQuestions: questions.length - labeledSkillQuestions,
    labeledCognitiveLevelQuestions,
    missingCognitiveLevelQuestions:
      questions.length - labeledCognitiveLevelQuestions,
  };
}

async function loadQuestionsForAnalysis(testId: string) {
  const db = getAdminDb();

  const questionSnapshot = await db
    .collection("questions")
    .where("testId", "==", testId)
    .get();

  if (!questionSnapshot.empty) {
    return questionSnapshot.docs
      .map((doc, index) => mapQuestionData(doc.data(), index, doc.id))
      .sort(
        (a, b) => Number(a.questionNumber || 0) - Number(b.questionNumber || 0)
      );
  }

  const testDoc = await db.collection("tests").doc(testId).get();

  if (!testDoc.exists) {
    return [];
  }

  const test = testDoc.data() || {};

  if (!Array.isArray(test.questions)) {
    return [];
  }

  return test.questions
    .map((question: any, index: number) => mapQuestionData(question, index))
    .sort(
      (a: any, b: any) =>
        Number(a.questionNumber || 0) - Number(b.questionNumber || 0)
    );
}

function loadQuestionsFromAssignmentSnapshot(assignment: any): EmbeddedQuestion[] {
  const testSnapshot = readObject(assignment.testSnapshot);
  const sections = Array.isArray(testSnapshot.sections)
    ? testSnapshot.sections
    : [];

  const questions: EmbeddedQuestion[] = [];

  sections.forEach((rawSection, sectionIndex) => {
    const section = readObject(rawSection);
    const sectionQuestions = Array.isArray(section.questions)
      ? section.questions
      : [];
    const sectionTitle =
      safeString(section.title ?? section.sectionTitle ?? section.name) ||
      `Phần ${sectionIndex + 1}`;

    sectionQuestions.forEach((rawQuestion, questionIndex) => {
      questions.push(
        mapQuestionData(
          {
            ...readObject(rawQuestion),
            sectionTitle,
          },
          questions.length,
          `${safeString(section.id ?? section.sectionId) || `section-${sectionIndex + 1}`}-q-${questionIndex + 1}`
        )
      );
    });
  });

  return questions.sort((a, b) => a.questionNumber - b.questionNumber);
}

async function loadQuestionsFromResultAssignments(results: any[]) {
  const db = getAdminDb();
  const assignmentIds = Array.from(
    new Set(
      results
        .map((result) => safeString(result.assignmentId))
        .filter(Boolean)
    )
  );

  for (const assignmentId of assignmentIds) {
    const [assignmentDoc, legacyAssignmentDoc] = await Promise.all([
      db.collection("assignments").doc(assignmentId).get(),
      db.collection("testAssignments").doc(assignmentId).get(),
    ]);

    const assignment = assignmentDoc.exists
      ? assignmentDoc.data()
      : legacyAssignmentDoc.exists
        ? legacyAssignmentDoc.data()
        : null;

    if (!assignment) {
      continue;
    }

    const questions = loadQuestionsFromAssignmentSnapshot(assignment);

    if (questions.length > 0) {
      return questions;
    }
  }

  return [];
}

async function loadQuestionsForAnalysisContext(
  testId: string,
  results: any[]
) {
  const snapshotQuestions = await loadQuestionsFromResultAssignments(results);

  if (snapshotQuestions.length > 0) {
    return normalizeQuestionSequence(snapshotQuestions);
  }

  return normalizeQuestionSequence(await loadQuestionsForAnalysis(testId));
}

function buildGroupKey(parts: unknown[]) {
  return parts.map((part) => safeString(part).toLowerCase()).join("||");
}

function createEmptyGroup(params: {
  key: string;
  subject?: string;
  grade?: string;
  topic?: string;
  knowledgeUnit?: string;
  skill?: string;
  learningOutcome?: string;
  cognitiveLevel?: string;
  difficulty?: string;
}): GroupAnalysisItem {
  return {
    key: params.key,

    subject: safeString(params.subject),
    grade: safeString(params.grade),
    topic: safeString(params.topic),
    knowledgeUnit: safeString(params.knowledgeUnit),
    skill: safeString(params.skill),
    learningOutcome: safeString(params.learningOutcome),
    cognitiveLevel: safeString(params.cognitiveLevel),
    difficulty: safeString(params.difficulty),

    totalQuestions: 0,
    totalAnswers: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    blankAnswers: 0,

    correctRate: 0,
    wrongRate: 0,

    level: "no_data",
    levelLabel: "Chưa đủ bằng chứng",
    evidenceCount: 0,
    evidenceLabel: "0 câu, 0 lượt trả lời",
    confidence: "insufficient",
    confidenceLabel: "Chưa đủ dữ liệu",
    classificationEligible: false,
    recommendations: [],
  };
}

function finalizeGroup(group: GroupAnalysisItem): GroupAnalysisItem {
  const correctRate = percent(group.correctAnswers, group.totalAnswers);
  const wrongRate = percent(group.wrongAnswers, group.totalAnswers);
  const assessment = getLearningAssessment({
    correctRate,
    questionCount: group.totalQuestions,
    responseCount: group.totalAnswers,
  });
  const level = assessment.level;

  return {
    ...group,
    correctRate,
    wrongRate,
    level,
    levelLabel: assessment.levelLabel,
    evidenceCount: group.totalQuestions,
    evidenceLabel: assessment.evidenceLabel,
    confidence: assessment.confidence,
    confidenceLabel: assessment.confidenceLabel,
    classificationEligible: assessment.eligible,
    recommendations: buildRecommendations({
      subject: group.subject,
      topic: group.topic,
      skill: group.skill,
      learningOutcome: group.learningOutcome,
      level,
    }),
  };
}

function getResultScoreInfo(result: any, totalQuestions: number) {
  const rawScore = Number(result.score);
  const score = Number.isFinite(rawScore) ? rawScore : 0;
  const rawMaxScore = Number(
    result.totalScore ??
      result.maxScore ??
      result.maximumRawScore ??
      result.totalQuestions ??
      totalQuestions ??
      0
  );
  const maxScore = Number.isFinite(rawMaxScore) ? rawMaxScore : 0;

  const percentageFromResult = Number(result.percentage || result.percent || NaN);

  const percentage = Number.isFinite(percentageFromResult)
    ? Math.round(percentageFromResult)
    : maxScore > 0
      ? Math.round((score / maxScore) * 100)
      : 0;

  return {
    score: Number.isFinite(score) ? score : 0,
    percentage,
  };
}

function getResultTimestamp(result: any): number {
  const value = safeString(result.submittedAt || result.createdAt || result.startedAt);
  const timestamp = value ? new Date(value).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getStudentResultKey(result: any, index: number): string {
  return (
    safeString(result.studentId) ||
    safeUpper(result.studentCode) ||
    safeString(result.id) ||
    `student-result-${index}`
  );
}

function buildStudentWeaknessAnalysis(params: {
  results: any[];
  questions: EmbeddedQuestion[];
}) {
  const items: StudentWeaknessItem[] = [];
  const resultsByStudent = new Map<string, any[]>();

  params.results.forEach((result, index) => {
    const key = getStudentResultKey(result, index);
    const currentResults = resultsByStudent.get(key) || [];
    currentResults.push(result);
    resultsByStudent.set(key, currentResults);
  });

  for (const studentResults of resultsByStudent.values()) {
    const orderedResults = studentResults
      .slice()
      .sort((a, b) => getResultTimestamp(a) - getResultTimestamp(b));
    const latestResult = orderedResults[orderedResults.length - 1];
    const topicMap = new Map<string, GroupAnalysisItem>();
    const skillMap = new Map<string, GroupAnalysisItem>();

    for (const q of params.questions) {
      const questionResult = getStudentQuestionResult(latestResult, q);
      const isCorrect = questionResult.isCorrect;
      const isBlank = questionResult.isBlank;

      const topicKey = buildGroupKey([q.subject, q.grade, q.topic]);
      const hasSkill = Boolean(safeString(q.skill));
      const skillKey = hasSkill
        ? buildGroupKey([
            q.subject,
            q.grade,
            q.topic,
            q.knowledgeUnit,
            q.skill,
            q.cognitiveLevel,
          ])
        : "";

      if (!topicMap.has(topicKey)) {
        topicMap.set(
          topicKey,
          createEmptyGroup({
            key: topicKey,
            subject: q.subject,
            grade: q.grade,
            topic: q.topic,
          })
        );
      }

      if (hasSkill && !skillMap.has(skillKey)) {
        skillMap.set(
          skillKey,
          createEmptyGroup({
            key: skillKey,
            subject: q.subject,
            grade: q.grade,
            topic: q.topic,
            knowledgeUnit: q.knowledgeUnit,
            skill: q.skill,
            learningOutcome: q.learningOutcome,
            cognitiveLevel: q.cognitiveLevel,
            difficulty: q.difficulty,
          })
        );
      }

      const topicGroup = topicMap.get(topicKey);
      const skillGroup = hasSkill ? skillMap.get(skillKey) : null;

      if (topicGroup) {
        topicGroup.totalQuestions++;
        topicGroup.totalAnswers++;

        if (isBlank) {
          topicGroup.blankAnswers++;
          topicGroup.wrongAnswers++;
        } else if (isCorrect) {
          topicGroup.correctAnswers++;
        } else {
          topicGroup.wrongAnswers++;
        }
      }

      if (skillGroup) {
        skillGroup.totalQuestions++;
        skillGroup.totalAnswers++;

        if (isBlank) {
          skillGroup.blankAnswers++;
          skillGroup.wrongAnswers++;
        } else if (isCorrect) {
          skillGroup.correctAnswers++;
        } else {
          skillGroup.wrongAnswers++;
        }
      }
    }

    const topics = Array.from(topicMap.values()).map(finalizeGroup);
    const skills = Array.from(skillMap.values()).map(finalizeGroup);

    const weakTopics = topics
      .filter((item) => item.level === "weak" || item.level === "very_weak")
      .sort((a, b) => a.correctRate - b.correctRate)
      .map((item) => item.topic)
      .filter(Boolean)
      .slice(0, 3);

    const weakSkills = skills
      .filter((item) => item.level === "weak" || item.level === "very_weak")
      .sort((a, b) => a.correctRate - b.correctRate)
      .map((item) => item.skill)
      .filter(Boolean)
      .slice(0, 3);

    const strongTopics = topics
      .filter((item) => item.level === "good")
      .sort((a, b) => b.correctRate - a.correctRate)
      .map((item) => item.topic)
      .filter(Boolean)
      .slice(0, 3);

    const strongSkills = skills
      .filter((item) => item.level === "good")
      .sort((a, b) => b.correctRate - a.correctRate)
      .map((item) => item.skill)
      .filter(Boolean)
      .slice(0, 5);

    const recommendations = skills
      .filter((item) => item.level === "weak" || item.level === "very_weak")
      .sort((a, b) => a.correctRate - b.correctRate)
      .flatMap((item) => item.recommendations)
      .filter(Boolean)
      .slice(0, 8);

    const scoreInfos = orderedResults.map((result) =>
      getResultScoreInfo(result, params.questions.length)
    );
    const scoreInfo = scoreInfos[scoreInfos.length - 1];
    const previousScoreInfo = scoreInfos.length > 1 ? scoreInfos[scoreInfos.length - 2] : null;
    const averagePercentage = Math.round(
      scoreInfos.reduce((sum, item) => sum + item.percentage, 0) /
        Math.max(1, scoreInfos.length)
    );
    const evidenceQuestionCount = skills.reduce(
      (total, item) => total + item.totalQuestions,
      0
    );

    items.push({
      resultId: safeString(latestResult.id),

      studentName:
        safeString(latestResult.studentName) ||
        safeString(latestResult.fullName) ||
        safeString(latestResult.name) ||
        "--",
      studentCode:
        safeString(latestResult.studentCode) ||
        safeString(latestResult.studentId) ||
        safeString(latestResult.code) ||
        "--",
      className: safeString(latestResult.className),
      classId: safeString(latestResult.classId),

      score: scoreInfo.score,
      percentage: scoreInfo.percentage,
      averagePercentage,
      attemptCount: orderedResults.length,
      trendPercentagePoints: previousScoreInfo
        ? scoreInfo.percentage - previousScoreInfo.percentage
        : null,
      evidenceQuestionCount,

      weakTopics: Array.from(new Set(weakTopics)),
      weakSkills: Array.from(new Set(weakSkills)),
      strongTopics: Array.from(new Set(strongTopics)),
      strongSkills: Array.from(new Set(strongSkills)),

      recommendations: Array.from(new Set(recommendations)),
    });
  }

  return items.sort((a, b) => a.percentage - b.percentage);
}

function buildClassRecommendations(skillAnalysis: GroupAnalysisItem[]) {
  const weakSkills = skillAnalysis
    .filter((item) => item.level === "weak" || item.level === "very_weak")
    .sort((a, b) => {
      if (a.correctRate !== b.correctRate) {
        return a.correctRate - b.correctRate;
      }

      return b.totalAnswers - a.totalAnswers;
    })
    .slice(0, 8);

  const recommendations = weakSkills.flatMap((item) => item.recommendations);

  return {
    weakSkillCount: weakSkills.length,
    prioritySkills: weakSkills.map((item) => ({
      subject: item.subject,
      topic: item.topic,
      knowledgeUnit: item.knowledgeUnit,
      skill: item.skill,
      learningOutcome: item.learningOutcome,
      correctRate: item.correctRate,
      level: item.level,
      levelLabel: item.levelLabel,
      evidenceLabel: item.evidenceLabel,
      confidenceLabel: item.confidenceLabel,
    })),
    recommendations: Array.from(new Set(recommendations)).slice(0, 12),
  };
}

function buildScoreDistribution(results: any[]) {
  const buckets = [
    { label: "0-2", min: 0, max: 20, count: 0 },
    { label: "2-4", min: 20, max: 40, count: 0 },
    { label: "4-6", min: 40, max: 60, count: 0 },
    { label: "6-8", min: 60, max: 80, count: 0 },
    { label: "8-10", min: 80, max: 101, count: 0 },
  ];

  results.forEach((result) => {
    const percentage = getResultScoreInfo(result, 0).percentage;
    const bucket = buckets.find(
      (item) => percentage >= item.min && percentage < item.max
    );

    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets.map(({ label, count }) => ({
    label,
    count,
    percent: percent(count, results.length),
  }));
}

function buildScoreSummary(results: any[]) {
  const scoreInfos = results
    .map((result) => getResultScoreInfo(result, 0))
    .sort((a, b) => a.percentage - b.percentage);

  if (scoreInfos.length === 0) {
    return {
      averagePercent: 0,
      medianPercent: 0,
      highestPercent: 0,
      lowestPercent: 0,
      passRate: 0,
      scoreDistribution: buildScoreDistribution([]),
    };
  }

  const averagePercent = Math.round(
    scoreInfos.reduce((sum, item) => sum + item.percentage, 0) /
      scoreInfos.length
  );

  const middleIndex = Math.floor(scoreInfos.length / 2);
  const medianPercent =
    scoreInfos.length % 2 === 0
      ? Math.round(
          (scoreInfos[middleIndex - 1].percentage +
            scoreInfos[middleIndex].percentage) /
            2
        )
      : scoreInfos[middleIndex].percentage;

  return {
    averagePercent,
    medianPercent,
    highestPercent: scoreInfos[scoreInfos.length - 1].percentage,
    lowestPercent: scoreInfos[0].percentage,
    passRate: percent(
      scoreInfos.filter((item) => item.percentage >= 50).length,
      scoreInfos.length
    ),
    scoreDistribution: buildScoreDistribution(results),
  };
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const db = getAdminDb();

    const url = new URL(request.url);

    const testId = safeString(url.searchParams.get("testId"));
    const classId = safeString(url.searchParams.get("classId"));
    const assignmentId = safeString(url.searchParams.get("assignmentId"));
    const assignmentCode = safeUpper(url.searchParams.get("assignmentCode"));
    const studentCode = safeUpper(url.searchParams.get("studentCode"));

    if (!testId) {
      throw new ApiError("Vui lòng chọn một bài kiểm tra để phân tích.", 400);
    }

    const testDoc = await db.collection("tests").doc(testId).get();

    if (!testDoc.exists) {
      throw new ApiError("Không tìm thấy bài kiểm tra.", 404);
    }

    const test = testDoc.data() || {};

    if (!canAccessTest(teacher, test)) {
      throw new ApiError("Bạn không có quyền phân tích đề này.", 403);
    }

    const resultSnapshot = await db
      .collection("results")
      .get();

    let results = resultSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item: any) => resultBelongsToTeacher(teacher, item)) as any[];

    results = results.filter((item) => {
      const sameTestId = safeString(item.testId) === testId;
      const sameTestTitle =
        test.title &&
        safeLower(item.testTitle) === safeLower(test.title);

      return sameTestId || sameTestTitle;
    });

    if (classId) {
      results = results.filter((item) => safeString(item.classId) === classId);
    }

    if (assignmentId) {
      results = results.filter(
        (item) => safeString(item.assignmentId) === assignmentId
      );
    }

    if (assignmentCode) {
      results = results.filter(
        (item) => safeUpper(item.assignmentCode) === assignmentCode
      );
    }

    if (studentCode) {
      results = results.filter(
        (item) => safeUpper(item.studentCode) === studentCode
      );
    }

    const questions = await loadQuestionsForAnalysisContext(testId, results);

    if (questions.length === 0) {
      throw new ApiError(
        "Không tìm thấy câu hỏi của bài kiểm tra này. Hãy kiểm tra bài giao đã có snapshot câu hỏi hoặc kết quả đã được nộp bằng phiên bản mới.",
        404
      );
    }

    const analysisMap = new Map<string, AnalysisItem>();
    const topicMap = new Map<string, GroupAnalysisItem>();
    const skillMap = new Map<string, GroupAnalysisItem>();

    for (const q of questions) {
      analysisMap.set(q.id, {
        questionId: q.id,
        questionNumber: q.questionNumber,

        question: q.question,
        A: q.A,
        B: q.B,
        C: q.C,
        D: q.D,
        correct: q.correct,

        subject: q.subject,
        grade: q.grade,
        topic: q.topic,
        knowledgeUnit: q.knowledgeUnit,
        skill: q.skill,
        learningOutcome: q.learningOutcome,
        cognitiveLevel: q.cognitiveLevel,
        difficulty: q.difficulty,
        tags: q.tags,

        totalAnswered: 0,
        correctCount: 0,
        wrongCount: 0,
        blankCount: 0,
        correctRate: 0,
        wrongRate: 0,

        level: "Chưa có dữ liệu",
        learningLevel: "no_data",
        recommendation: "Chưa có đủ dữ liệu để đưa ra khuyến nghị.",
      });

      const topicKey = buildGroupKey([q.subject, q.grade, q.topic]);

      if (!topicMap.has(topicKey)) {
        topicMap.set(
          topicKey,
          createEmptyGroup({
            key: topicKey,
            subject: q.subject,
            grade: q.grade,
            topic: q.topic,
          })
        );
      }

      const topicGroup = topicMap.get(topicKey);

      if (topicGroup) {
        topicGroup.totalQuestions++;
      }

      const hasSkill = Boolean(safeString(q.skill));
      const skillKey = hasSkill
        ? buildGroupKey([
            q.subject,
            q.grade,
            q.topic,
            q.knowledgeUnit,
            q.skill,
            q.cognitiveLevel,
          ])
        : "";

      if (hasSkill && !skillMap.has(skillKey)) {
        skillMap.set(
          skillKey,
          createEmptyGroup({
            key: skillKey,
            subject: q.subject,
            grade: q.grade,
            topic: q.topic,
            knowledgeUnit: q.knowledgeUnit,
            skill: q.skill,
            learningOutcome: q.learningOutcome,
            cognitiveLevel: q.cognitiveLevel,
            difficulty: q.difficulty,
          })
        );
      }

      const skillGroup = hasSkill ? skillMap.get(skillKey) : null;

      if (skillGroup) {
        skillGroup.totalQuestions++;
      }
    }

    for (const result of results) {
      for (const q of questions) {
        const item = analysisMap.get(q.id);

        if (!item) continue;

        const questionResult = getStudentQuestionResult(result, q);
        const isCorrect = questionResult.isCorrect;
        const isBlank = questionResult.isBlank;

        item.totalAnswered++;

        if (isBlank) {
          item.blankCount++;
          item.wrongCount++;
        } else if (isCorrect) {
          item.correctCount++;
        } else {
          item.wrongCount++;
        }

        const topicKey = buildGroupKey([q.subject, q.grade, q.topic]);
        const hasSkill = Boolean(safeString(q.skill));
        const skillKey = hasSkill
          ? buildGroupKey([
              q.subject,
              q.grade,
              q.topic,
              q.knowledgeUnit,
              q.skill,
              q.cognitiveLevel,
            ])
          : "";

        const topicGroup = topicMap.get(topicKey);
        const skillGroup = hasSkill ? skillMap.get(skillKey) : null;

        if (topicGroup) {
          topicGroup.totalAnswers++;

          if (isBlank) {
            topicGroup.blankAnswers++;
            topicGroup.wrongAnswers++;
          } else if (isCorrect) {
            topicGroup.correctAnswers++;
          } else {
            topicGroup.wrongAnswers++;
          }
        }

        if (skillGroup) {
          skillGroup.totalAnswers++;

          if (isBlank) {
            skillGroup.blankAnswers++;
            skillGroup.wrongAnswers++;
          } else if (isCorrect) {
            skillGroup.correctAnswers++;
          } else {
            skillGroup.wrongAnswers++;
          }
        }
      }
    }

    const analysis = Array.from(analysisMap.values())
      .map((item) => {
        const correctRate = percent(item.correctCount, item.totalAnswered);
        const wrongRate = percent(item.wrongCount, item.totalAnswered);
        const learningLevel = getLearningLevel(correctRate, item.totalAnswered);

        return {
          ...item,
          correctRate,
          wrongRate,
          level: getQuestionDifficultyLabel(correctRate, item.totalAnswered),
          learningLevel,
          recommendation: getGenericRecommendation({
            level: learningLevel,
            topic: item.topic,
            skill: item.skill,
            learningOutcome: item.learningOutcome,
          }),
        };
      })
      .sort((a, b) => a.questionNumber - b.questionNumber);

    const topicAnalysis = Array.from(topicMap.values())
      .map(finalizeGroup)
      .sort((a, b) => {
        if (a.correctRate !== b.correctRate) {
          return a.correctRate - b.correctRate;
        }

        return b.totalAnswers - a.totalAnswers;
      });

    const skillAnalysis = Array.from(skillMap.values())
      .map(finalizeGroup)
      .sort((a, b) => {
        if (a.correctRate !== b.correctRate) {
          return a.correctRate - b.correctRate;
        }

        return b.totalAnswers - a.totalAnswers;
      });

    const hardestQuestions = analysis
      .filter((item) => item.totalAnswered > 0 && item.wrongCount > 0)
      .slice()
      .sort((a, b) => {
        if (a.correctRate !== b.correctRate) {
          return a.correctRate - b.correctRate;
        }

        return b.wrongCount - a.wrongCount;
      })
      .slice(0, 5);

    const studentWeaknessAnalysis = buildStudentWeaknessAnalysis({
      results,
      questions,
    });

    const classRecommendations = buildClassRecommendations(skillAnalysis);
    const scoreSummary = buildScoreSummary(results);
    const metadataCompleteness = buildMetadataCompleteness(questions);

    return NextResponse.json({
      status: "success",

      test: {
        id: testDoc.id,
        title: test.title || "",
        subject: test.subject || "",
        grade: test.grade || "",
        questionCount: questions.length,
        source: test.source || "manual",
      },

      summary: {
        totalSubmits: results.length,
        totalQuestions: questions.length,
        totalTopics: topicAnalysis.length,
        totalSkills: skillAnalysis.length,
        weakSkillCount: classRecommendations.weakSkillCount,
        averagePercent: scoreSummary.averagePercent,
        medianPercent: scoreSummary.medianPercent,
        highestPercent: scoreSummary.highestPercent,
        lowestPercent: scoreSummary.lowestPercent,
        passRate: scoreSummary.passRate,
        scoreDistribution: scoreSummary.scoreDistribution,
        metadataCompleteness,
      },

      hardestQuestions,
      analysis,

      topicAnalysis,
      skillAnalysis,
      studentWeaknessAnalysis,
      classRecommendations,
    });
  } catch (error: any) {
    console.error("GET /api/teacher/question-analysis error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không phân tích được câu hỏi.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
