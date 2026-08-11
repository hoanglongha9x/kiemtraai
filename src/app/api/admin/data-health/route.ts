import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type CollectionHealth = {
  collection: string;
  total: number;

  missingSchoolId: number;
  emptySchoolId: number;
  defaultSchoolId: number;
  fptSchoolId: number;
  otherSchoolId: number;

  missingCreatedAt: number;
  missingUpdatedAt: number;

  issues: string[];
};

type DataHealthResponse = {
  status: "success";
  generatedAt: string;
  admin: {
    email: string;
    role: string;
    schoolId: string;
  };
  summary: {
    totalCollections: number;
    totalDocuments: number;
    totalIssues: number;
    collectionsNeedReview: number;
  };
  collections: CollectionHealth[];
  details: {
    teachers: {
      inactiveTeachers: number;
      missingRole: number;
      missingStatus: number;
      missingUid: number;
    };
    classes: {
      missingTeacherEmail: number;
      missingClassName: number;
      deletedClasses: number;
      lockedClasses: number;
      duplicateClassGroups: {
        key: string;
        count: number;
        classIds: string[];
      }[];
    };
    students: {
      missingStudentCode: number;
      missingStudentName: number;
      missingClassId: number;
      lockedStudents: number;
      duplicateStudentGroups: {
        key: string;
        count: number;
        studentIds: string[];
      }[];
    };
    tests: {
      missingTeacherEmail: number;
      missingTitle: number;
      missingQuestionCount: number;
      missingStatus: number;
      deletedTests: number;
      draftTests: number;
      testsWithEmbeddedQuestions: number;
      testsWithoutEmbeddedQuestions: number;
    };
    assignments: {
      missingAssignmentCode: number;
      missingTestId: number;
      missingClassIds: number;
      legacyClassIdOnly: number;
      inactiveAssignments: number;
      missingPasswordHashButHasPassword: number;
    };
    results: {
      missingTestId: number;
      missingAssignmentId: number;
      missingAssignmentCode: number;
      missingStudentCode: number;
      missingTeacherEmail: number;
      missingClassId: number;
      missingScore: number;
      resultsWithSuspiciousActivity: number;
    };
    questionBank: {
      missingTeacherEmail: number;
      missingQuestion: number;
      missingCorrect: number;
      missingVisibility: number;
      deletedQuestions: number;
    };
  };
};

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown): string {
  return safeString(value).toLowerCase();
}

function isMissing(value: unknown): boolean {
  return safeString(value) === "";
}

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.replace("Bearer ", "").trim();
}

function createBaseHealth(collection: string): CollectionHealth {
  return {
    collection,
    total: 0,

    missingSchoolId: 0,
    emptySchoolId: 0,
    defaultSchoolId: 0,
    fptSchoolId: 0,
    otherSchoolId: 0,

    missingCreatedAt: 0,
    missingUpdatedAt: 0,

    issues: [],
  };
}

function updateSchoolIdHealth(health: CollectionHealth, data: any) {
  const rawSchoolId = data.schoolId;

  if (rawSchoolId === undefined || rawSchoolId === null) {
    health.missingSchoolId += 1;
    return;
  }

  const schoolId = safeString(rawSchoolId);

  if (!schoolId) {
    health.emptySchoolId += 1;
    return;
  }

  if (schoolId === "default") {
    health.defaultSchoolId += 1;
    return;
  }

  if (schoolId === "fpt") {
    health.fptSchoolId += 1;
    return;
  }

  health.otherSchoolId += 1;
}

function finalizeCollectionHealth(health: CollectionHealth) {
  if (health.missingSchoolId > 0) {
    health.issues.push(`Có ${health.missingSchoolId} document thiếu schoolId.`);
  }

  if (health.emptySchoolId > 0) {
    health.issues.push(`Có ${health.emptySchoolId} document schoolId rỗng.`);
  }

  if (health.defaultSchoolId > 0) {
    health.issues.push(
      `Có ${health.defaultSchoolId} document đang dùng schoolId = default.`
    );
  }

  if (health.missingCreatedAt > 0) {
    health.issues.push(
      `Có ${health.missingCreatedAt} document thiếu createdAt.`
    );
  }

  if (health.missingUpdatedAt > 0) {
    health.issues.push(
      `Có ${health.missingUpdatedAt} document thiếu updatedAt.`
    );
  }

  return health;
}

