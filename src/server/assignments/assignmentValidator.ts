import {
  ApiError,
} from "@/server/http/apiError";

import {
  normalizeBoolean,
  normalizeInteger,
  normalizeOptionalIsoDate,
  safeLower,
  safeString,
} from "@/server/shared/normalize";

import type {
  AssignmentClassSnapshot,
  AssignmentResultVisibility,
  AssignmentStatus,
  CreateAssignmentInput,
} from "./assignmentTypes";

export type NormalizedAssignmentInput = {
  testId: string;

  title: string;

  description: string;

  classIds: string[];

  classNames: string[];

  classSnapshots:
    AssignmentClassSnapshot[];

  durationMinutes?: number;

  maxAttempts?: number;

  startTime?: string;

  endTime?: string;

  password: string;

  resultVisibility:
    AssignmentResultVisibility;

  showCorrectAnswers: boolean;

  shuffleQuestions?: boolean;

  shuffleOptions?: boolean;

  status: AssignmentStatus;
};

function readObject(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function normalizeStringList(
  value: unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (
            item
          ) =>
            safeString(
              item
            )
        )
        .filter(
          Boolean
        )
    )
  );
}

function normalizeClassSnapshots(
  value: unknown
): AssignmentClassSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<
    AssignmentClassSnapshot[]
  >(
    (
      result,
      rawClass
    ) => {
      const classData =
        readObject(
          rawClass
        );

      const id =
        safeString(
          classData.id
        );

      const name =
        safeString(
          classData.name ??
            classData.className
        );

      if (
        !id ||
        !name
      ) {
        return result;
      }

      const code =
        safeString(
          classData.code
        );

      const schoolId =
        safeString(
          classData.schoolId
        );

      const studentCount =
        Math.max(
          0,
          normalizeInteger(
            classData.studentCount,
            0
          )
        );

      const classSnapshot:
        AssignmentClassSnapshot = {
          id,
          name,

          studentCount,
        };

      if (code) {
        classSnapshot.code =
          code;
      }

      if (schoolId) {
        classSnapshot.schoolId =
          schoolId;
      }

      result.push(
        classSnapshot
      );

      return result;
    },
    []
  );
}

function normalizeResultVisibility(
  value: unknown
): AssignmentResultVisibility {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized ===
      "after_close" ||
    normalized ===
      "hidden"
  ) {
    return normalized;
  }

  return "immediately";
}

function normalizeAssignmentStatus(
  value: unknown,
  startTime?: string,
  endTime?: string
): AssignmentStatus {
  const normalized =
    safeLower(
      value
    );

  if (
    normalized ===
      "draft" ||
    normalized ===
      "scheduled" ||
    normalized ===
      "active"
  ) {
    return normalized;
  }

  const now =
    Date.now();

  if (
    startTime &&
    new Date(
      startTime
    ).getTime() >
      now
  ) {
    return "scheduled";
  }

  if (
    endTime &&
    new Date(
      endTime
    ).getTime() <=
      now
  ) {
    return "closed";
  }

  return "active";
}

export function normalizeCreateAssignmentInput(
  rawInput: unknown
): NormalizedAssignmentInput {
  const input =
    readObject(
      rawInput
    ) as CreateAssignmentInput;

  const testId =
    safeString(
      input.testId
    );

  const title =
    safeString(
      input.title
    );

  const description =
    safeString(
      input.description
    );

  const classIds =
    normalizeStringList(
      input.classIds
    );

  const classNames =
    normalizeStringList(
      input.classNames
    );

  const classSnapshots =
    normalizeClassSnapshots(
      input.classSnapshots
    );

  const startTime =
    normalizeOptionalIsoDate(
      input.startTime
    );

  const endTime =
    normalizeOptionalIsoDate(
      input.endTime
    );

  const durationMinutes =
    input.durationMinutes !==
    undefined
      ? normalizeInteger(
          input.durationMinutes,
          0
        )
      : undefined;

  const maxAttempts =
    input.maxAttempts !==
    undefined
      ? normalizeInteger(
          input.maxAttempts,
          0
        )
      : undefined;

  const password =
    safeString(
      input.password
    );

  const status =
    normalizeAssignmentStatus(
      input.status,
      startTime,
      endTime
    );

  if (!testId) {
    throw new ApiError(
      "Vui lòng chọn đề kiểm tra.",
      400,
      {
        code:
          "ASSIGNMENT_TEST_REQUIRED",
      }
    );
  }

  if (
    classIds.length ===
      0 &&
    classSnapshots.length ===
      0
  ) {
    throw new ApiError(
      "Vui lòng chọn ít nhất một lớp.",
      400,
      {
        code:
          "ASSIGNMENT_CLASS_REQUIRED",
      }
    );
  }

  if (
    startTime &&
    endTime &&
    new Date(
      startTime
    ).getTime() >=
      new Date(
        endTime
      ).getTime()
  ) {
    throw new ApiError(
      "Thời gian kết thúc phải sau thời gian bắt đầu.",
      400,
      {
        code:
          "INVALID_ASSIGNMENT_TIME_RANGE",
      }
    );
  }

  if (
    durationMinutes !==
      undefined &&
    durationMinutes <= 0
  ) {
    throw new ApiError(
      "Thời gian làm bài phải lớn hơn 0.",
      400,
      {
        code:
          "INVALID_ASSIGNMENT_DURATION",
      }
    );
  }

  if (
    maxAttempts !==
      undefined &&
    maxAttempts <= 0
  ) {
    throw new ApiError(
      "Số lượt làm bài phải lớn hơn 0.",
      400,
      {
        code:
          "INVALID_ASSIGNMENT_ATTEMPTS",
      }
    );
  }

  return {
    testId,

    title,

    description,

    classIds:
      classSnapshots.length >
      0
        ? Array.from(
            new Set([
              ...classIds,
              ...classSnapshots.map(
                (
                  item
                ) =>
                  item.id
              ),
            ])
          )
        : classIds,

    classNames:
      classSnapshots.length >
      0
        ? Array.from(
            new Set([
              ...classNames,
              ...classSnapshots.map(
                (
                  item
                ) =>
                  item.name
              ),
            ])
          )
        : classNames,

    classSnapshots,

    durationMinutes,

    maxAttempts,

    startTime,

    endTime,

    password,

    resultVisibility:
      normalizeResultVisibility(
        input.resultVisibility
      ),

    showCorrectAnswers:
      normalizeBoolean(
        input.showCorrectAnswers,
        false
      ),

    shuffleQuestions:
      input.shuffleQuestions !==
      undefined
        ? normalizeBoolean(
            input.shuffleQuestions,
            false
          )
        : undefined,

    shuffleOptions:
      input.shuffleOptions !==
      undefined
        ? normalizeBoolean(
            input.shuffleOptions,
            false
          )
        : undefined,

    status,
  };
}