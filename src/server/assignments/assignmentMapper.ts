import {
  normalizeBoolean,
  normalizeInteger,
  normalizeNumber,
  safeString,
} from "@/server/shared/normalize";

import type {
  AssignmentAccessState,
  AssignmentStatus,
  TeacherAssignmentDocument,
} from "./assignmentTypes";

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

function normalizeStatus(
  value: unknown
): AssignmentStatus {
  const status =
    safeString(
      value
    );

  if (
    status ===
      "draft" ||
    status ===
      "scheduled" ||
    status ===
      "active" ||
    status ===
      "closed" ||
    status ===
      "locked" ||
    status ===
      "archived"
  ) {
    return status;
  }

  return "draft";
}

export function resolveAssignmentAccessState(
  status: AssignmentStatus,
  startTime?: string,
  endTime?: string
): AssignmentAccessState {
  if (
    status ===
    "archived"
  ) {
    return "archived";
  }

  if (
    status ===
    "locked"
  ) {
    return "locked";
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
    status ===
      "closed" ||
    (
      endTime &&
      new Date(
        endTime
      ).getTime() <=
        now
    )
  ) {
    return "closed";
  }

  return "available";
}

export function mapAssignmentListItem(
  assignmentId: string,
  rawData: Record<
    string,
    unknown
  >
) {
  const creator =
    readObject(
      rawData.creator
    );

  const testSnapshot =
    readObject(
      rawData.testSnapshot
    );

  const metadata =
    readObject(
      testSnapshot.metadata
    );

  const startTime =
    safeString(
      rawData.startTime
    ) ||
    undefined;

  const endTime =
    safeString(
      rawData.endTime
    ) ||
    undefined;

  const status =
    normalizeStatus(
      rawData.status
    );

  return {
    id:
      assignmentId,

    assignmentCode:
      safeString(
        rawData.assignmentCode
      ),

    title:
      safeString(
        rawData.title
      ),

    description:
      safeString(
        rawData.description
      ),

    testId:
      safeString(
        rawData.testId
      ),

    testTitle:
      safeString(
        rawData.testTitle ??
          testSnapshot.title
      ),

    testSnapshotId:
      safeString(
        rawData.testSnapshotId ??
          testSnapshot.snapshotId
      ),

    testVersionNumber:
      normalizeInteger(
        rawData.testVersionNumber ??
          testSnapshot.versionNumber,
        1
      ),

    creator: {
      uid:
        safeString(
          creator.uid
        ),

      email:
        safeString(
          creator.email ??
            rawData.teacherEmail
        ),

      name:
        safeString(
          creator.name ??
            rawData.teacherName
        ),

      role:
        creator.role ===
        "admin"
          ? "admin"
          : "teacher",

      schoolId:
        safeString(
          creator.schoolId ??
            rawData.schoolId
        ) ||
        "default",
    },

    classIds:
      Array.isArray(
        rawData.classIds
      )
        ? rawData.classIds.map(
            String
          )
        : [],

    classNames:
      Array.isArray(
        rawData.classNames
      )
        ? rawData.classNames.map(
            String
          )
        : [],

    classCount:
      normalizeInteger(
        rawData.classCount,
        Array.isArray(
          rawData.classIds
        )
          ? rawData.classIds.length
          : 0
      ),

    subject:
      safeString(
        rawData.subject ??
          metadata.subject
      ),

    grade:
      safeString(
        rawData.grade ??
          metadata.grade
      ),

    durationMinutes:
      normalizeInteger(
        rawData.durationMinutes ??
          testSnapshot.durationMinutes,
        0
      ),

    totalQuestions:
      normalizeInteger(
        rawData.totalQuestions ??
          testSnapshot.totalQuestions,
        0
      ),

    totalScore:
      normalizeNumber(
        rawData.totalScore ??
          testSnapshot.totalScore,
        0
      ),

    maxAttempts:
      normalizeInteger(
        rawData.maxAttempts ??
          testSnapshot.maxAttempts,
        1
      ),

    startTime,

    endTime,

    status,

    accessState:
      resolveAssignmentAccessState(
        status,
        startTime,
        endTime
      ),

    hasPassword:
      normalizeBoolean(
        rawData.hasPassword,
        false
      ),

    resultVisibility:
      safeString(
        rawData.resultVisibility
      ) ||
      "immediately",

    showCorrectAnswers:
      normalizeBoolean(
        rawData.showCorrectAnswers,
        false
      ),

    shuffleQuestions:
      normalizeBoolean(
        rawData.shuffleQuestions,
        false
      ),

    shuffleOptions:
      normalizeBoolean(
        rawData.shuffleOptions,
        false
      ),

    createdAt:
      safeString(
        rawData.createdAt
      ),

    updatedAt:
      safeString(
        rawData.updatedAt
      ),
  };
}