function analyzeCommonFields(collection: string, docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  const health = createBaseHealth(collection);

  health.total = docs.length;

  for (const doc of docs) {
    const data = doc.data() || {};

    updateSchoolIdHealth(health, data);

    if (isMissing(data.createdAt)) {
      health.missingCreatedAt += 1;
    }

    if (isMissing(data.updatedAt)) {
      health.missingUpdatedAt += 1;
    }
  }

  return finalizeCollectionHealth(health);
}

function buildDuplicateGroups(
  items: {
    id: string;
    key: string;
  }[]
) {
  const map = new Map<string, string[]>();

  for (const item of items) {
    if (!item.key) continue;

    const current = map.get(item.key) || [];
    current.push(item.id);
    map.set(item.key, current);
  }

  return Array.from(map.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({
      key,
      count: ids.length,
      classIds: ids,
      studentIds: ids,
    }));
}

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin(request);
    const db = getAdminDb();

    const [
      teachersSnapshot,
      classesSnapshot,
      studentsSnapshot,
      testsSnapshot,
      assignmentsSnapshot,
      resultsSnapshot,
      questionBankSnapshot,
    ] = await Promise.all([
      db.collection("teachers").get(),
      db.collection("classes").get(),
      db.collection("students").get(),
      db.collection("tests").get(),
      db.collection("testAssignments").get(),
      db.collection("results").get(),
      db.collection("questionBank").get(),
    ]);

    const teachersDocs = teachersSnapshot.docs;
    const classesDocs = classesSnapshot.docs;
    const studentsDocs = studentsSnapshot.docs;
    const testsDocs = testsSnapshot.docs;
    const assignmentsDocs = assignmentsSnapshot.docs;
    const resultsDocs = resultsSnapshot.docs;
    const questionBankDocs = questionBankSnapshot.docs;

    const collections = [
      analyzeCommonFields("teachers", teachersDocs),
      analyzeCommonFields("classes", classesDocs),
      analyzeCommonFields("students", studentsDocs),
      analyzeCommonFields("tests", testsDocs),
      analyzeCommonFields("testAssignments", assignmentsDocs),
      analyzeCommonFields("results", resultsDocs),
      analyzeCommonFields("questionBank", questionBankDocs),
    ];

    const teacherDetails = {
      inactiveTeachers: 0,
      missingRole: 0,
      missingStatus: 0,
      missingUid: 0,
    };

    for (const doc of teachersDocs) {
      const data = doc.data() || {};

      if (data.status !== "active") teacherDetails.inactiveTeachers += 1;
      if (isMissing(data.role)) teacherDetails.missingRole += 1;
      if (isMissing(data.status)) teacherDetails.missingStatus += 1;
      if (isMissing(data.uid)) teacherDetails.missingUid += 1;
    }

    const classDuplicateItems: { id: string; key: string }[] = [];

    const classDetails = {
      missingTeacherEmail: 0,
      missingClassName: 0,
      deletedClasses: 0,
      lockedClasses: 0,
      duplicateClassGroups: [] as {
        key: string;
        count: number;
        classIds: string[];
      }[],
    };

    for (const doc of classesDocs) {
      const data = doc.data() || {};
      const status = safeString(data.status);

      if (isMissing(data.teacherEmail)) classDetails.missingTeacherEmail += 1;
      if (isMissing(data.className)) classDetails.missingClassName += 1;
      if (status === "deleted") classDetails.deletedClasses += 1;
      if (status === "locked") classDetails.lockedClasses += 1;

      if (status !== "deleted") {
        const key = [
          safeString(data.schoolId || "default"),
          normalizeEmail(data.teacherEmail),
          safeString(data.className).toLowerCase(),
          safeString(data.grade).toLowerCase(),
          safeString(data.schoolYear).toLowerCase(),
        ].join("|");

        classDuplicateItems.push({
          id: doc.id,
          key,
        });
      }
    }

    classDetails.duplicateClassGroups = buildDuplicateGroups(
      classDuplicateItems
    ).map((group) => ({
      key: group.key,
      count: group.count,
      classIds: group.classIds,
    }));

    const studentDuplicateItems: { id: string; key: string }[] = [];

    const studentDetails = {
      missingStudentCode: 0,
      missingStudentName: 0,
      missingClassId: 0,
      lockedStudents: 0,
      duplicateStudentGroups: [] as {
        key: string;
        count: number;
        studentIds: string[];
      }[],
    };

    for (const doc of studentsDocs) {
      const data = doc.data() || {};
      const status = safeString(data.status);

      if (isMissing(data.studentCode)) studentDetails.missingStudentCode += 1;
      if (isMissing(data.studentName)) studentDetails.missingStudentName += 1;
      if (isMissing(data.classId)) studentDetails.missingClassId += 1;
      if (status === "locked") studentDetails.lockedStudents += 1;

      if (status !== "deleted") {
        const key = [
          safeString(data.schoolId || "default"),
          safeString(data.classId),
          safeString(data.studentCode).toUpperCase(),
        ].join("|");

        studentDuplicateItems.push({
          id: doc.id,
          key,
        });
      }
    }

    studentDetails.duplicateStudentGroups = buildDuplicateGroups(
      studentDuplicateItems
    ).map((group) => ({
      key: group.key,
      count: group.count,
      studentIds: group.studentIds,
    }));

    const testDetails = {
      missingTeacherEmail: 0,
      missingTitle: 0,
      missingQuestionCount: 0,
      missingStatus: 0,
      deletedTests: 0,
      draftTests: 0,
      testsWithEmbeddedQuestions: 0,
      testsWithoutEmbeddedQuestions: 0,
    };

    for (const doc of testsDocs) {
      const data = doc.data() || {};
      const status = safeString(data.status);

      if (isMissing(data.teacherEmail)) testDetails.missingTeacherEmail += 1;
      if (isMissing(data.title) && isMissing(data.testTitle)) {
        testDetails.missingTitle += 1;
      }
      if (data.questionCount === undefined || data.questionCount === null) {
        testDetails.missingQuestionCount += 1;
      }
      if (isMissing(data.status)) testDetails.missingStatus += 1;
      if (status === "deleted") testDetails.deletedTests += 1;
      if (status === "draft") testDetails.draftTests += 1;

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        testDetails.testsWithEmbeddedQuestions += 1;
      } else {
        testDetails.testsWithoutEmbeddedQuestions += 1;
      }
    }

    const assignmentDetails = {
      missingAssignmentCode: 0,
      missingTestId: 0,
      missingClassIds: 0,
      legacyClassIdOnly: 0,
      inactiveAssignments: 0,
      missingPasswordHashButHasPassword: 0,
    };

    for (const doc of assignmentsDocs) {
      const data = doc.data() || {};

      if (isMissing(data.assignmentCode)) {
        assignmentDetails.missingAssignmentCode += 1;
      }

      if (isMissing(data.testId)) {
        assignmentDetails.missingTestId += 1;
      }

      const hasClassIds =
        Array.isArray(data.classIds) && data.classIds.length > 0;
      const hasLegacyClassId = !isMissing(data.classId);

      if (!hasClassIds) {
        assignmentDetails.missingClassIds += 1;
      }

      if (!hasClassIds && hasLegacyClassId) {
        assignmentDetails.legacyClassIdOnly += 1;
      }

      if (data.status !== "active") {
        assignmentDetails.inactiveAssignments += 1;
      }

      if (!isMissing(data.password) && isMissing(data.passwordHash)) {
        assignmentDetails.missingPasswordHashButHasPassword += 1;
      }
    }

    const resultDetails = {
      missingTestId: 0,
      missingAssignmentId: 0,
      missingAssignmentCode: 0,
      missingStudentCode: 0,
      missingTeacherEmail: 0,
      missingClassId: 0,
      missingScore: 0,
      resultsWithSuspiciousActivity: 0,
    };

    for (const doc of resultsDocs) {
      const data = doc.data() || {};

      if (isMissing(data.testId)) resultDetails.missingTestId += 1;
      if (isMissing(data.assignmentId)) resultDetails.missingAssignmentId += 1;
      if (isMissing(data.assignmentCode)) resultDetails.missingAssignmentCode += 1;
      if (isMissing(data.studentCode)) resultDetails.missingStudentCode += 1;
      if (isMissing(data.teacherEmail)) resultDetails.missingTeacherEmail += 1;
      if (isMissing(data.classId)) resultDetails.missingClassId += 1;

      if (data.score === undefined || data.score === null) {
        resultDetails.missingScore += 1;
      }

      if (
        Boolean(data.hasSuspiciousActivity) ||
        Number(data.suspiciousEventCount || 0) > 0
      ) {
        resultDetails.resultsWithSuspiciousActivity += 1;
      }
    }

    const questionBankDetails = {
      missingTeacherEmail: 0,
      missingQuestion: 0,
      missingCorrect: 0,
      missingVisibility: 0,
      deletedQuestions: 0,
    };

    for (const doc of questionBankDocs) {
      const data = doc.data() || {};

      if (isMissing(data.teacherEmail)) {
        questionBankDetails.missingTeacherEmail += 1;
      }

      if (isMissing(data.question)) {
        questionBankDetails.missingQuestion += 1;
      }

      if (isMissing(data.correct)) {
        questionBankDetails.missingCorrect += 1;
      }

      if (isMissing(data.visibility)) {
        questionBankDetails.missingVisibility += 1;
      }

      if (data.status === "deleted") {
        questionBankDetails.deletedQuestions += 1;
      }
    }

    const totalDocuments = collections.reduce(
      (sum, item) => sum + item.total,
      0
    );

    const totalIssues =
      collections.reduce((sum, item) => sum + item.issues.length, 0) +
      teacherDetails.inactiveTeachers +
      teacherDetails.missingRole +
      teacherDetails.missingStatus +
      teacherDetails.missingUid +
      classDetails.missingTeacherEmail +
      classDetails.missingClassName +
      classDetails.duplicateClassGroups.length +
      studentDetails.missingStudentCode +
      studentDetails.missingStudentName +
      studentDetails.missingClassId +
      studentDetails.duplicateStudentGroups.length +
      testDetails.missingTeacherEmail +
      testDetails.missingTitle +
      testDetails.missingQuestionCount +
      testDetails.missingStatus +
      assignmentDetails.missingAssignmentCode +
      assignmentDetails.missingTestId +
      assignmentDetails.missingClassIds +
      resultDetails.missingTestId +
      resultDetails.missingAssignmentId +
      resultDetails.missingAssignmentCode +
      resultDetails.missingStudentCode +
      resultDetails.missingTeacherEmail +
      resultDetails.missingClassId +
      resultDetails.missingScore +
      questionBankDetails.missingTeacherEmail +
      questionBankDetails.missingQuestion +
      questionBankDetails.missingCorrect +
      questionBankDetails.missingVisibility;

    const collectionsNeedReview = collections.filter(
      (item) => item.issues.length > 0
    ).length;

    const response: DataHealthResponse = {
      status: "success",
      generatedAt: new Date().toISOString(),
      admin,
      summary: {
        totalCollections: collections.length,
        totalDocuments,
        totalIssues,
        collectionsNeedReview,
      },
      collections,
      details: {
        teachers: teacherDetails,
        classes: classDetails,
        students: studentDetails,
        tests: testDetails,
        assignments: assignmentDetails,
        results: resultDetails,
        questionBank: questionBankDetails,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("admin data health API error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không kiểm tra được dữ liệu hệ thống.",
      },
      { status: 500 }
    );
  }
}