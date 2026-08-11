import type {
  DocumentData,
} from "firebase-admin/firestore";

import {
  hashPassword,
} from "@/lib/security/password";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  ApiError,
} from "@/server/http/apiError";

import {
  removeUndefinedValues,
  safeString,
} from "@/server/shared/normalize";

import {
  canAssignTest,
} from "@/server/tests/testPermissions";

import {
  getTestById,
} from "@/server/tests/testRepository";

import {
  generateUniqueAssignmentCode,
} from "./assignmentCode";

import {
  mapAssignmentListItem,
  resolveAssignmentAccessState,
} from "./assignmentMapper";

import {
  createAssignmentReference,
  listAccessibleAssignments,
  saveAssignment,
} from "./assignmentRepository";

import {
  mapAssignmentTestSnapshot,
} from "./assignmentSnapshotMapper";

import {
  normalizeCreateAssignmentInput,
} from "./assignmentValidator";

type UnknownRecord =
  Record<string, unknown>;

function readObject(
  value: unknown
): UnknownRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

export async function listTeacherAssignments(
  request: Request
) {
  const teacher =
    await getCurrentTeacher(
      request
    );

  const assignments =
    await listAccessibleAssignments(
      teacher
    );

  return assignments
    .map(
      assignment =>
        mapAssignmentListItem(
          assignment.id,
          assignment.data
        )
    )
    .filter(
      assignment =>
        assignment.status !==
        "archived"
    )
    .sort(
      (
        first,
        second
      ) =>
        second.createdAt.localeCompare(
          first.createdAt
        )
    );
}

export async function createTeacherAssignment(
  request: Request,
  rawBody: unknown
) {
  const teacher =
    await getCurrentTeacher(
      request
    );

  const input =
    normalizeCreateAssignmentInput(
      rawBody
    );

  const storedTest =
    await getTestById(
      input.testId
    );

  if (
    !storedTest
  ) {
    throw new ApiError(
      "Không tìm thấy đề kiểm tra.",
      404,
      {
        code:
          "TEST_NOT_FOUND",
      }
    );
  }

  const testData =
    storedTest.data as UnknownRecord;

  if (
    !canAssignTest(
      teacher,
      testData
    )
  ) {
    throw new ApiError(
      "Bạn không có quyền giao đề kiểm tra này.",
      403,
      {
        code:
          "TEST_ASSIGN_FORBIDDEN",
      }
    );
  }

  const testStatus =
    safeString(
      testData.status
    );

  const version =
    readObject(
      testData.version
    );

  const versionStatus =
    safeString(
      version.status
    );

  if (
    testStatus !==
      "published" ||
    versionStatus !==
      "published"
  ) {
    throw new ApiError(
      "Chỉ có thể giao đề đã được xuất bản.",
      409,
      {
        code:
          "TEST_NOT_PUBLISHED",
      }
    );
  }

  console.log(
    "CREATE ASSIGNMENT TEST DATA",
    {
      testId:
        input.testId,

      status:
        testStatus,

      versionStatus,

      keys:
        Object.keys(
          testData
        ),

      hasPublishedSnapshot:
        Boolean(
          testData.publishedSnapshot
        ),

      publishedSnapshot:
        testData.publishedSnapshot,
    }
  );

  const testSnapshot =
    mapAssignmentTestSnapshot(
      input.testId,
      testData
    );

  const assignmentReference =
    createAssignmentReference();

  const assignmentCode =
    await generateUniqueAssignmentCode();

  const now =
    new Date()
      .toISOString();

  const durationMinutes =
    input.durationMinutes ??
    testSnapshot.durationMinutes;

  const maxAttempts =
    input.maxAttempts ??
    testSnapshot.maxAttempts;

  const shuffleQuestions =
    input.shuffleQuestions ??
    testSnapshot.settings
      .shuffleQuestions;

  const shuffleOptions =
    input.shuffleOptions ??
    testSnapshot.settings
      .shuffleOptions;

  const assignmentTitle =
    input.title ||
    testSnapshot.title;

  const accessState =
    resolveAssignmentAccessState(
      input.status,
      input.startTime,
      input.endTime
    );

  const hasPassword =
    Boolean(
      input.password
    );

  const passwordHash =
    hasPassword
      ? hashPassword(
          input.password
        )
      : undefined;

  const creator = {
    uid:
      teacher.uid,

    email:
      teacher.email,

    name:
      teacher.name,

    role:
      teacher.role,

    schoolId:
      teacher.schoolId,
  };

  const assignmentData =
    removeUndefinedValues({
      id:
        assignmentReference.id,

      assignmentCode,

      title:
        assignmentTitle,

      description:
        input.description,

      testId:
        input.testId,

      testTitle:
        testSnapshot.title,

      testSnapshotId:
        testSnapshot.snapshotId,

      testVersionNumber:
        testSnapshot.versionNumber,

      testSnapshot,

      creator,

      classIds:
        input.classIds,

      classNames:
        input.classNames,

      classSnapshots:
        input.classSnapshots,

      classCount:
        input.classIds.length,

      subject:
        testSnapshot.metadata
          .subject,

      grade:
        testSnapshot.metadata
          .grade,

      durationMinutes,

      totalQuestions:
        testSnapshot.totalQuestions,

      totalScore:
        testSnapshot.totalScore,

      maxAttempts,

      startTime:
        input.startTime,

      endTime:
        input.endTime,

      status:
        input.status,

      accessState,

      hasPassword,

      passwordHash,

      resultVisibility:
        input.resultVisibility,

      showCorrectAnswers:
        input.showCorrectAnswers,

      shuffleQuestions,

      shuffleOptions,

      createdAt:
        now,

      updatedAt:
        now,

      publishedAt:
        input.status ===
          "active" ||
        input.status ===
          "scheduled"
          ? now
          : undefined,

      schemaVersion:
        3,

      /*
       * Tương thích màn hình cũ.
       */
      teacherEmail:
        teacher.email,

      teacherName:
        teacher.name,

      schoolId:
        teacher.schoolId,
    }) as DocumentData;

  await saveAssignment(
    assignmentReference,
    assignmentData
  );

  return {
    assignmentId:
      assignmentReference.id,

    assignmentCode,

    assignmentStatus:
      input.status,

    accessState,

    testId:
      input.testId,

    testSnapshotId:
      testSnapshot.snapshotId,

    testVersionNumber:
      testSnapshot.versionNumber,

    totalQuestions:
      testSnapshot.totalQuestions,

    classCount:
      input.classIds.length,

    assignment:
      mapAssignmentListItem(
        assignmentReference.id,
        assignmentData as UnknownRecord
      ),

    message:
      "Đã giao bài kiểm tra thành công.",
  };
}