"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

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

type MigrationPreviewItem = {
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

type CollectionMigrationPreview = {
  collection: string;
  totalNeedMigration: number;
  missingSchoolId: number;
  emptySchoolId: number;
  defaultSchoolId: number;
  samples: MigrationPreviewItem[];
};

type MigrationPreviewResponse = {
  status: "success";
  generatedAt: string;
  targetSchoolId: string;
  summary: {
    totalCollections: number;
    totalNeedMigration: number;
    collectionsNeedMigration: number;
  };
  previews: CollectionMigrationPreview[];
  warning: string;
};

type MigrationRunResult = {
  collection: string;
  scanned: number;
  migrated: number;
  skipped: number;
  samples: {
    id: string;
    previousSchoolId: string;
    newSchoolId: string;
    title: string;
  }[];
};

type MigrationRunResponse = {
  status: "success";
  migratedAt: string;
  targetSchoolId: string;
  confirmText: string;
  limitPerCollection: number;
  summary: {
    totalCollections: number;
    totalScanned: number;
    totalMigrated: number;
    totalSkipped: number;
  };
  results: MigrationRunResult[];
  note: string;
};

type ClassIdsMigrationPreviewItem = {
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

type ClassIdsMigrationPreviewResponse = {
  status: "success";
  generatedAt: string;
  summary: {
    totalCollections: number;
    totalNeedMigration: number;
    collectionsNeedMigration: number;
  };
  preview: {
    collection: "testAssignments";
    totalNeedMigration: number;
    missingClassIds: number;
    emptyClassIds: number;
    invalidClassIds: number;
    samples: ClassIdsMigrationPreviewItem[];
  };
  warning: string;
};

type ClassIdsMigrationRunResponse = {
  status: "success";
  migratedAt: string;
  confirmText: string;
  limit: number;
  summary: {
    totalCollections: number;
    totalScanned: number;
    totalMigrated: number;
    totalSkipped: number;
  };
  result: {
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
  note: string;
};

type QuestionCountPreviewItem = {
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
  samples: QuestionCountPreviewItem[];
  warning: string;
};

type QuestionCountMigrationRunResponse = {
  status: "success";
  migratedAt: string;
  confirmText: string;
  limit: number;
  summary: {
    totalCollections: number;
    totalScanned: number;
    totalMigrated: number;
    totalSkipped: number;
  };
  result: {
    collection: "tests";
    scanned: number;
    migrated: number;
    skipped: number;
    samples: {
      id: string;
      title: string;
      teacherEmail: string;
      schoolId: string;
      status: string;
      source: string;
      previousQuestionCount: number | null;
      newQuestionCount: number;
      embeddedQuestionCount: number;
      questionCollectionCount: number;
      reason:
        | "missing_questionCount"
        | "mismatched_questionCount"
        | "invalid_questionCount";
    }[];
  };
  note: string;
};

type TestQuestionMetadataPreviewItem = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  teacherEmail: string;
  schoolId: string;
  status: string;
  source: string;
  questionCount: number;
  missingMetadataCount: number;
  canUpdateFromBankCount: number;
  cannotUpdateCount: number;
};

type TestQuestionMetadataPreviewResponse = {
  status: "success";
  generatedAt: string;
  admin: {
    email: string;
    role: string;
    schoolId: string;
  };
  summary: {
    totalTests: number;
    testsWithEmbeddedQuestions: number;
    testsNeedMigration: number;
    totalEmbeddedQuestions: number;
    questionsMissingMetadata: number;
    questionsWithBankQuestionId: number;
    questionsCanUpdateFromBank: number;
    questionsCannotUpdate: number;
  };
  samples: TestQuestionMetadataPreviewItem[];
  warning: string;
};

type TestQuestionMetadataMigrationRunResponse = {
  status: "success";
  migratedAt: string;
  confirmText: string;
  limit: number;
  admin: {
    email: string;
    role: string;
    schoolId: string;
  };
  summary: {
    totalCollections: number;
    totalScanned: number;
    totalMigrated: number;
    totalSkipped: number;
    updatedQuestions: number;
    cannotUpdateQuestions: number;
  };
  result: {
    collection: "tests";
    scanned: number;
    migrated: number;
    skipped: number;
    updatedQuestions: number;
    cannotUpdateQuestions: number;
    samples: {
      id: string;
      title: string;
      subject: string;
      grade: string;
      teacherEmail: string;
      schoolId: string;
      updatedQuestionCount: number;
      cannotUpdateQuestionCount: number;
    }[];
  };
  note: string;
};

async function adminApi<TResponse>(url: string): Promise<TResponse> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Bạn chưa đăng nhập.");
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("API không trả về JSON:", {
      url,
      status: response.status,
      text: text.slice(0, 500),
    });

    throw new Error(
      `API ${url} không trả về JSON. Status: ${response.status}.`
    );
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}

async function adminPostApi<TResponse>(
  url: string,
  payload: unknown
): Promise<TResponse> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Bạn chưa đăng nhập.");
  }

  const token = await currentUser.getIdToken();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("API không trả về JSON:", {
      url,
      status: response.status,
      text: text.slice(0, 500),
    });

    throw new Error(
      `API ${url} không trả về JSON. Status: ${response.status}.`
    );
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}

function formatDate(value?: string) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN");
}

function getHealthLevel(totalIssues: number) {
  if (totalIssues === 0) {
    return {
      label: "Tốt",
      color: "#166534",
      background: "#dcfce7",
    };
  }

  if (totalIssues <= 10) {
    return {
      label: "Cần kiểm tra nhẹ",
      color: "#92400e",
      background: "#fef3c7",
    };
  }

  return {
    label: "Cần xử lý",
    color: "#991b1b",
    background: "#fee2e2",
  };
}

function getCollectionStatus(item: CollectionHealth) {
  if (item.issues.length === 0) {
    return {
      label: "Ổn",
      style: successBadge,
    };
  }

  return {
    label: "Cần xem",
    style: dangerBadge,
  };
}

export default function AdminDataHealthPage() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DataHealthResponse | null>(null);

  const [migrationPreview, setMigrationPreview] =
    useState<MigrationPreviewResponse | null>(null);

  const [classIdsPreview, setClassIdsPreview] =
    useState<ClassIdsMigrationPreviewResponse | null>(null);

  const [questionCountPreview, setQuestionCountPreview] =
    useState<QuestionCountPreviewResponse | null>(null);
  const [questionCountMigrationResult, setQuestionCountMigrationResult] =
  useState<QuestionCountMigrationRunResponse | null>(null);
const [testMetadataPreview, setTestMetadataPreview] =
  useState<TestQuestionMetadataPreviewResponse | null>(null);

const [testMetadataMigrationResult, setTestMetadataMigrationResult] =
  useState<TestQuestionMetadataMigrationRunResponse | null>(null);

const [testMetadataConfirmText, setTestMetadataConfirmText] = useState("");

const [testMetadataPreviewLoading, setTestMetadataPreviewLoading] =
  useState(false);

const [testMetadataMigrating, setTestMetadataMigrating] = useState(false);
const [questionCountConfirmText, setQuestionCountConfirmText] = useState("");

