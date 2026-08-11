import {
  safeString,
  safeUpper,
} from "@/features/exam/utils";

export type AttemptStatus =
  | "in_progress"
  | "expired"
  | "submitted";

export type ValidateAttemptAccessInput = {
  attemptId: string;
  studentId: string;
  studentCode: string;
  attempt: Record<string, unknown>;
};

export type ValidatedAttemptAccess = {
  attemptId: string;
  assignmentId: string;
  status: AttemptStatus;
  resultId: string;
  alreadySubmitted: boolean;
};

export class AttemptAccessError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name = "AttemptAccessError";
    this.statusCode = statusCode;
  }
}

function normalizeAttemptStatus(
  value: unknown
): AttemptStatus | "" {
  const status = safeString(value);

  if (
    status === "in_progress" ||
    status === "expired" ||
    status === "submitted"
  ) {
    return status;
  }

  return "";
}

export function validateAttemptIdentity(
  attempt: Record<string, unknown>,
  studentId: string,
  studentCode: string
): void {
  const normalizedStudentId =
    safeString(studentId);

  const normalizedStudentCode =
    safeUpper(studentCode);

  if (
    !normalizedStudentId ||
    !normalizedStudentCode
  ) {
    throw new AttemptAccessError(
      "Thiếu thông tin học sinh.",
      400
    );
  }

  const attemptStudentId =
    safeString(
      attempt.studentId
    );

  const attemptStudentCode =
    safeUpper(
      attempt.studentCode
    );

  if (
    attemptStudentId !==
      normalizedStudentId ||
    attemptStudentCode !==
      normalizedStudentCode
  ) {
    throw new AttemptAccessError(
      "Thông tin học sinh không khớp với phiên làm bài.",
      403
    );
  }
}

export function validateAttemptStatus(
  attempt: Record<string, unknown>
): {
  status: AttemptStatus;
  resultId: string;
  alreadySubmitted: boolean;
} {
  const status =
    normalizeAttemptStatus(
      attempt.status
    );

  const resultId =
    safeString(
      attempt.resultId
    );

  if (
    status === "submitted" &&
    resultId
  ) {
    return {
      status,
      resultId,
      alreadySubmitted: true,
    };
  }

  if (
    status !== "in_progress" &&
    status !== "expired"
  ) {
    throw new AttemptAccessError(
      "Phiên làm bài này không thể nộp.",
      409
    );
  }

  return {
    status,
    resultId,
    alreadySubmitted: false,
  };
}

export function resolveAttemptAssignmentId(
  attempt: Record<string, unknown>
): string {
  const assignmentId =
    safeString(
      attempt.assignmentId
    );

  if (!assignmentId) {
    throw new AttemptAccessError(
      "Phiên làm bài thiếu assignmentId.",
      500
    );
  }

  return assignmentId;
}

export function validateAttemptAccess({
  attemptId,
  studentId,
  studentCode,
  attempt,
}: ValidateAttemptAccessInput): ValidatedAttemptAccess {
  const normalizedAttemptId =
    safeString(attemptId);

  if (!normalizedAttemptId) {
    throw new AttemptAccessError(
      "Thiếu mã phiên làm bài.",
      400
    );
  }

  validateAttemptIdentity(
    attempt,
    studentId,
    studentCode
  );

  const statusResult =
    validateAttemptStatus(
      attempt
    );

  const assignmentId =
    resolveAttemptAssignmentId(
      attempt
    );

  return {
    attemptId:
      normalizedAttemptId,

    assignmentId,

    status:
      statusResult.status,

    resultId:
      statusResult.resultId,

    alreadySubmitted:
      statusResult.alreadySubmitted,
  };
}

export function validateLatestAttemptForSubmit(
  attempt: Record<string, unknown>
): void {
  const status =
    normalizeAttemptStatus(
      attempt.status
    );

  if (
    status === "submitted" &&
    safeString(
      attempt.resultId
    )
  ) {
    return;
  }

  if (
    status !== "in_progress" &&
    status !== "expired"
  ) {
    throw new AttemptAccessError(
      "Phiên làm bài này không thể nộp.",
      409
    );
  }
}