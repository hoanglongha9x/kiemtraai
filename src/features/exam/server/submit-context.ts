import type {
  DocumentReference,
  Firestore,
} from "firebase-admin/firestore";

import {
  asRecord,
} from "@/features/exam/utils";

import {
  validateAttemptAccess,
  type ValidatedAttemptAccess,
} from "./attempt-access";

export type LoadSubmitContextInput = {
  db: Firestore;

  attemptId: string;
  studentId: string;
  studentCode: string;
};

export type SubmitContext = {
  attemptId: string;
  assignmentId: string;

  attemptRef:
    DocumentReference;

  attemptAccess:
    ValidatedAttemptAccess;

  attempt:
    Record<string, unknown>;

  assignment:
    Record<string, unknown>;

  student:
    Record<string, unknown>;
};

export class SubmitContextError
  extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name =
      "SubmitContextError";

    this.statusCode =
      statusCode;
  }
}

export async function loadSubmitContext({
  db,
  attemptId,
  studentId,
  studentCode,
}: LoadSubmitContextInput): Promise<SubmitContext> {
  const attemptRef =
    db
      .collection(
        "examAttempts"
      )
      .doc(attemptId);

  const attemptDoc =
    await attemptRef.get();

  if (!attemptDoc.exists) {
    throw new SubmitContextError(
      "Không tìm thấy phiên làm bài.",
      404
    );
  }

  const attempt =
    asRecord(
      attemptDoc.data()
    );

  const attemptAccess =
    validateAttemptAccess({
      attemptId,
      studentId,
      studentCode,
      attempt,
    });

  const assignmentId =
    attemptAccess
      .assignmentId;

  const [
    newAssignmentDoc,
    legacyAssignmentDoc,
    studentDoc,
  ] = await Promise.all([
    db
      .collection(
        "assignments"
      )
      .doc(assignmentId)
      .get(),

    db
      .collection(
        "testAssignments"
      )
      .doc(assignmentId)
      .get(),

    db
      .collection(
        "students"
      )
      .doc(studentId)
      .get(),
  ]);

  const assignmentDoc =
    newAssignmentDoc.exists
      ? newAssignmentDoc
      : legacyAssignmentDoc;

  if (!assignmentDoc.exists) {
    throw new SubmitContextError(
      "Không tìm thấy bài kiểm tra được giao.",
      404
    );
  }

  if (!studentDoc.exists) {
    throw new SubmitContextError(
      "Không tìm thấy học sinh.",
      404
    );
  }

  const assignment =
    asRecord(
      assignmentDoc.data()
    );

  const student =
    asRecord(
      studentDoc.data()
    );

  return {
    attemptId,
    assignmentId,

    attemptRef,

    attemptAccess,

    attempt,

    assignment,

    student,
  };
}