export function mapAssignmentDocument(
  assignmentId: string,
  rawData: Record<
    string,
    unknown
  >
): TeacherAssignmentDocument {
  return {
    id:
      assignmentId,

    assignmentCode:
      safeString(
        rawData.assignmentCode
      ),

    title:
      safeString(
        rawData.title
      ),

    description:
      safeString(
        rawData.description
      ),

    testId:
      safeString(
        rawData.testId
      ),

    testTitle:
      safeString(
        rawData.testTitle
      ),

    testSnapshotId:
      safeString(
        rawData.testSnapshotId
      ),

    testVersionNumber:
      normalizeInteger(
        rawData.testVersionNumber,
        1
      ),

    testSnapshot:
      rawData.testSnapshot as
        TeacherAssignmentDocument["testSnapshot"],

    creator:
      rawData.creator as
        TeacherAssignmentDocument["creator"],

    classIds:
      Array.isArray(
        rawData.classIds
      )
        ? rawData.classIds.map(
            String
          )
        : [],

    classNames:
      Array.isArray(
        rawData.classNames
      )
        ? rawData.classNames.map(
            String
          )
        : [],

    classSnapshots:
      Array.isArray(
        rawData.classSnapshots
      )
        ? rawData.classSnapshots as
            TeacherAssignmentDocument["classSnapshots"]
        : [],

    classCount:
      normalizeInteger(
        rawData.classCount,
        0
      ),

    subject:
      safeString(
        rawData.subject
      ),

    grade:
      safeString(
        rawData.grade
      ),

    durationMinutes:
      normalizeInteger(
        rawData.durationMinutes,
        0
      ),

    totalQuestions:
      normalizeInteger(
        rawData.totalQuestions,
        0
      ),

    totalScore:
      normalizeNumber(
        rawData.totalScore,
        0
      ),

    maxAttempts:
      normalizeInteger(
        rawData.maxAttempts,
        1
      ),

    startTime:
      safeString(
        rawData.startTime
      ) ||
      undefined,

    endTime:
      safeString(
        rawData.endTime
      ) ||
      undefined,

    status:
      normalizeStatus(
        rawData.status
      ),

    accessState:
      safeString(
        rawData.accessState
      ) as
        TeacherAssignmentDocument["accessState"],

    hasPassword:
      normalizeBoolean(
        rawData.hasPassword,
        false
      ),

    passwordHash:
      safeString(
        rawData.passwordHash
      ) ||
      undefined,

    resultVisibility:
      safeString(
        rawData.resultVisibility
      ) as
        TeacherAssignmentDocument["resultVisibility"],

    showCorrectAnswers:
      normalizeBoolean(
        rawData.showCorrectAnswers,
        false
      ),

    shuffleQuestions:
      normalizeBoolean(
        rawData.shuffleQuestions,
        false
      ),

    shuffleOptions:
      normalizeBoolean(
        rawData.shuffleOptions,
        false
      ),

    createdAt:
      safeString(
        rawData.createdAt
      ),

    updatedAt:
      safeString(
        rawData.updatedAt
      ),

    publishedAt:
      safeString(
        rawData.publishedAt
      ) ||
      undefined,

    closedAt:
      safeString(
        rawData.closedAt
      ) ||
      undefined,
  };
}