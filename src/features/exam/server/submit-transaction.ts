import type {
  DocumentReference,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";

import type {
  ResolvedAntiCheatState,
} from "@/features/exam/anti-cheat";

import {
  asRecord,
  safeString,
} from "@/features/exam/utils";

import {
  buildExistingResultAttemptPayload,
  buildSubmittedAttemptPayload,
} from "./attempt-payload";

import {
  buildResultPayload,
} from "./result-payload";

import {
  validateLatestAttemptForSubmit,
} from "./attempt-access";

import type {
  SubmitGradingScore,
  SubmitGradingSummary,
  SubmitTransactionResult,
} from "./submit-types";

import type {
  ValidatedStudentAccess,
} from "./student-access";

export type SubmitTransactionInput = {
  db: Firestore;

  attemptId: string;
  assignmentId: string;

  assignment:
    Record<string, unknown>;

  studentAccess:
    ValidatedStudentAccess;

  answers:
    Record<string, unknown>;

  gradingSummary:
    SubmitGradingSummary;

  gradingScore:
    SubmitGradingScore;

  antiCheat:
    ResolvedAntiCheatState;

  durationMinutes:
    number;

  timeSpentSeconds:
    number;

  submittedAtIso:
    string;

  autoSubmit:
    boolean;
};

export class SubmitTransactionError
  extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name =
      "SubmitTransactionError";

    this.statusCode =
      statusCode;
  }
}

async function readSubmitDocuments({
  transaction,
  attemptRef,
  resultRef,
}: {
  transaction:
    Transaction;

  attemptRef:
    DocumentReference;

  resultRef:
    DocumentReference;
}) {
  const [
    latestAttemptDoc,
    existingResultDoc,
  ] = await Promise.all([
    transaction.get(
      attemptRef
    ),

    transaction.get(
      resultRef
    ),
  ]);

  return {
    latestAttemptDoc,
    existingResultDoc,
  };
}

export async function runSubmitTransaction({
  db,
  attemptId,
  assignmentId,
  assignment,
  studentAccess,
  answers,
  gradingSummary,
  gradingScore,
  antiCheat,
  durationMinutes,
  timeSpentSeconds,
  submittedAtIso,
  autoSubmit,
}: SubmitTransactionInput): Promise<SubmitTransactionResult> {
  const attemptRef =
    db
      .collection(
        "examAttempts"
      )
      .doc(attemptId);

  /*
   * Sử dụng attemptId làm resultId giúp submit có tính
   * idempotent: một attempt chỉ tạo tối đa một result.
   */
  const resultRef =
    db
      .collection(
        "results"
      )
      .doc(attemptId);

  return db.runTransaction(
    async (
      transaction
    ) => {
      const {
        latestAttemptDoc,
        existingResultDoc,
      } = await readSubmitDocuments({
        transaction,
        attemptRef,
        resultRef,
      });

      if (
        !latestAttemptDoc.exists
      ) {
        throw new SubmitTransactionError(
          "Không tìm thấy phiên làm bài.",
          404
        );
      }

      const latestAttempt =
        asRecord(
          latestAttemptDoc.data()
        );

      /*
       * Result đã tồn tại:
       * đồng bộ lại trạng thái attempt rồi trả về result cũ.
       */
      if (
        existingResultDoc.exists
      ) {
        const existingResult =
          asRecord(
            existingResultDoc.data()
          );
        const resultPayload =
          buildResultPayload({
            attemptId,
            assignmentId,

            attempt:
              latestAttempt,

            assignment,

            studentAccess,

            answers,

            gradingSummary,
            gradingScore,

            antiCheat,

            durationMinutes,
            timeSpentSeconds,

            submittedAtIso:
              safeString(
                existingResult.submittedAt
              ) || submittedAtIso,
            autoSubmit:
              Boolean(
                existingResult.autoSubmit
              ) || autoSubmit,
          });

        const attemptPayload =
          buildExistingResultAttemptPayload({
            resultId:
              resultRef.id,

            currentSubmittedAt:
              latestAttempt
                .submittedAt,

            submittedAtIso,
          });

        transaction.update(
          attemptRef,
          attemptPayload
        );

        transaction.set(
          resultRef,
          {
            ...resultPayload,
            regradedAt:
              submittedAtIso,
          },
          {
            merge:
              true,
          }
        );

        return {
          resultId:
            resultRef.id,

          alreadySubmitted:
            true,
        };
      }

      /*
       * Attempt đã được đánh dấu submitted và có resultId.
       */
      const existingResultId =
        safeString(
          latestAttempt.resultId
        );

      if (
        safeString(
          latestAttempt.status
        ) === "submitted" &&
        existingResultId
      ) {
        return {
          resultId:
            existingResultId,

          alreadySubmitted:
            true,
        };
      }

      validateLatestAttemptForSubmit(
        latestAttempt
      );

      const resultPayload =
        buildResultPayload({
          attemptId,
          assignmentId,

          attempt:
            latestAttempt,

          assignment,

          studentAccess,

          answers,

          gradingSummary,
          gradingScore,

          antiCheat,

          durationMinutes,
          timeSpentSeconds,

          submittedAtIso,
          autoSubmit,
        });

      const attemptPayload =
        buildSubmittedAttemptPayload({
          answers,

          resultId:
            resultRef.id,

          submittedAtIso,

          antiCheat,
        });

      transaction.set(
        resultRef,
        resultPayload
      );

      transaction.update(
        attemptRef,
        attemptPayload
      );

      return {
        resultId:
          resultRef.id,

        alreadySubmitted:
          false,
      };
    }
  );
}