const [questionCountMigrating, setQuestionCountMigrating] = useState(false);
  const [migrationResult, setMigrationResult] =
    useState<MigrationRunResponse | null>(null);

  const [classIdsMigrationResult, setClassIdsMigrationResult] =
    useState<ClassIdsMigrationRunResponse | null>(null);

  const [confirmText, setConfirmText] = useState("");
  const [classIdsConfirmText, setClassIdsConfirmText] = useState("");

  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [classIdsPreviewLoading, setClassIdsPreviewLoading] = useState(false);
  const [questionCountPreviewLoading, setQuestionCountPreviewLoading] =
    useState(false);
  const [migrating, setMigrating] = useState(false);
  const [classIdsMigrating, setClassIdsMigrating] = useState(false);

  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser?.email) {
        setMessage("Vui lòng đăng nhập bằng tài khoản admin.");
        setLoading(false);
        return;
      }

      await loadDataHealth();
      setLoading(false);
    });

    return () => unsub();
  }, []);

  async function loadDataHealth() {
    try {
      setMessage("Đang kiểm tra dữ liệu hệ thống...");

      const response = await adminApi<DataHealthResponse>(
        "/api/admin/data-health"
      );

      setData(response);
      setMessage("");
    } catch (error: any) {
      setData(null);
      setMessage(error?.message || "Không tải được báo cáo dữ liệu.");
    }
  }

  async function loadMigrationPreview() {
    try {
      setPreviewLoading(true);
      setMigrationResult(null);
      setMessage("Đang tạo bản xem trước migration...");

      const response = await adminApi<MigrationPreviewResponse>(
        "/api/admin/migration-preview?targetSchoolId=fpt"
      );

      setMigrationPreview(response);
      setMessage("");
    } catch (error: any) {
      setMigrationPreview(null);
      setMessage(error?.message || "Không tạo được migration preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadClassIdsMigrationPreview() {
    try {
      setClassIdsPreviewLoading(true);
      setClassIdsMigrationResult(null);
      setMessage("Đang tạo preview classIds migration...");

      const response = await adminApi<ClassIdsMigrationPreviewResponse>(
        "/api/admin/migration-preview-class-ids"
      );

      setClassIdsPreview(response);
      setMessage("");
    } catch (error: any) {
      setClassIdsPreview(null);
      setMessage(error?.message || "Không tạo được preview classIds migration.");
    } finally {
      setClassIdsPreviewLoading(false);
    }
  }
async function loadTestMetadataMigrationPreview() {
  try {
    setTestMetadataPreviewLoading(true);
    setTestMetadataMigrationResult(null);
    setMessage("Đang tạo preview test question metadata migration...");

    const response = await adminApi<TestQuestionMetadataPreviewResponse>(
      "/api/admin/migration-preview-test-question-metadata"
    );

    setTestMetadataPreview(response);
    setMessage("");
  } catch (error: any) {
    setTestMetadataPreview(null);
    setMessage(
      error?.message || "Không tạo được preview test question metadata migration."
    );
  } finally {
    setTestMetadataPreviewLoading(false);
  }
}

async function runTestMetadataMigration() {
  const requiredText = "MIGRATE TEST QUESTION METADATA";

  if (!testMetadataPreview) {
    setMessage("Bạn cần tạo preview test metadata trước khi chạy migration thật.");
    return;
  }

  if (testMetadataPreview.summary.questionsCanUpdateFromBank === 0) {
    setMessage("Không có câu hỏi nào có thể cập nhật metadata từ questionBank.");
    return;
  }

  if (testMetadataConfirmText.trim() !== requiredText) {
    setMessage(`Bạn cần nhập chính xác: ${requiredText}`);
    return;
  }

  const confirmed = window.confirm(
    "Bạn chắc chắn muốn migrate metadata câu hỏi trong đề cũ? Collection tests sẽ được cập nhật."
  );

  if (!confirmed) return;

  try {
    setTestMetadataMigrating(true);
    setTestMetadataMigrationResult(null);
    setMessage("Đang chạy migration test question metadata...");

    const response = await adminPostApi<TestQuestionMetadataMigrationRunResponse>(
      "/api/admin/migrate-test-question-metadata",
      {
        confirmText: requiredText,
        limit: 500,
      }
    );

    setTestMetadataMigrationResult(response);

    await loadDataHealth();
    await loadTestMetadataMigrationPreview();

    setMessage(
      `Migration metadata hoàn tất. Đã migrate ${response.summary.totalMigrated} đề, cập nhật ${response.summary.updatedQuestions} câu hỏi.`
    );
  } catch (error: any) {
    setMessage(
      error?.message || "Không chạy được migration test question metadata."
    );
  } finally {
    setTestMetadataMigrating(false);
  }
}

 async function loadQuestionCountMigrationPreview() {
  try {
    setQuestionCountPreviewLoading(true);
    setQuestionCountMigrationResult(null);
    setMessage("Đang tạo preview questionCount migration...");

    const response = await adminApi<QuestionCountPreviewResponse>(
      "/api/admin/migration-preview-question-count"
    );

    setQuestionCountPreview(response);
    setMessage("");
  } catch (error: any) {
    setQuestionCountPreview(null);
    setMessage(
      error?.message || "Không tạo được preview questionCount migration."
    );
  } finally {
    setQuestionCountPreviewLoading(false);
  }
}
async function runQuestionCountMigration() {
  const requiredText = "MIGRATE QUESTIONCOUNT";

  if (!questionCountPreview) {
    setMessage("Bạn cần tạo preview questionCount trước khi chạy migration thật.");
    return;
  }

  if (questionCountPreview.summary.totalNeedMigration === 0) {
    setMessage("Không có đề nào cần migrate questionCount.");
    return;
  }

  if (questionCountConfirmText.trim() !== requiredText) {
    setMessage(`Bạn cần nhập chính xác: ${requiredText}`);
    return;
  }

  const confirmed = window.confirm(
    "Bạn chắc chắn muốn migrate questionCount thật? Collection tests sẽ được cập nhật."
  );

  if (!confirmed) return;

  try {
    setQuestionCountMigrating(true);
    setQuestionCountMigrationResult(null);
    setMessage("Đang chạy migration questionCount...");

    const response = await adminPostApi<QuestionCountMigrationRunResponse>(
      "/api/admin/migrate-question-count",
      {
        confirmText: requiredText,
        limit: 500,
      }
    );

    setQuestionCountMigrationResult(response);

    await loadDataHealth();
    await loadQuestionCountMigrationPreview();

    setMessage(
      `Migration questionCount hoàn tất. Đã migrate ${response.summary.totalMigrated} đề.`
    );
  } catch (error: any) {
    setMessage(error?.message || "Không chạy được migration questionCount.");
  } finally {
    setQuestionCountMigrating(false);
  }
}
  async function runSchoolIdMigration() {
    const requiredText = "MIGRATE SCHOOLID TO FPT";

    if (!migrationPreview) {
      setMessage("Bạn cần tạo migration preview trước khi chạy migration thật.");
      return;
    }

    if (migrationPreview.summary.totalNeedMigration === 0) {
      setMessage("Không có document nào cần migrate.");
      return;
    }

    if (confirmText.trim() !== requiredText) {
      setMessage(`Bạn cần nhập chính xác: ${requiredText}`);
      return;
    }

    const confirmed = window.confirm(
      "Bạn chắc chắn muốn chạy migration thật? Dữ liệu Firestore sẽ được cập nhật."
    );

    if (!confirmed) return;

    try {
      setMigrating(true);
      setMigrationResult(null);
      setMessage("Đang chạy migration schoolId...");

      const response = await adminPostApi<MigrationRunResponse>(
        "/api/admin/migrate-school-id",
        {
          targetSchoolId: "fpt",
          confirmText: requiredText,
          limitPerCollection: 500,
          collections: [
            "classes",
            "students",
            "tests",
            "testAssignments",
            "results",
            "questionBank",
          ],
        }
      );

      setMigrationResult(response);

      await loadDataHealth();
      await loadMigrationPreview();

      setMessage(
        `Migration hoàn tất. Đã migrate ${response.summary.totalMigrated} document.`
      );
    } catch (error: any) {
      setMessage(error?.message || "Không chạy được migration.");
    } finally {
      setMigrating(false);
    }
  }

  async function runClassIdsMigration() {
    const requiredText = "MIGRATE CLASSIDS";

    if (!classIdsPreview) {
      setMessage("Bạn cần tạo preview classIds trước khi chạy migration thật.");
      return;
    }

    if (classIdsPreview.preview.totalNeedMigration === 0) {
      setMessage("Không có assignment nào cần migrate classIds.");
      return;
    }

    if (classIdsConfirmText.trim() !== requiredText) {
      setMessage(`Bạn cần nhập chính xác: ${requiredText}`);
      return;
    }

    const confirmed = window.confirm(
      "Bạn chắc chắn muốn migrate classIds thật? Dữ liệu testAssignments sẽ được cập nhật."
    );

    if (!confirmed) return;

    try {
      setClassIdsMigrating(true);
      setClassIdsMigrationResult(null);
      setMessage("Đang chạy migration classIds...");

      const response = await adminPostApi<ClassIdsMigrationRunResponse>(
        "/api/admin/migrate-class-ids",
        {
          confirmText: requiredText,
          limit: 500,
        }
      );

      setClassIdsMigrationResult(response);

      await loadDataHealth();
      await loadClassIdsMigrationPreview();

      setMessage(
        `Migration classIds hoàn tất. Đã migrate ${response.summary.totalMigrated} assignment.`
      );
    } catch (error: any) {
      setMessage(error?.message || "Không chạy được migration classIds.");
    } finally {
      setClassIdsMigrating(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1>Đang tải Data Health...</h1>
      </main>
    );
  }

  const healthLevel = getHealthLevel(data?.summary.totalIssues || 0);

  return (
    <main style={pageStyle}>
      <section style={heroCard}>
        <div>
          <div style={heroKicker}>ADMIN CONSOLE</div>
          <h1 style={heroTitle}>Data Health</h1>

          <p style={heroText}>
            Kiểm tra tình trạng dữ liệu trước khi migrate hoặc phát triển tính
            năng mới.
          </p>

          {user?.email && (
            <p style={heroMeta}>
              Đang đăng nhập: <b>{user.email}</b>
            </p>
          )}
        </div>

        <div style={heroButtonGroup}>
          <button type="button" onClick={loadDataHealth} style={heroButton}>
            Kiểm tra lại
          </button>

          <button
            type="button"
            onClick={loadMigrationPreview}
            disabled={previewLoading}
            style={{
              ...previewButton,
              opacity: previewLoading ? 0.65 : 1,
              cursor: previewLoading ? "not-allowed" : "pointer",
            }}
          >
            {previewLoading ? "Đang preview..." : "Xem trước schoolId"}
          </button>

          <button
            type="button"
            onClick={loadClassIdsMigrationPreview}
            disabled={classIdsPreviewLoading}
            style={{
              ...previewButton,
              opacity: classIdsPreviewLoading ? 0.65 : 1,
              cursor: classIdsPreviewLoading ? "not-allowed" : "pointer",
            }}
          >
            {classIdsPreviewLoading
              ? "Đang preview..."
              : "Xem trước classIds"}
          </button>

          <button
            type="button"
            onClick={loadQuestionCountMigrationPreview}
            disabled={questionCountPreviewLoading}
            style={{
              ...previewButton,
              opacity: questionCountPreviewLoading ? 0.65 : 1,
              cursor: questionCountPreviewLoading ? "not-allowed" : "pointer",
            }}
          >
            {questionCountPreviewLoading
              ? "Đang preview..."
              : "Xem trước questionCount"}
          </button>
          <button
  type="button"
  onClick={loadTestMetadataMigrationPreview}
  disabled={testMetadataPreviewLoading}
  style={{
    ...previewButton,
    opacity: testMetadataPreviewLoading ? 0.65 : 1,
    cursor: testMetadataPreviewLoading ? "not-allowed" : "pointer",
  }}
>
  {testMetadataPreviewLoading
    ? "Đang preview..."
    : "Xem trước test metadata"}
</button>
        </div>
      </section>

      {message && (
        <div
          style={{
            ...messageBox,
            background:
              message.includes("Đang") || message.includes("hoàn tất")
                ? "#dbeafe"
                : "#fee2e2",
            color:
              message.includes("Đang") || message.includes("hoàn tất")
                ? "#1e40af"
                : "#991b1b",
          }}
        >
          {message}
        </div>
      )}

      {!data ? (
        <section style={cardStyle}>
          <h2>Không có dữ liệu</h2>
          <p style={subText}>
            Nếu bạn đã đăng nhập nhưng vẫn lỗi, hãy kiểm tra tài khoản hiện tại
            có role admin trong collection teachers chưa.
          </p>
        </section>
      ) : (
        <>
          <section style={summaryGrid}>
            <div style={summaryCard}>
              <p style={summaryLabel}>Trạng thái</p>
              <div
                style={{
                  ...healthBadge,
                  background: healthLevel.background,
                  color: healthLevel.color,
                }}
              >
                {healthLevel.label}
              </div>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng collection</p>
              <h2 style={summaryNumber}>
                {data.summary.totalCollections}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng document</p>
              <h2 style={summaryNumber}>{data.summary.totalDocuments}</h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng vấn đề</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    data.summary.totalIssues > 0 ? "#991b1b" : "#166534",
                }}
              >
                {data.summary.totalIssues}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Collection cần xem</p>
              <h2 style={summaryNumber}>
                {data.summary.collectionsNeedReview}
              </h2>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Thông tin admin</h2>
                <p style={subText}>
                  Báo cáo tạo lúc: {formatDate(data.generatedAt)}
                </p>
              </div>
            </div>

            <div style={infoGrid}>
              <div style={infoItem}>
                <span style={infoLabel}>Email</span>
                <b>{data.admin.email}</b>
              </div>

              <div style={infoItem}>
                <span style={infoLabel}>Role</span>
                <b>{data.admin.role}</b>
              </div>

              <div style={infoItem}>
                <span style={infoLabel}>School ID</span>
                <b>{data.admin.schoolId}</b>
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Tổng quan theo collection</h2>
                <p style={subText}>
                  Bảng này giúp phát hiện dữ liệu cũ như schoolId rỗng,
                  schoolId default hoặc thiếu createdAt/updatedAt.
                </p>
              </div>
            </div>

            <div style={tableWrap}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadStyle}>
                    <th style={th}>Collection</th>
                    <th style={th}>Tổng</th>
                    <th style={th}>Thiếu schoolId</th>
                    <th style={th}>Rỗng</th>
                    <th style={th}>Default</th>
                    <th style={th}>FPT</th>
                    <th style={th}>Other</th>
                    <th style={th}>Thiếu createdAt</th>
                    <th style={th}>Thiếu updatedAt</th>
                    <th style={th}>Trạng thái</th>
                  </tr>
                </thead>

                <tbody>
                  {data.collections.map((item) => {
                    const status = getCollectionStatus(item);

                    return (
                      <tr key={item.collection}>
                        <td style={td}>
                          <b>{item.collection}</b>
                        </td>
                        <td style={td}>{item.total}</td>
                        <td style={td}>{item.missingSchoolId}</td>
                        <td style={td}>{item.emptySchoolId}</td>
                        <td style={td}>{item.defaultSchoolId}</td>
                        <td style={td}>{item.fptSchoolId}</td>
                        <td style={td}>{item.otherSchoolId}</td>
                        <td style={td}>{item.missingCreatedAt}</td>
                        <td style={td}>{item.missingUpdatedAt}</td>
                        <td style={td}>
                          <span style={status.style}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Chi tiết vấn đề</h2>
                <p style={subText}>
                  Các chỉ số này giúp quyết định migration nào cần làm trước.
                </p>
              </div>
            </div>

            <div style={detailGrid}>
              <DetailCard
                title="Teachers"
                items={[
                  [
                    "Teacher không active",
                    data.details.teachers.inactiveTeachers,
                  ],
                  ["Thiếu role", data.details.teachers.missingRole],
                  ["Thiếu status", data.details.teachers.missingStatus],
                  ["Thiếu uid", data.details.teachers.missingUid],
                ]}
              />

              <DetailCard
                title="Classes"
                items={[
                  [
                    "Thiếu teacherEmail",
                    data.details.classes.missingTeacherEmail,
                  ],
                  ["Thiếu className", data.details.classes.missingClassName],
                  ["Class đã xóa", data.details.classes.deletedClasses],
                  ["Class đang khóa", data.details.classes.lockedClasses],
                  [
                    "Nhóm lớp trùng",
                    data.details.classes.duplicateClassGroups.length,
                  ],
                ]}
              />

              <DetailCard
                title="Students"
                items={[
                  [
                    "Thiếu mã học sinh",
                    data.details.students.missingStudentCode,
                  ],
                  [
                    "Thiếu tên học sinh",
                    data.details.students.missingStudentName,
                  ],
                  ["Thiếu classId", data.details.students.missingClassId],
                  ["Học sinh bị khóa", data.details.students.lockedStudents],
                  [
                    "Nhóm học sinh trùng",
                    data.details.students.duplicateStudentGroups.length,
                  ],
                ]}
              />

              <DetailCard
                title="Tests"
                items={[
                  ["Thiếu teacherEmail", data.details.tests.missingTeacherEmail],
                  ["Thiếu tiêu đề", data.details.tests.missingTitle],
                  [
                    "Thiếu questionCount",
                    data.details.tests.missingQuestionCount,
                  ],
                  ["Thiếu status", data.details.tests.missingStatus],
                  ["Draft", data.details.tests.draftTests],
                  ["Deleted", data.details.tests.deletedTests],
                  [
                    "Có questions embedded",
                    data.details.tests.testsWithEmbeddedQuestions,
                  ],
                  [
                    "Không có questions embedded",
                    data.details.tests.testsWithoutEmbeddedQuestions,
                  ],
                ]}
              />

              <DetailCard
                title="Assignments"
                items={[
                  [
                    "Thiếu assignmentCode",
                    data.details.assignments.missingAssignmentCode,
                  ],
                  ["Thiếu testId", data.details.assignments.missingTestId],
                  [
                    "Thiếu classIds",
                    data.details.assignments.missingClassIds,
                  ],
                  [
                    "Chỉ có classId cũ",
                    data.details.assignments.legacyClassIdOnly,
                  ],
                  [
                    "Không active",
                    data.details.assignments.inactiveAssignments,
                  ],
                  [
                    "Có password cũ nhưng thiếu passwordHash",
                    data.details.assignments.missingPasswordHashButHasPassword,
                  ],
                ]}
              />

              <DetailCard
                title="Results"
                items={[
                  ["Thiếu testId", data.details.results.missingTestId],
                  [
                    "Thiếu assignmentId",
                    data.details.results.missingAssignmentId,
                  ],
                  [
                    "Thiếu assignmentCode",
                    data.details.results.missingAssignmentCode,
                  ],
                  [
                    "Thiếu studentCode",
                    data.details.results.missingStudentCode,
                  ],
                  [
                    "Thiếu teacherEmail",
                    data.details.results.missingTeacherEmail,
                  ],
                  ["Thiếu classId", data.details.results.missingClassId],
                  ["Thiếu score", data.details.results.missingScore],
                  [
                    "Có cảnh báo rời màn hình",
                    data.details.results.resultsWithSuspiciousActivity,
                  ],
                ]}
              />

              <DetailCard
                title="Question Bank"
                items={[
                  [
                    "Thiếu teacherEmail",
                    data.details.questionBank.missingTeacherEmail,
                  ],
                  ["Thiếu question", data.details.questionBank.missingQuestion],
                  ["Thiếu correct", data.details.questionBank.missingCorrect],
                  [
                    "Thiếu visibility",
                    data.details.questionBank.missingVisibility,
                  ],
                  [
                    "Question đã xóa",
                    data.details.questionBank.deletedQuestions,
                  ],
                ]}
              />
            </div>
          </section>

          <SchoolIdMigrationSection
            migrationPreview={migrationPreview}
            migrationResult={migrationResult}
            confirmText={confirmText}
            setConfirmText={setConfirmText}
            previewLoading={previewLoading}
            migrating={migrating}
            loadMigrationPreview={loadMigrationPreview}
            runSchoolIdMigration={runSchoolIdMigration}
          />

          <ClassIdsMigrationSection
            classIdsPreview={classIdsPreview}
            classIdsMigrationResult={classIdsMigrationResult}
            classIdsConfirmText={classIdsConfirmText}
            setClassIdsConfirmText={setClassIdsConfirmText}
            classIdsPreviewLoading={classIdsPreviewLoading}
            classIdsMigrating={classIdsMigrating}
            loadClassIdsMigrationPreview={loadClassIdsMigrationPreview}
            runClassIdsMigration={runClassIdsMigration}
          />

         <QuestionCountPreviewSection
  questionCountPreview={questionCountPreview}
  questionCountMigrationResult={questionCountMigrationResult}
  questionCountConfirmText={questionCountConfirmText}
  setQuestionCountConfirmText={setQuestionCountConfirmText}
  questionCountPreviewLoading={questionCountPreviewLoading}
  questionCountMigrating={questionCountMigrating}
  loadQuestionCountMigrationPreview={loadQuestionCountMigrationPreview}
  runQuestionCountMigration={runQuestionCountMigration}
/>
<TestQuestionMetadataPreviewSection
  testMetadataPreview={testMetadataPreview}
  testMetadataMigrationResult={testMetadataMigrationResult}
  testMetadataConfirmText={testMetadataConfirmText}
  setTestMetadataConfirmText={setTestMetadataConfirmText}
  testMetadataPreviewLoading={testMetadataPreviewLoading}
  testMetadataMigrating={testMetadataMigrating}
  loadTestMetadataMigrationPreview={loadTestMetadataMigrationPreview}
  runTestMetadataMigration={runTestMetadataMigration}
/>

          <section style={cardStyle}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Danh sách issues theo collection</h2>
                <p style={subText}>
                  Những collection không có issue sẽ hiển thị “Không có vấn đề”.
                </p>
              </div>
            </div>

            <div style={issueList}>
              {data.collections.map((collection) => (
                <div key={collection.collection} style={issueCard}>
                  <div style={issueHeader}>
                    <b>{collection.collection}</b>

                    {collection.issues.length > 0 ? (
                      <span style={dangerBadge}>
                        {collection.issues.length} issue
                      </span>
                    ) : (
                      <span style={successBadge}>Ổn</span>
                    )}
                  </div>

                  {collection.issues.length === 0 ? (
                    <p style={subText}>Không có vấn đề.</p>
                  ) : (
                    <ul style={issueUl}>
                      {collection.issues.map((issue, index) => (
                        <li key={`${collection.collection}-${index}`}>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {(data.details.classes.duplicateClassGroups.length > 0 ||
            data.details.students.duplicateStudentGroups.length > 0) && (
            <section style={cardStyle}>
              <div style={sectionHeader}>
                <div>
                  <h2 style={sectionTitle}>Dữ liệu trùng lặp</h2>
                  <p style={subText}>
                    Các nhóm này cần xem lại trước khi migrate dữ liệu.
                  </p>
                </div>
              </div>

              {data.details.classes.duplicateClassGroups.length > 0 && (
                <>
                  <h3>Lớp trùng</h3>

                  <div style={duplicateList}>
                    {data.details.classes.duplicateClassGroups.map((group) => (
                      <div key={group.key} style={duplicateItem}>
                        <b>{group.key}</b>
                        <p style={subText}>Số bản ghi: {group.count}</p>
                        <code style={codeBlock}>
                          {group.classIds.join(", ")}
                        </code>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {data.details.students.duplicateStudentGroups.length > 0 && (
                <>
                  <h3>Học sinh trùng</h3>

                  <div style={duplicateList}>
                    {data.details.students.duplicateStudentGroups.map(
                      (group) => (
                        <div key={group.key} style={duplicateItem}>
                          <b>{group.key}</b>
                          <p style={subText}>Số bản ghi: {group.count}</p>
                          <code style={codeBlock}>
                            {group.studentIds.join(", ")}
                          </code>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function DetailCard({
  title,
  items,
}: {
  title: string;
  items: [string, number][];
}) {
  const total = items.reduce((sum, [, value]) => sum + Number(value || 0), 0);

  return (
    <div style={detailCard}>
      <div style={detailCardHeader}>
        <h3 style={detailCardTitle}>{title}</h3>

        {total > 0 ? (
          <span style={dangerBadge}>{total}</span>
        ) : (
          <span style={successBadge}>Ổn</span>
        )}
      </div>

      <div style={detailRows}>
        {items.map(([label, value]) => (
          <div key={label} style={detailRow}>
            <span>{label}</span>

            <b
              style={{
                color: value > 0 ? "#991b1b" : "#166534",
              }}
            >
              {value}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchoolIdMigrationSection({
  migrationPreview,
  migrationResult,
  confirmText,
  setConfirmText,
  previewLoading,
  migrating,
  loadMigrationPreview,
  runSchoolIdMigration,
}: {
  migrationPreview: MigrationPreviewResponse | null;
  migrationResult: MigrationRunResponse | null;
  confirmText: string;
  setConfirmText: (value: string) => void;
  previewLoading: boolean;
  migrating: boolean;
  loadMigrationPreview: () => void;
  runSchoolIdMigration: () => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionHeader}>
        <div>
          <h2 style={sectionTitle}>SchoolId Migration Preview</h2>
          <p style={subText}>
            Xem trước document có schoolId thiếu, rỗng hoặc default sẽ được đề
            xuất chuyển sang schoolId = fpt. Phần này chưa ghi dữ liệu vào
            Firestore.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMigrationPreview}
          disabled={previewLoading}
          style={{
            ...previewSmallButton,
            opacity: previewLoading ? 0.65 : 1,
            cursor: previewLoading ? "not-allowed" : "pointer",
          }}
        >
          {previewLoading ? "Đang tạo preview..." : "Tạo preview schoolId"}
        </button>
      </div>

      {!migrationPreview ? (
        <div style={emptyPreviewBox}>
          Chưa có migration preview. Bấm “Tạo preview schoolId” để xem dữ liệu
          nào cần chuẩn hóa.
        </div>
      ) : (
        <>
          <div style={migrationSummaryGrid}>
            <div style={summaryCard}>
              <p style={summaryLabel}>Target schoolId</p>
              <h2 style={summaryNumber}>{migrationPreview.targetSchoolId}</h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng cần migrate</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    migrationPreview.summary.totalNeedMigration > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {migrationPreview.summary.totalNeedMigration}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Collection bị ảnh hưởng</p>
              <h2 style={summaryNumber}>
                {migrationPreview.summary.collectionsNeedMigration}
              </h2>
            </div>
          </div>

          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadStyle}>
                  <th style={th}>Collection</th>
                  <th style={th}>Tổng cần migrate</th>
                  <th style={th}>Thiếu schoolId</th>
                  <th style={th}>schoolId rỗng</th>
                  <th style={th}>schoolId default</th>
                  <th style={th}>Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {migrationPreview.previews.map((item) => (
                  <tr key={item.collection}>
                    <td style={td}>
                      <b>{item.collection}</b>
                    </td>
                    <td style={td}>{item.totalNeedMigration}</td>
                    <td style={td}>{item.missingSchoolId}</td>
                    <td style={td}>{item.emptySchoolId}</td>
                    <td style={td}>{item.defaultSchoolId}</td>
                    <td style={td}>
                      {item.totalNeedMigration > 0 ? (
                        <span style={dangerBadge}>Cần migrate</span>
                      ) : (
                        <span style={successBadge}>Không cần</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {migrationPreview.summary.totalNeedMigration > 0 && (
            <div style={migrationRunBox}>
              <div style={sectionHeader}>
                <div>
                  <h2 style={sectionTitle}>Chạy migration schoolId thật</h2>
                  <p style={subText}>
                    Chỉ chạy sau khi đã xem kỹ preview. Migration sẽ cập nhật
                    Firestore thật.
                  </p>
                </div>
              </div>

              <div style={warningBox}>
                <b>Cảnh báo:</b> Thao tác này sẽ sửa dữ liệu thật trong
                Firestore. Không migrate collection teachers ở bước này.
              </div>

              <div style={confirmBox}>
                <label style={confirmLabel}>
                  Nhập chính xác dòng dưới đây để xác nhận:
                </label>

                <code style={confirmCode}>MIGRATE SCHOOLID TO FPT</code>

                <input
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="Nhập dòng xác nhận tại đây"
                  style={confirmInput}
                />

                <button
                  type="button"
                  onClick={runSchoolIdMigration}
                  disabled={
                    migrating ||
                    confirmText.trim() !== "MIGRATE SCHOOLID TO FPT"
                  }
                  style={{
                    ...migrateButton,
                    opacity:
                      migrating ||
                      confirmText.trim() !== "MIGRATE SCHOOLID TO FPT"
                        ? 0.55
                        : 1,
                    cursor:
                      migrating ||
                      confirmText.trim() !== "MIGRATE SCHOOLID TO FPT"
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {migrating ? "Đang migrate..." : "Chạy migration schoolId"}
                </button>
              </div>

              {migrationResult && (
                <div style={migrationResultBox}>
                  <h3>Kết quả migration schoolId</h3>

                  <div style={migrationSummaryGrid}>
                    <div style={summaryCard}>
                      <p style={summaryLabel}>Đã scan</p>
                      <h2 style={summaryNumber}>
                        {migrationResult.summary.totalScanned}
                      </h2>
                    </div>

                    <div style={summaryCard}>
                      <p style={summaryLabel}>Đã migrate</p>
                      <h2 style={{ ...summaryNumber, color: "#166534" }}>
                        {migrationResult.summary.totalMigrated}
                      </h2>
                    </div>

                    <div style={summaryCard}>
                      <p style={summaryLabel}>Đã bỏ qua</p>
                      <h2 style={summaryNumber}>
                        {migrationResult.summary.totalSkipped}
                      </h2>
                    </div>
                  </div>

                  <p style={subText}>
                    Migration chạy lúc: {formatDate(migrationResult.migratedAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ClassIdsMigrationSection({
  classIdsPreview,
  classIdsMigrationResult,
  classIdsConfirmText,
  setClassIdsConfirmText,
  classIdsPreviewLoading,
  classIdsMigrating,
  loadClassIdsMigrationPreview,
  runClassIdsMigration,
}: {
  classIdsPreview: ClassIdsMigrationPreviewResponse | null;
  classIdsMigrationResult: ClassIdsMigrationRunResponse | null;
  classIdsConfirmText: string;
  setClassIdsConfirmText: (value: string) => void;
  classIdsPreviewLoading: boolean;
  classIdsMigrating: boolean;
  loadClassIdsMigrationPreview: () => void;
  runClassIdsMigration: () => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionHeader}>
        <div>
          <h2 style={sectionTitle}>ClassIds Migration Preview</h2>
          <p style={subText}>
            Xem trước các assignment cũ chỉ có classId/className nhưng chưa có
            classIds[]. Phần này chưa ghi dữ liệu vào Firestore.
          </p>
        </div>

        <button
          type="button"
          onClick={loadClassIdsMigrationPreview}
          disabled={classIdsPreviewLoading}
          style={{
            ...previewSmallButton,
            opacity: classIdsPreviewLoading ? 0.65 : 1,
            cursor: classIdsPreviewLoading ? "not-allowed" : "pointer",
          }}
        >
          {classIdsPreviewLoading
            ? "Đang tạo preview..."
            : "Xem trước classIds"}
        </button>
      </div>

      {!classIdsPreview ? (
        <div style={emptyPreviewBox}>
          Chưa có preview classIds. Bấm “Xem trước classIds” để kiểm tra
          assignment cũ cần chuẩn hóa.
        </div>
      ) : (
        <>
          <div style={migrationSummaryGrid}>
            <div style={summaryCard}>
              <p style={summaryLabel}>Collection</p>
              <h2 style={summaryNumber}>
                {classIdsPreview.preview.collection}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng cần migrate</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    classIdsPreview.preview.totalNeedMigration > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {classIdsPreview.preview.totalNeedMigration}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Thiếu classIds</p>
              <h2 style={summaryNumber}>
                {classIdsPreview.preview.missingClassIds}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>classIds rỗng</p>
              <h2 style={summaryNumber}>
                {classIdsPreview.preview.emptyClassIds}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>classIds sai kiểu</p>
              <h2 style={summaryNumber}>
                {classIdsPreview.preview.invalidClassIds}
              </h2>
            </div>
          </div>

          {classIdsPreview.preview.totalNeedMigration === 0 ? (
            <div style={emptyPreviewBox}>
              Không có assignment nào cần migrate classIds.
            </div>
          ) : (
            <>
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadStyle}>
                      <th style={th}>Assignment</th>
                      <th style={th}>Đề</th>
                      <th style={th}>Class cũ</th>
                      <th style={th}>ClassIds mới</th>
                      <th style={th}>Teacher</th>
                      <th style={th}>School</th>
                      <th style={th}>Lý do</th>
                    </tr>
                  </thead>

                  <tbody>
                    {classIdsPreview.preview.samples.map((item) => (
                      <tr key={item.id}>
                        <td style={td}>
                          <b>{item.assignmentCode || "--"}</b>
                          <div style={miniText}>ID: {item.id}</div>
                        </td>

                        <td style={td}>
                          <b>{item.testTitle || "--"}</b>
                          <div style={miniText}>
                            Test ID: {item.testId || "--"}
                          </div>
                        </td>

                        <td style={td}>
                          <b>{item.currentClassName || "--"}</b>
                          <div style={miniText}>{item.currentClassId}</div>
                        </td>

                        <td style={td}>
                          <b>{item.proposedClassNames.join(", ") || "--"}</b>
                          <div style={miniText}>
                            {item.proposedClassIds.join(", ")}
                          </div>
                        </td>

                        <td style={td}>{item.teacherEmail || "--"}</td>
                        <td style={td}>{item.schoolId || "--"}</td>

                        <td style={td}>
                          <span style={dangerBadge}>{item.reason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={noteBox}>
                Preview chỉ hiển thị tối đa 50 sample. Tổng số assignment cần
                migrate là <b>{classIdsPreview.preview.totalNeedMigration}</b>.
              </div>

              <div style={migrationRunBox}>
                <div style={sectionHeader}>
                  <div>
                    <h2 style={sectionTitle}>
                      Chạy migration classIds thật
                    </h2>
                    <p style={subText}>
                      Migration này sẽ thêm classIds[], classNames[] và
                      classCount vào các assignment cũ. Hệ thống vẫn giữ lại
                      classId/className cũ.
                    </p>
                  </div>
                </div>

                <div style={warningBox}>
                  <b>Cảnh báo:</b> Thao tác này sẽ sửa dữ liệu thật trong
                  collection testAssignments. Chỉ chạy sau khi đã xem kỹ
                  preview.
                </div>

                <div style={confirmBox}>
                  <label style={confirmLabel}>
                    Nhập chính xác dòng dưới đây để xác nhận:
                  </label>

                  <code style={confirmCode}>MIGRATE CLASSIDS</code>

                  <input
                    value={classIdsConfirmText}
                    onChange={(event) =>
                      setClassIdsConfirmText(event.target.value)
                    }
                    placeholder="Nhập dòng xác nhận tại đây"
                    style={confirmInput}
                  />

                  <button
                    type="button"
                    onClick={runClassIdsMigration}
                    disabled={
                      classIdsMigrating ||
                      classIdsConfirmText.trim() !== "MIGRATE CLASSIDS"
                    }
                    style={{
                      ...migrateButton,
                      opacity:
                        classIdsMigrating ||
                        classIdsConfirmText.trim() !== "MIGRATE CLASSIDS"
                          ? 0.55
                          : 1,
                      cursor:
                        classIdsMigrating ||
                        classIdsConfirmText.trim() !== "MIGRATE CLASSIDS"
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {classIdsMigrating
                      ? "Đang migrate classIds..."
                      : "Chạy migration classIds thật"}
                  </button>
                </div>

                {classIdsMigrationResult && (
                  <div style={migrationResultBox}>
                    <h3>Kết quả migration classIds</h3>

                    <div style={migrationSummaryGrid}>
                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã scan</p>
                        <h2 style={summaryNumber}>
                          {classIdsMigrationResult.summary.totalScanned}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã migrate</p>
                        <h2 style={{ ...summaryNumber, color: "#166534" }}>
                          {classIdsMigrationResult.summary.totalMigrated}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã bỏ qua</p>
                        <h2 style={summaryNumber}>
                          {classIdsMigrationResult.summary.totalSkipped}
                        </h2>
                      </div>
                    </div>

                    <p style={subText}>
                      Migration chạy lúc:{" "}
                      {formatDate(classIdsMigrationResult.migratedAt)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function QuestionCountPreviewSection({
  questionCountPreview,
  questionCountMigrationResult,
  questionCountConfirmText,
  setQuestionCountConfirmText,
  questionCountPreviewLoading,
  questionCountMigrating,
  loadQuestionCountMigrationPreview,
  runQuestionCountMigration,
}: {
  questionCountPreview: QuestionCountPreviewResponse | null;
  questionCountMigrationResult: QuestionCountMigrationRunResponse | null;
  questionCountConfirmText: string;
  setQuestionCountConfirmText: (value: string) => void;
  questionCountPreviewLoading: boolean;
  questionCountMigrating: boolean;
  loadQuestionCountMigrationPreview: () => void;
  runQuestionCountMigration: () => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionHeader}>
        <div>
          <h2 style={sectionTitle}>QuestionCount Migration Preview</h2>
          <p style={subText}>
            Kiểm tra các đề thiếu questionCount hoặc questionCount bị lệch so
            với số câu thật. Phần preview chưa ghi dữ liệu vào Firestore.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQuestionCountMigrationPreview}
          disabled={questionCountPreviewLoading}
          style={{
            ...previewSmallButton,
            opacity: questionCountPreviewLoading ? 0.65 : 1,
            cursor: questionCountPreviewLoading ? "not-allowed" : "pointer",
          }}
        >
          {questionCountPreviewLoading
            ? "Đang tạo preview..."
            : "Xem trước questionCount"}
        </button>
      </div>

      {!questionCountPreview ? (
        <div style={emptyPreviewBox}>
          Chưa có preview questionCount. Bấm “Xem trước questionCount” để kiểm
          tra các đề cần chuẩn hóa số câu.
        </div>
      ) : (
        <>
          <div style={migrationSummaryGrid}>
            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng số đề</p>
              <h2 style={summaryNumber}>
                {questionCountPreview.summary.totalTests}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng cần migrate</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    questionCountPreview.summary.totalNeedMigration > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {questionCountPreview.summary.totalNeedMigration}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Thiếu questionCount</p>
              <h2 style={summaryNumber}>
                {questionCountPreview.summary.missingQuestionCount}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Sai questionCount</p>
              <h2 style={summaryNumber}>
                {questionCountPreview.summary.mismatchedQuestionCount}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Không hợp lệ</p>
              <h2 style={summaryNumber}>
                {questionCountPreview.summary.invalidQuestionCount}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Chưa có câu hỏi</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    questionCountPreview.summary.testsWithNoQuestions > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {questionCountPreview.summary.testsWithNoQuestions}
              </h2>
            </div>
          </div>

          {questionCountPreview.summary.totalNeedMigration === 0 ? (
            <div style={emptyPreviewBox}>
              Không có đề nào cần migrate questionCount.
            </div>
          ) : (
            <>
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadStyle}>
                      <th style={th}>Đề kiểm tra</th>
                      <th style={th}>Hiện tại</th>
                      <th style={th}>Chuẩn</th>
                      <th style={th}>Embedded</th>
                      <th style={th}>Questions collection</th>
                      <th style={th}>Nguồn</th>
                      <th style={th}>Teacher</th>
                      <th style={th}>School</th>
                      <th style={th}>Lý do</th>
                    </tr>
                  </thead>

                  <tbody>
                    {questionCountPreview.samples.map((item) => (
                      <tr key={item.id}>
                        <td style={td}>
                          <b>{item.title || "--"}</b>
                          <div style={miniText}>ID: {item.id}</div>
                          <div style={miniText}>
                            Status: {item.status || "--"}
                          </div>
                        </td>

                        <td style={td}>
                          {item.currentQuestionCount === null
                            ? "Thiếu"
                            : item.currentQuestionCount}
                        </td>

                        <td style={td}>
                          <b>{item.proposedQuestionCount}</b>
                        </td>

                        <td style={td}>{item.embeddedQuestionCount}</td>
                        <td style={td}>{item.questionCollectionCount}</td>
                        <td style={td}>{item.source || "--"}</td>
                        <td style={td}>{item.teacherEmail || "--"}</td>
                        <td style={td}>{item.schoolId || "--"}</td>

                        <td style={td}>
                          <span style={dangerBadge}>{item.reason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={noteBox}>
                Preview chỉ hiển thị tối đa 80 sample. Tổng số đề cần migrate
                là <b>{questionCountPreview.summary.totalNeedMigration}</b>.
              </div>

              <div style={migrationRunBox}>
                <div style={sectionHeader}>
                  <div>
                    <h2 style={sectionTitle}>
                      Chạy migration questionCount thật
                    </h2>
                    <p style={subText}>
                      Migration này sẽ cập nhật questionCount trong collection
                      tests dựa trên số câu thật.
                    </p>
                  </div>
                </div>

                <div style={warningBox}>
                  <b>Cảnh báo:</b> Thao tác này sẽ sửa dữ liệu thật trong
                  collection tests. Chỉ chạy sau khi đã kiểm tra preview.
                </div>

                <div style={confirmBox}>
                  <label style={confirmLabel}>
                    Nhập chính xác dòng dưới đây để xác nhận:
                  </label>

                  <code style={confirmCode}>MIGRATE QUESTIONCOUNT</code>

                  <input
                    value={questionCountConfirmText}
                    onChange={(event) =>
                      setQuestionCountConfirmText(event.target.value)
                    }
                    placeholder="Nhập dòng xác nhận tại đây"
                    style={confirmInput}
                  />

                  <button
                    type="button"
                    onClick={runQuestionCountMigration}
                    disabled={
                      questionCountMigrating ||
                      questionCountConfirmText.trim() !==
                        "MIGRATE QUESTIONCOUNT"
                    }
                    style={{
                      ...migrateButton,
                      opacity:
                        questionCountMigrating ||
                        questionCountConfirmText.trim() !==
                          "MIGRATE QUESTIONCOUNT"
                          ? 0.55
                          : 1,
                      cursor:
                        questionCountMigrating ||
                        questionCountConfirmText.trim() !==
                          "MIGRATE QUESTIONCOUNT"
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {questionCountMigrating
                      ? "Đang migrate questionCount..."
                      : "Chạy migration questionCount thật"}
                  </button>
                </div>

                {questionCountMigrationResult && (
                  <div style={migrationResultBox}>
                    <h3>Kết quả migration questionCount</h3>

                    <div style={migrationSummaryGrid}>
                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã scan</p>
                        <h2 style={summaryNumber}>
                          {questionCountMigrationResult.summary.totalScanned}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã migrate</p>
                        <h2 style={{ ...summaryNumber, color: "#166534" }}>
                          {questionCountMigrationResult.summary.totalMigrated}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã bỏ qua</p>
                        <h2 style={summaryNumber}>
                          {questionCountMigrationResult.summary.totalSkipped}
                        </h2>
                      </div>
                    </div>

                    <p style={subText}>
                      Migration chạy lúc:{" "}
                      {formatDate(questionCountMigrationResult.migratedAt)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function TestQuestionMetadataPreviewSection({
  testMetadataPreview,
  testMetadataMigrationResult,
  testMetadataConfirmText,
  setTestMetadataConfirmText,
  testMetadataPreviewLoading,
  testMetadataMigrating,
  loadTestMetadataMigrationPreview,
  runTestMetadataMigration,
}: {
  testMetadataPreview: TestQuestionMetadataPreviewResponse | null;
  testMetadataMigrationResult: TestQuestionMetadataMigrationRunResponse | null;
  testMetadataConfirmText: string;
  setTestMetadataConfirmText: (value: string) => void;
  testMetadataPreviewLoading: boolean;
  testMetadataMigrating: boolean;
  loadTestMetadataMigrationPreview: () => void;
  runTestMetadataMigration: () => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionHeader}>
        <div>
          <h2 style={sectionTitle}>Test Question Metadata Migration Preview</h2>

          <p style={subText}>
            Kiểm tra các đề cũ có câu hỏi embedded nhưng thiếu metadata như
            knowledgeUnit, skill, learningOutcome, cognitiveLevel. Migration sẽ
            đối chiếu bankQuestionId với questionBank để bổ sung metadata.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTestMetadataMigrationPreview}
          disabled={testMetadataPreviewLoading}
          style={{
            ...previewSmallButton,
            opacity: testMetadataPreviewLoading ? 0.65 : 1,
            cursor: testMetadataPreviewLoading ? "not-allowed" : "pointer",
          }}
        >
          {testMetadataPreviewLoading
            ? "Đang tạo preview..."
            : "Xem trước test metadata"}
        </button>
      </div>

      {!testMetadataPreview ? (
        <div style={emptyPreviewBox}>
          Chưa có preview test metadata. Bấm “Xem trước test metadata” để kiểm
          tra các đề cũ thiếu metadata câu hỏi.
        </div>
      ) : (
        <>
          <div style={migrationSummaryGrid}>
            <div style={summaryCard}>
              <p style={summaryLabel}>Tổng số đề</p>
              <h2 style={summaryNumber}>
                {testMetadataPreview.summary.totalTests}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Đề có embedded questions</p>
              <h2 style={summaryNumber}>
                {testMetadataPreview.summary.testsWithEmbeddedQuestions}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Đề cần migrate</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    testMetadataPreview.summary.testsNeedMigration > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {testMetadataPreview.summary.testsNeedMigration}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Câu thiếu metadata</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    testMetadataPreview.summary.questionsMissingMetadata > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {testMetadataPreview.summary.questionsMissingMetadata}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Có thể cập nhật từ bank</p>
              <h2 style={{ ...summaryNumber, color: "#166534" }}>
                {testMetadataPreview.summary.questionsCanUpdateFromBank}
              </h2>
            </div>

            <div style={summaryCard}>
              <p style={summaryLabel}>Không thể tự cập nhật</p>
              <h2
                style={{
                  ...summaryNumber,
                  color:
                    testMetadataPreview.summary.questionsCannotUpdate > 0
                      ? "#991b1b"
                      : "#166534",
                }}
              >
                {testMetadataPreview.summary.questionsCannotUpdate}
              </h2>
            </div>
          </div>

          {testMetadataPreview.summary.questionsCanUpdateFromBank === 0 ? (
            <div style={emptyPreviewBox}>
              Không có câu hỏi nào có thể tự cập nhật metadata từ questionBank.
            </div>
          ) : (
            <>
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadStyle}>
                      <th style={th}>Đề kiểm tra</th>
                      <th style={th}>Môn/Khối</th>
                      <th style={th}>Tổng câu</th>
                      <th style={th}>Thiếu metadata</th>
                      <th style={th}>Có thể cập nhật</th>
                      <th style={th}>Không thể cập nhật</th>
                      <th style={th}>Teacher</th>
                      <th style={th}>School</th>
                      <th style={th}>Nguồn</th>
                    </tr>
                  </thead>

                  <tbody>
                    {testMetadataPreview.samples.map((item) => (
                      <tr key={item.id}>
                        <td style={td}>
                          <b>{item.title || "--"}</b>
                          <div style={miniText}>ID: {item.id}</div>
                          <div style={miniText}>
                            Status: {item.status || "--"}
                          </div>
                        </td>

                        <td style={td}>
                          {item.subject || "--"} / Khối {item.grade || "--"}
                        </td>

                        <td style={td}>{item.questionCount}</td>

                        <td style={td}>
                          <span style={dangerBadge}>
                            {item.missingMetadataCount}
                          </span>
                        </td>

                        <td style={td}>
                          <span style={successBadge}>
                            {item.canUpdateFromBankCount}
                          </span>
                        </td>

                        <td style={td}>
                          {item.cannotUpdateCount > 0 ? (
                            <span style={dangerBadge}>
                              {item.cannotUpdateCount}
                            </span>
                          ) : (
                            <span style={successBadge}>0</span>
                          )}
                        </td>

                        <td style={td}>{item.teacherEmail || "--"}</td>
                        <td style={td}>{item.schoolId || "--"}</td>
                        <td style={td}>{item.source || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={noteBox}>
                Preview chỉ hiển thị tối đa 80 sample. Migration chỉ cập nhật
                câu hỏi có bankQuestionId và tìm được metadata trong questionBank.
              </div>

              <div style={migrationRunBox}>
                <div style={sectionHeader}>
                  <div>
                    <h2 style={sectionTitle}>
                      Chạy migration test metadata thật
                    </h2>

                    <p style={subText}>
                      Migration này sẽ cập nhật metadata trong tests.questions[]
                      cho các đề cũ tạo từ ngân hàng câu hỏi.
                    </p>
                  </div>
                </div>

                <div style={warningBox}>
                  <b>Cảnh báo:</b> Thao tác này sẽ sửa dữ liệu thật trong
                  collection tests. Chỉ chạy sau khi đã kiểm tra preview.
                </div>

                <div style={confirmBox}>
                  <label style={confirmLabel}>
                    Nhập chính xác dòng dưới đây để xác nhận:
                  </label>

                  <code style={confirmCode}>
                    MIGRATE TEST QUESTION METADATA
                  </code>

                  <input
                    value={testMetadataConfirmText}
                    onChange={(event) =>
                      setTestMetadataConfirmText(event.target.value)
                    }
                    placeholder="Nhập dòng xác nhận tại đây"
                    style={confirmInput}
                  />

                  <button
                    type="button"
                    onClick={runTestMetadataMigration}
                    disabled={
                      testMetadataMigrating ||
                      testMetadataConfirmText.trim() !==
                        "MIGRATE TEST QUESTION METADATA"
                    }
                    style={{
                      ...migrateButton,
                      opacity:
                        testMetadataMigrating ||
                        testMetadataConfirmText.trim() !==
                          "MIGRATE TEST QUESTION METADATA"
                          ? 0.55
                          : 1,
                      cursor:
                        testMetadataMigrating ||
                        testMetadataConfirmText.trim() !==
                          "MIGRATE TEST QUESTION METADATA"
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {testMetadataMigrating
                      ? "Đang migrate metadata..."
                      : "Chạy migration test metadata thật"}
                  </button>
                </div>

                {testMetadataMigrationResult && (
                  <div style={migrationResultBox}>
                    <h3>Kết quả migration test metadata</h3>

                    <div style={migrationSummaryGrid}>
                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã scan</p>
                        <h2 style={summaryNumber}>
                          {testMetadataMigrationResult.summary.totalScanned}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Đã migrate đề</p>
                        <h2 style={{ ...summaryNumber, color: "#166534" }}>
                          {testMetadataMigrationResult.summary.totalMigrated}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Câu đã cập nhật</p>
                        <h2 style={{ ...summaryNumber, color: "#166534" }}>
                          {testMetadataMigrationResult.summary.updatedQuestions}
                        </h2>
                      </div>

                      <div style={summaryCard}>
                        <p style={summaryLabel}>Không cập nhật được</p>
                        <h2
                          style={{
                            ...summaryNumber,
                            color:
                              testMetadataMigrationResult.summary
                                .cannotUpdateQuestions > 0
                                ? "#991b1b"
                                : "#166534",
                          }}
                        >
                          {
                            testMetadataMigrationResult.summary
                              .cannotUpdateQuestions
                          }
                        </h2>
                      </div>
                    </div>

                    <p style={subText}>
                      Migration chạy lúc:{" "}
                      {formatDate(testMetadataMigrationResult.migratedAt)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

const pageStyle: CSSProperties = {
  fontFamily: "Arial, sans-serif",
  color: "#111827",
};

const heroCard: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1d4ed8)",
  color: "white",
  borderRadius: 24,
  padding: "32px 36px",
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 24,
  boxShadow: "0 14px 34px rgba(30,64,175,.18)",
  flexWrap: "wrap",
};

const heroKicker: CSSProperties = {
  color: "#bfdbfe",
  fontWeight: 900,
  marginBottom: 10,
};

const heroTitle: CSSProperties = {
  fontSize: 34,
  margin: 0,
  fontWeight: 900,
};

const heroText: CSSProperties = {
  color: "#dbeafe",
  fontSize: 17,
  marginTop: 14,
  marginBottom: 0,
  lineHeight: 1.6,
};

const heroMeta: CSSProperties = {
  color: "#bfdbfe",
  marginTop: 14,
  marginBottom: 0,
};

const heroButtonGroup: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const heroButton: CSSProperties = {
  border: "none",
  borderRadius: 16,
  background: "#22c55e",
  color: "white",
  padding: "16px 26px",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const previewButton: CSSProperties = {
  border: "none",
  borderRadius: 16,
  background: "#f59e0b",
  color: "white",
  padding: "16px 26px",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const previewSmallButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  background: "#f59e0b",
  color: "white",
  padding: "13px 18px",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

const messageBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  marginBottom: 18,
  fontWeight: 900,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 18,
  marginBottom: 24,
};

const summaryCard: CSSProperties = {
  background: "white",
  padding: 22,
  borderRadius: 22,
  boxShadow: "0 10px 28px rgba(15,23,42,.07)",
};

const summaryLabel: CSSProperties = {
  color: "#64748b",
  fontWeight: 900,
  margin: 0,
};

const summaryNumber: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 34,
  fontWeight: 900,
  color: "#2563eb",
};

const healthBadge: CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: 900,
  marginTop: 12,
};

const cardStyle: CSSProperties = {
  background: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 24,
  boxShadow: "0 10px 28px rgba(15,23,42,.07)",
  overflow: "hidden",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  marginBottom: 18,
};

const sectionTitle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 26,
  fontWeight: 900,
};

const subText: CSSProperties = {
  color: "#64748b",
  lineHeight: 1.6,
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const infoItem: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const infoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1050,
};

const theadStyle: CSSProperties = {
  background: "#f1f5f9",
};

const th: CSSProperties = {
  padding: 12,
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  color: "#334155",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};

const successBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const dangerBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const detailGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
};

const detailCard: CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
};

const detailCardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const detailCardTitle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
};

const detailRows: CSSProperties = {
  display: "grid",
  gap: 8,
};

const detailRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: 8,
};

const emptyPreviewBox: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  fontWeight: 700,
};

const migrationSummaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 22,
};

const migrationRunBox: CSSProperties = {
  marginTop: 28,
  padding: 22,
  borderRadius: 20,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
};

const warningBox: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 700,
  marginBottom: 18,
  lineHeight: 1.6,
};

const confirmBox: CSSProperties = {
  display: "grid",
  gap: 12,
};

const confirmLabel: CSSProperties = {
  fontWeight: 900,
  color: "#334155",
};

const confirmCode: CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  background: "#0f172a",
  color: "#e5e7eb",
  fontWeight: 900,
  width: "fit-content",
};

const confirmInput: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  boxSizing: "border-box",
};

const migrateButton: CSSProperties = {
  width: "fit-content",
  border: "none",
  borderRadius: 14,
  background: "#dc2626",
  color: "white",
  padding: "14px 20px",
  fontWeight: 900,
  fontSize: 16,
};

const migrationResultBox: CSSProperties = {
  marginTop: 24,
  padding: 18,
  borderRadius: 18,
  background: "white",
  border: "1px solid #e5e7eb",
};

const miniText: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 4,
  wordBreak: "break-word",
};

const noteBox: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: "#eff6ff",
  color: "#1e40af",
  fontWeight: 700,
  lineHeight: 1.6,
};

const issueList: CSSProperties = {
  display: "grid",
  gap: 14,
};

const issueCard: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
};

const issueHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 10,
};

const issueUl: CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  color: "#334155",
  lineHeight: 1.7,
};

const duplicateList: CSSProperties = {
  display: "grid",
  gap: 12,
  marginBottom: 20,
};

const duplicateItem: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
};

const codeBlock: CSSProperties = {
  display: "block",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "#0f172a",
  color: "#e5e7eb",
  padding: 12,
  borderRadius: 12,
};