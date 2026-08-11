"use client";

import type { CSSProperties } from "react";

export type TestQuestionMetadataPreviewItem = {
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

export type TestQuestionMetadataPreviewResponse = {
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

export type TestQuestionMetadataMigrationRunResponse = {
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

function formatDate(value?: string) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("vi-VN");
}

export default function TestQuestionMetadataMigrationSection({
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
          <h2 style={sectionTitle}>Test Question Metadata Migration</h2>

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
            <SummaryCard
              label="Tổng số đề"
              value={testMetadataPreview.summary.totalTests}
            />

            <SummaryCard
              label="Đề có embedded questions"
              value={testMetadataPreview.summary.testsWithEmbeddedQuestions}
            />

            <SummaryCard
              label="Đề cần migrate"
              value={testMetadataPreview.summary.testsNeedMigration}
              danger={testMetadataPreview.summary.testsNeedMigration > 0}
            />

            <SummaryCard
              label="Câu thiếu metadata"
              value={testMetadataPreview.summary.questionsMissingMetadata}
              danger={testMetadataPreview.summary.questionsMissingMetadata > 0}
            />

            <SummaryCard
              label="Có thể cập nhật từ bank"
              value={testMetadataPreview.summary.questionsCanUpdateFromBank}
              success
            />

            <SummaryCard
              label="Không thể tự cập nhật"
              value={testMetadataPreview.summary.questionsCannotUpdate}
              danger={testMetadataPreview.summary.questionsCannotUpdate > 0}
            />
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
                      <SummaryCard
                        label="Đã scan"
                        value={testMetadataMigrationResult.summary.totalScanned}
                      />

                      <SummaryCard
                        label="Đã migrate đề"
                        value={
                          testMetadataMigrationResult.summary.totalMigrated
                        }
                        success
                      />

                      <SummaryCard
                        label="Câu đã cập nhật"
                        value={
                          testMetadataMigrationResult.summary.updatedQuestions
                        }
                        success
                      />

                      <SummaryCard
                        label="Không cập nhật được"
                        value={
                          testMetadataMigrationResult.summary
                            .cannotUpdateQuestions
                        }
                        danger={
                          testMetadataMigrationResult.summary
                            .cannotUpdateQuestions > 0
                        }
                      />
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

function SummaryCard({
  label,
  value,
  danger,
  success,
}: {
  label: string;
  value: number | string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div style={summaryCard}>
      <p style={summaryLabel}>{label}</p>

      <h2
        style={{
          ...summaryNumber,
          color: danger ? "#991b1b" : success ? "#166534" : "#2563eb",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

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

const miniText: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 4,
  wordBreak: "break-word",
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

const noteBox: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: "#eff6ff",
  color: "#1e40af",
  fontWeight: 700,
  lineHeight: 1.6,
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