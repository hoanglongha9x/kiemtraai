import type { Firestore } from "firebase-admin/firestore";

import { asRecord, safeString, safeUpper } from "@/features/exam/utils";
import {
  resolveAttemptAssignmentId,
  validateAttemptIdentity,
  validateLatestAttemptForSubmit,
} from "./attempt-access";
import { buildSubmittedAttemptPayload } from "./attempt-payload";
import { resolveAssignmentSettings } from "./assignment-settings";
import { prepareSubmit } from "./prepare-submit";
import { buildResultPayload } from "./result-payload";
import type { SubmitTransactionResult } from "./submit-types";

export type SubmitTransactionInput = {
  db: Firestore;
  attemptId: string;
  studentId: string;
  studentCode: string;
  requestAnswers: unknown;
  requestAntiCheat: unknown;
  submittedAt: Date;
  autoSubmit: boolean;
};

export class SubmitTransactionError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "SubmitTransactionError";
    this.statusCode = statusCode;
  }
}

function assertResultBelongsToAttempt(
  result: Record<string, unknown>,
  attempt: Record<string, unknown>,
  attemptId: string,
): void {
  // Older results can lack these fields. Never repair them on submit, and
  // never return a result whose recorded identity contradicts the attempt.
  for (const [key, expected] of [
    ["attemptId", attemptId],
    ["assignmentId", safeString(attempt.assignmentId)],
    ["studentId", safeString(attempt.studentId)],
    ["studentCode", safeUpper(attempt.studentCode)],
  ]) {
    const actual = key === "studentCode" ? safeUpper(result[key]) : safeString(result[key]);
    if (actual && actual !== expected) {
      throw new SubmitTransactionError("Kết quả không khớp với phiên làm bài. Cần kiểm tra dữ liệu.", 409);
    }
  }
}

export async function runSubmitTransaction({
  db,
  attemptId,
  studentId,
  studentCode,
  requestAnswers,
  requestAntiCheat,
  submittedAt,
  autoSubmit,
}: SubmitTransactionInput): Promise<SubmitTransactionResult> {
  const attemptRef = db.collection("examAttempts").doc(attemptId);
  const canonicalResultRef = db.collection("results").doc(attemptId);

  return db.runTransaction(async (transaction) => {
    const attemptDoc = await transaction.get(attemptRef);
    if (!attemptDoc.exists) {
      throw new SubmitTransactionError("Không tìm thấy phiên làm bài.", 404);
    }
    const attempt = asRecord(attemptDoc.data());
    validateAttemptIdentity(attempt, studentId, studentCode);
    const assignmentId = resolveAttemptAssignmentId(attempt);

    // Honor an existing official pointer (including legacy IDs). Also read
    // the canonical location to detect conflicting results, never overwrite.
    const resultId = safeString(attempt.resultId);
    const [canonicalResultDoc, linkedResultDoc, newAssignmentDoc, legacyAssignmentDoc] = await Promise.all([
      transaction.get(canonicalResultRef),
      resultId && resultId !== attemptId
        ? transaction.get(db.collection("results").doc(resultId))
        : Promise.resolve(null),
      transaction.get(db.collection("assignments").doc(assignmentId)),
      transaction.get(db.collection("testAssignments").doc(assignmentId)),
    ]);
    const assignmentDoc = newAssignmentDoc.exists ? newAssignmentDoc : legacyAssignmentDoc;
    const assignment = assignmentDoc.exists ? asRecord(assignmentDoc.data()) : null;
    const assignmentSettings = assignment ? resolveAssignmentSettings({ assignment }) : null;

    if (resultId && resultId !== attemptId && canonicalResultDoc.exists) {
      throw new SubmitTransactionError("Phiên làm bài có tham chiếu kết quả không nhất quán. Cần kiểm tra dữ liệu.", 409);
    }
    const officialResultDoc = resultId && resultId !== attemptId ? linkedResultDoc : canonicalResultDoc;
    if (officialResultDoc?.exists) {
      const result = asRecord(officialResultDoc.data());
      assertResultBelongsToAttempt(result, attempt, attemptId);
      // Read-only replay: no grading, result mutation, or attempt repair.
      return { resultId: resultId || attemptId, alreadySubmitted: true, result, assignmentSettings };
    }

    if (safeString(attempt.status) === "submitted" || resultId) {
      throw new SubmitTransactionError("Không tìm thấy kết quả chính thức của phiên đã nộp. Cần kiểm tra dữ liệu.", 409);
    }
    validateLatestAttemptForSubmit(attempt);
    if (!assignment) {
      throw new SubmitTransactionError("Không tìm thấy bài kiểm tra được giao.", 404);
    }
    const studentDoc = await transaction.get(db.collection("students").doc(studentId));
    if (!studentDoc.exists) {
      throw new SubmitTransactionError("Không tìm thấy học sinh.", 404);
    }

    // Pure preparation only after the transaction establishes that there is
    // no official result. Retries reread autosaved answers and identity.
    const prepared = prepareSubmit({
      studentId, studentCode, attempt, assignment,
      student: asRecord(studentDoc.data()),
      requestAnswers, requestAntiCheat, submittedAt,
    });
    const submittedAtIso = submittedAt.toISOString();
    const result = buildResultPayload({
      attemptId, assignmentId, attempt, assignment,
      studentAccess: prepared.studentAccess,
      answers: prepared.answers,
      gradingSummary: prepared.gradingSummary,
      gradingScore: prepared.gradingScore,
      antiCheat: prepared.antiCheat,
      durationMinutes: prepared.assignmentSettings.durationMinutes,
      timeSpentSeconds: prepared.timeSpentSeconds,
      submittedAtIso, autoSubmit,
    });
    transaction.set(canonicalResultRef, result);
    transaction.update(attemptRef, buildSubmittedAttemptPayload({
      answers: prepared.answers, resultId: attemptId, submittedAtIso, antiCheat: prepared.antiCheat,
    }));
    return { resultId: attemptId, alreadySubmitted: false, result, assignmentSettings: prepared.assignmentSettings };
  });
}
