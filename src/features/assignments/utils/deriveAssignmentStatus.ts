import type {
  AssignmentStatus,
} from "../types";

type DeriveAssignmentStatusInput = {
  startTime?: string;

  endTime?: string;

  currentStatus?:
    AssignmentStatus;

  now?: Date | string;
};

function parseDate(
  value:
    string | undefined
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

export function deriveAssignmentStatus({
  startTime,
  endTime,
  currentStatus,
  now = new Date(),
}: DeriveAssignmentStatusInput): AssignmentStatus {
  if (
    currentStatus ===
      "locked" ||
    currentStatus ===
      "archived"
  ) {
    return currentStatus;
  }

  const currentDate =
    now instanceof Date
      ? now
      : new Date(now);

  const safeCurrentDate =
    Number.isNaN(
      currentDate.getTime()
    )
      ? new Date()
      : currentDate;

  const startDate =
    parseDate(startTime);

  const endDate =
    parseDate(endTime);

  if (
    startDate &&
    safeCurrentDate <
      startDate
  ) {
    return "scheduled";
  }

  if (
    endDate &&
    safeCurrentDate >=
      endDate
  ) {
    return "closed";
  }

  return "active";
}