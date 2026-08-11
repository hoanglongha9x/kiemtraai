import type {
  ExamAccessState,
  ExamAnswerKey,
  ExamAssignmentInfo,
  ExamAssignmentStatus,
  ExamClassSnapshot,
  ExamSuspiciousEvent,
} from "./types";

export function safeString(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

export function safeUpper(
  value: unknown
): string {
  return safeString(
    value
  ).toUpperCase();
}

export function safeNumber(
  value: unknown,
  fallback = 0
): number {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

export function safeBoolean(
  value: unknown,
  fallback = false
): boolean {
  return typeof value ===
    "boolean"
    ? value
    : fallback;
}

export function asRecord(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

export function normalizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          safeString
        )
        .filter(Boolean)
    )
  );
}

export function normalizeAnswerKey(
  value: unknown
): ExamAnswerKey | "" {
  const answer =
    safeUpper(value);

  if (
    answer === "A" ||
    answer === "B" ||
    answer === "C" ||
    answer === "D"
  ) {
    return answer;
  }

  return "";
}

export function normalizeSuspiciousEvents(
  value: unknown
): ExamSuspiciousEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-100)
    .map((item) => {
      const record =
        asRecord(item);

      const type =
        safeString(
          record.type
        );

      const at =
        safeString(
          record.at
        );

      if (
        type !==
          "visibility_hidden" &&
        type !==
          "window_blur"
      ) {
        return null;
      }

      if (!at) {
        return null;
      }

      return {
        type,
        at,
      } satisfies ExamSuspiciousEvent;
    })
    .filter(
      (
        item
      ): item is ExamSuspiciousEvent =>
        Boolean(item)
    );
}

export function normalizeAssignmentStatus(
  value: unknown
): ExamAssignmentStatus {
  switch (
    safeString(value)
  ) {
    case "scheduled":
      return "scheduled";

    case "closed":
      return "closed";

    case "locked":
      return "locked";

    case "archived":
      return "archived";

    default:
      return "active";
  }
}

export function deriveExamAccessState(
  assignment:
    Record<
      string,
      unknown
    >,
  now = new Date()
): {
  state:
    ExamAccessState;

  message: string;
} {
  const storedStatus =
    normalizeAssignmentStatus(
      assignment.status
    );

  if (
    storedStatus ===
    "locked"
  ) {
    return {
      state:
        "locked",

      message:
        "Bài kiểm tra này hiện đang bị khóa.",
    };
  }

  if (
    storedStatus ===
    "archived"
  ) {
    return {
      state:
        "archived",

      message:
        "Bài kiểm tra này đã được lưu trữ.",
    };
  }

  const access =
    asRecord(
      assignment.access
    );

  const startTime =
    safeString(
      access.startTime ??
        assignment.startTime
    );

  const endTime =
    safeString(
      access.endTime ??
        assignment.endTime
    );

  if (startTime) {
    const startDate =
      new Date(
        startTime
      );

    if (
      !Number.isNaN(
        startDate.getTime()
      ) &&
      now.getTime() <
        startDate.getTime()
    ) {
      return {
        state:
          "scheduled",

        message:
          "Bài kiểm tra chưa đến thời gian mở.",
      };
    }
  }

  if (endTime) {
    const endDate =
      new Date(
        endTime
      );

    if (
      !Number.isNaN(
        endDate.getTime()
      ) &&
      now.getTime() >
        endDate.getTime()
    ) {
      return {
        state:
          "closed",

        message:
          "Bài kiểm tra đã hết thời gian mở.",
      };
    }
  }

  if (
    storedStatus ===
    "scheduled"
  ) {
    return {
      state:
        "scheduled",

      message:
        "Bài kiểm tra chưa đến thời gian mở.",
    };
  }

  if (
    storedStatus ===
    "closed"
  ) {
    return {
      state:
        "closed",

      message:
        "Bài kiểm tra đã đóng.",
    };
  }

  return {
    state:
      "available",

    message:
      "Bài kiểm tra đang mở.",
  };
}

