import type {
  ResolvedAntiCheatState,
} from "@/features/exam/anti-cheat";

import {
  safeString,
} from "@/features/exam/utils";

export type BuildSubmittedAttemptPayloadInput = {
  answers: Record<string, unknown>;
  resultId: string;
  submittedAtIso: string;
  antiCheat: ResolvedAntiCheatState;
};

export type BuildExistingResultAttemptPayloadInput = {
  resultId: string;
  currentSubmittedAt: unknown;
  submittedAtIso: string;
};

export type SubmittedAttemptPayload =
  Record<string, unknown>;

export function buildSubmittedAttemptPayload({
  answers,
  resultId,
  submittedAtIso,
  antiCheat,
}: BuildSubmittedAttemptPayloadInput): SubmittedAttemptPayload {
  return {
    status:
      "submitted",

    answers,

    resultId,

    submittedAt:
      submittedAtIso,

    antiCheat: {
      visibilityLostCount:
        antiCheat
          .visibilityLostCount,

      focusLostCount:
        antiCheat
          .focusLostCount,

      suspiciousEvents:
        antiCheat
          .suspiciousEvents,
    },

    updatedAt:
      submittedAtIso,

    lastSavedAt:
      submittedAtIso,
  };
}

export function buildExistingResultAttemptPayload({
  resultId,
  currentSubmittedAt,
  submittedAtIso,
}: BuildExistingResultAttemptPayloadInput): SubmittedAttemptPayload {
  return {
    status:
      "submitted",

    resultId,

    submittedAt:
      safeString(
        currentSubmittedAt
      ) ||
      submittedAtIso,

    updatedAt:
      submittedAtIso,
  };
}