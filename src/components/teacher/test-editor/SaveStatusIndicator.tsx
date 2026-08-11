import type { CSSProperties } from "react";

import type {
  TestSaveStatus,
} from "@/types/test-draft";

type Props = {
  status: TestSaveStatus;
  isDirty: boolean;
  lastSavedAt: string | null;
};

export default function SaveStatusIndicator({
  status,
  isDirty,
  lastSavedAt,
}: Props) {
  const label = getStatusLabel(
    status,
    isDirty
  );

  return (
    <div style={containerStyle}>
      <span
        aria-hidden="true"
        style={{
          ...dotStyle,
          background: getStatusColor(
            status,
            isDirty
          ),
        }}
      />

      <span>{label}</span>

      {lastSavedAt &&
        status !== "saving" &&
        !isDirty && (
          <span style={timeStyle}>
            {formatSavedTime(lastSavedAt)}
          </span>
        )}
    </div>
  );
}

function getStatusLabel(
  status: TestSaveStatus,
  isDirty: boolean
): string {
  if (status === "saving") {
    return "Đang lưu...";
  }

  if (status === "error") {
    return "Lưu thất bại";
  }

  if (isDirty) {
    return "Có thay đổi chưa lưu";
  }

  if (status === "saved") {
    return "Đã lưu";
  }

  return "Chưa có thay đổi";
}

function getStatusColor(
  status: TestSaveStatus,
  isDirty: boolean
): string {
  if (status === "saving") {
    return "#f59e0b";
  }

  if (status === "error") {
    return "#dc2626";
  }

  if (isDirty) {
    return "#f97316";
  }

  if (status === "saved") {
    return "#16a34a";
  }

  return "#94a3b8";
}

function formatSavedTime(
  value: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const containerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
};

const dotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
};

const timeStyle: CSSProperties = {
  color: "#94a3b8",
  fontWeight: 600,
};