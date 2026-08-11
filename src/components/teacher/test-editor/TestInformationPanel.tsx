import type { CSSProperties } from "react";

import {
  TEACHER_SUBJECTS,
} from "@/features/teacher-settings/constants";

import type {
  TestDraft,
  TestStructureMode,
} from "@/types/test-draft";

type Props = {
  draft: TestDraft;
  onChange: (draft: TestDraft) => void;
};

const OTHER_SUBJECT = "Khác";

function getSubjectOption(value: string): string {
  return TEACHER_SUBJECTS.includes(
    value as (typeof TEACHER_SUBJECTS)[number]
  )
    ? value
    : OTHER_SUBJECT;
}

export default function TestInformationPanel({
  draft,
  onChange,
}: Props) {
  function updateField<K extends keyof TestDraft>(
    field: K,
    value: TestDraft[K]
  ) {
    onChange({
      ...draft,
      [field]: value,
    });
  }

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>
            Thông tin đề kiểm tra
          </h2>

          <p style={descriptionStyle}>
            Nhập các thông tin cơ bản trước khi biên soạn đề.
          </p>
        </div>
      </div>

      <div style={gridStyle}>
        <div style={fullWidthStyle}>
          <label
            htmlFor="test-title"
            style={labelStyle}
          >
            Tên đề kiểm tra
          </label>

          <input
            id="test-title"
            type="text"
            value={draft.title}
            onChange={(event) =>
              updateField(
                "title",
                event.target.value
              )
            }
            placeholder="Ví dụ: Kiểm tra giữa học kỳ I"
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="test-subject"
            style={labelStyle}
          >
            Môn học
          </label>

          <select
            id="test-subject"
            value={getSubjectOption(
              draft.subject
            )}
            onChange={(event) =>
              updateField(
                "subject",
                event.target.value
              )
            }
            style={inputStyle}
          >
            {TEACHER_SUBJECTS.map(
              (subject) => (
                <option
                  key={subject}
                  value={subject}
                >
                  {subject}
                </option>
              )
            )}
          </select>

          {getSubjectOption(
            draft.subject
          ) === OTHER_SUBJECT ? (
            <input
              type="text"
              value={
                draft.subject === OTHER_SUBJECT
                  ? ""
                  : draft.subject
              }
              onChange={(event) =>
                updateField(
                  "subject",
                  event.target.value
                )
              }
              placeholder="Nhập tên môn học"
              style={{
                ...inputStyle,
                marginTop: 8,
              }}
            />
          ) : null}
        </div>

        <div>
          <label
            htmlFor="test-grade"
            style={labelStyle}
          >
            Khối lớp
          </label>

          <select
            id="test-grade"
            value={draft.grade}
            onChange={(event) =>
              updateField(
                "grade",
                event.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              Chọn khối lớp
            </option>

            <option value="6">Lớp 6</option>
            <option value="7">Lớp 7</option>
            <option value="8">Lớp 8</option>
            <option value="9">Lớp 9</option>
            <option value="10">Lớp 10</option>
            <option value="11">Lớp 11</option>
            <option value="12">Lớp 12</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="test-duration"
            style={labelStyle}
          >
            Thời gian làm bài
          </label>

          <input
            id="test-duration"
            type="number"
            min={1}
            step={1}
            value={draft.durationMinutes}
            onChange={(event) => {
              const value = Number(
                event.target.value
              );

              updateField(
                "durationMinutes",
                Number.isFinite(value)
                  ? Math.max(1, value)
                  : 1
              );
            }}
            style={inputStyle}
          />
        </div>

        <div>
          <label
            htmlFor="test-structure-mode"
            style={labelStyle}
          >
            Cấu trúc đề
          </label>

          <select
            id="test-structure-mode"
            value={draft.structureMode}
            onChange={(event) =>
              updateField(
                "structureMode",
                event.target
                  .value as TestStructureMode
              )
            }
            style={inputStyle}
          >
            <option value="gdpt_2018">
              Chuẩn GDPT 2018
            </option>

            <option value="custom">
              Tùy chỉnh
            </option>
          </select>
        </div>

        <div style={fullWidthStyle}>
          <label
            htmlFor="test-description"
            style={labelStyle}
          >
            Mô tả
          </label>

          <textarea
            id="test-description"
            value={draft.description}
            onChange={(event) =>
              updateField(
                "description",
                event.target.value
              )
            }
            placeholder="Mô tả mục tiêu hoặc phạm vi của đề kiểm tra"
            style={textareaStyle}
          />
        </div>

        <div style={fullWidthStyle}>
          <label
            htmlFor="test-instructions"
            style={labelStyle}
          >
            Hướng dẫn làm bài
          </label>

          <textarea
            id="test-instructions"
            value={draft.instructions}
            onChange={(event) =>
              updateField(
                "instructions",
                event.target.value
              )
            }
            placeholder="Nhập hướng dẫn dành cho học sinh"
            style={textareaStyle}
          />
        </div>
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  padding: 22,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  boxShadow:
    "0 8px 20px rgba(15,23,42,.05)",
};

const headerStyle: CSSProperties = {
  marginBottom: 18,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 21,
  fontWeight: 900,
};

const descriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  lineHeight: 1.6,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const fullWidthStyle: CSSProperties = {
  gridColumn: "1 / -1",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#334155",
  fontWeight: 900,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  fontSize: 15,
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  resize: "vertical",
  fontSize: 15,
  lineHeight: 1.6,
  boxSizing: "border-box",
};