function normalizeClassSnapshots(
  assignment:
    Record<
      string,
      unknown
    >
): ExamClassSnapshot[] {
  const rawSnapshots =
    Array.isArray(
      assignment.classSnapshots
    )
      ? assignment.classSnapshots
      : [];

  const snapshots =
    rawSnapshots
      .map((item) => {
        const record =
          asRecord(item);

        const id =
          safeString(
            record.id ??
              record.classId
          );

        if (!id) {
          return null;
        }

        return {
          id,

          className:
            safeString(
              record.className ??
                record.name
            ) || id,

          grade:
            safeString(
              record.grade
            ),

          schoolYear:
            safeString(
              record.schoolYear
            ),

          studentCount:
            Math.max(
              0,
              safeNumber(
                record.studentCount
              )
            ),
        } satisfies ExamClassSnapshot;
      })
      .filter(
        (
          item
        ): item is ExamClassSnapshot =>
          Boolean(item)
      );

  if (
    snapshots.length > 0
  ) {
    return snapshots;
  }

  const classIds =
    normalizeStringArray(
      assignment.classIds
    );

  const classNames =
    normalizeStringArray(
      assignment.classNames
    );

  const legacyClassId =
    safeString(
      assignment.classId
    );

  const legacyClassName =
    safeString(
      assignment.className
    );

  const normalizedIds =
    classIds.length > 0
      ? classIds
      : legacyClassId
        ? [legacyClassId]
        : [];

  return normalizedIds.map(
    (
      id,
      index
    ) => ({
      id,

      className:
        classNames[
          index
        ] ||
        legacyClassName ||
        id,

      grade: "",

      schoolYear: "",

      studentCount: 0,
    })
  );
}

export function buildExamAssignmentInfo(
  assignmentId: string,
  assignment:
    Record<
      string,
      unknown
    >
): ExamAssignmentInfo {
  const testSnapshot =
    asRecord(
      assignment.testSnapshot
    );

  const metadata =
    asRecord(
      testSnapshot.metadata
    );

  const settings =
    asRecord(
      assignment.settings
    );

  const access =
    asRecord(
      assignment.access
    );

  const classSnapshots =
    normalizeClassSnapshots(
      assignment
    );

  const classIds =
    classSnapshots.map(
      (item) =>
        item.id
    );

  const classNames =
    classSnapshots.map(
      (item) =>
        item.className
    );

  const durationMinutes =
    Math.max(
      1,
      safeNumber(
        testSnapshot.durationMinutes ??
          assignment.durationMinutes ??
          assignment.duration,
        45
      )
    );

  const accessResult =
    deriveExamAccessState(
      assignment
    );

  return {
    id:
      assignmentId,

    assignmentCode:
      safeUpper(
        assignment.assignmentCode
      ),

    status:
      normalizeAssignmentStatus(
        assignment.status
      ),

    accessState:
      accessResult.state,

    accessMessage:
      accessResult.message,

    testId:
      safeString(
        testSnapshot.id ??
          assignment.testId
      ),

    testTitle:
      safeString(
        testSnapshot.title ??
          assignment.testTitle
      ) ||
      "Bài kiểm tra",

    subject:
      safeString(
        metadata.subject ??
          testSnapshot.subject ??
          assignment.subject
      ),

    grade:
      safeString(
        metadata.grade ??
          testSnapshot.grade ??
          assignment.grade
      ),

    description:
      safeString(
        testSnapshot.description ??
          assignment.description
      ),

    instructions:
      safeString(
        testSnapshot.instructions ??
          assignment.instructions
      ),

    durationMinutes,

    totalQuestions:
      Math.max(
        0,
        safeNumber(
          testSnapshot.totalQuestions ??
            assignment.totalQuestions ??
            assignment.questionCount
        )
      ),

    totalScore:
      Math.max(
        0,
        safeNumber(
          testSnapshot.totalScore ??
            assignment.totalScore,
          10
        )
      ),

    versionNumber:
      Math.max(
        1,
        safeNumber(
          testSnapshot.versionNumber ??
            asRecord(
              testSnapshot.version
            ).number ??
            assignment.versionNumber,
          1
        )
      ),

    classIds,

    classNames,

    classSnapshots,

    maxAttempts:
      Math.max(
        1,
        safeNumber(
          access.maxAttempts ??
            settings.maxAttempts ??
            assignment.maxAttempts,
          1
        )
      ),

    hasPassword:
      safeBoolean(
        access.hasPassword ??
          assignment.hasPassword
      ) ||
      Boolean(
        safeString(
          access.passwordHash ??
            assignment.passwordHash ??
            assignment.password
        )
      ),

    startTime:
      safeString(
        access.startTime ??
          assignment.startTime
      ) ||
      undefined,

    endTime:
      safeString(
        access.endTime ??
          assignment.endTime
      ) ||
      undefined,

    shuffleQuestions:
      safeBoolean(
        settings.shuffleQuestions ??
          assignment.shuffleQuestions
      ),

    shuffleOptions:
      safeBoolean(
        settings.shuffleOptions ??
          assignment.shuffleOptions
      ),

    resultVisibility:
      safeString(
        settings.resultVisibility ??
          assignment.resultVisibility
      ) ===
      "after_close"
        ? "after_close"
        : "immediately",

    showCorrectAnswers:
      safeBoolean(
        settings.showCorrectAnswers ??
          assignment.showCorrectAnswers
      ),
  };
}