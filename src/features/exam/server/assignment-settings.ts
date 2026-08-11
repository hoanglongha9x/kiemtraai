import {
  asRecord,
  safeBoolean,
  safeNumber,
  safeString,
} from "@/features/exam/utils";

export type AssignmentSettings = {
  totalScore: number;
  durationMinutes: number;
  resultVisibility: "immediately" | "after_close";
  showCorrectAnswers: boolean;
};

export type ResolveAssignmentSettingsInput = {
  assignment: Record<string, unknown>;
};

export type CalculateTimeSpentInput = {
  startedAt: unknown;
  submittedAt: Date;
};

export function resolveAssignmentTotalScore(
  assignment: Record<string, unknown>
): number {
  return 10;
}

export function resolveAssignmentDurationMinutes(
  assignment: Record<string, unknown>
): number {
  const testSnapshot =
    asRecord(
      assignment.testSnapshot
    );

  return Math.max(
    0,
    safeNumber(
      assignment.durationMinutes ??
        assignment.duration ??
        testSnapshot.durationMinutes ??
        testSnapshot.duration,
      0
    )
  );
}

export function resolveAssignmentSettings({
  assignment,
}: ResolveAssignmentSettingsInput): AssignmentSettings {
  const testSnapshot =
    asRecord(
      assignment.testSnapshot
    );

  const settings =
    asRecord(
      testSnapshot.settings
    );

  return {
    totalScore:
      resolveAssignmentTotalScore(
        assignment
      ),

    durationMinutes:
      resolveAssignmentDurationMinutes(
        assignment
      ),

    resultVisibility:
      safeString(
        assignment.resultVisibility ??
          settings.resultVisibility
      ) === "after_close"
        ? "after_close"
        : "immediately",

    showCorrectAnswers:
      safeBoolean(
        assignment.showCorrectAnswers ??
          settings.showCorrectAnswers
      ),
  };
}

export function calculateTimeSpentSeconds({
  startedAt,
  submittedAt,
}: CalculateTimeSpentInput): number {
  const startedAtValue =
    safeString(startedAt);

  if (!startedAtValue) {
    return 0;
  }

  const startedDate =
    new Date(startedAtValue);

  if (
    Number.isNaN(
      startedDate.getTime()
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (
        submittedAt.getTime() -
        startedDate.getTime()
      ) / 1000
    )
  );
}
