import type {
  CurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  normalizeEmail,
  safeString,
} from "@/server/shared/normalize";

export type TestOwnerRecord = {
  uid?: unknown;
  email?: unknown;
  name?: unknown;
  schoolId?: unknown;
};

export type TestAccessRecord = {
  owner?:
    | TestOwnerRecord
    | null;

  /*
   * Các field tương thích dữ liệu cũ.
   */
  teacherUid?: unknown;
  teacherEmail?: unknown;
  teacherName?: unknown;
  schoolId?: unknown;
  createdBy?: unknown;
};

export type ResolvedTestOwner = {
  uid: string;
  email: string;
  name: string;
  schoolId: string;
};

function normalizeUid(
  value: unknown
): string {
  return safeString(
    value
  ).trim();
}

function normalizeSchoolId(
  value: unknown
): string {
  return (
    safeString(
      value
    ).trim() ||
    "fpt"
  );
}

function normalizeRole(
  value: unknown
): string {
  return safeString(
    value
  )
    .trim()
    .toLowerCase();
}

function readOwner(
  test: TestAccessRecord
): TestOwnerRecord {
  if (
    test.owner &&
    typeof test.owner ===
      "object" &&
    !Array.isArray(
      test.owner
    )
  ) {
    return test.owner;
  }

  return {};
}

export function resolveTestOwner(
  test: TestAccessRecord
): ResolvedTestOwner {
  const owner =
    readOwner(
      test
    );

  /*
   * Nguồn UID:
   *
   * 1. owner.uid:
   *    schema hiện tại.
   *
   * 2. teacherUid:
   *    field tương thích cũ.
   *
   * 3. createdBy:
   *    hệ thống hiện tại lưu Firebase UID.
   */
  const uid =
    normalizeUid(
      owner.uid
    ) ||
    normalizeUid(
      test.teacherUid
    ) ||
    normalizeUid(
      test.createdBy
    );

  /*
   * Không sử dụng createdBy làm email.
   */
  const email =
    normalizeEmail(
      owner.email ??
        test.teacherEmail
    );

  const name =
    safeString(
      owner.name ??
        test.teacherName
    ).trim();

  const schoolId =
    normalizeSchoolId(
      owner.schoolId ??
        test.schoolId
    );

  return {
    uid,
    email,
    name,
    schoolId,
  };
}

export function isSameSchool(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  const owner =
    resolveTestOwner(
      test
    );

  const teacherSchoolId =
    normalizeSchoolId(
      teacher.schoolId
    );

  return (
    owner.schoolId ===
    teacherSchoolId
  );
}

export function isTestOwner(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  const owner =
    resolveTestOwner(
      test
    );

  const teacherUid =
    normalizeUid(
      teacher.uid
    );

  const teacherEmail =
    normalizeEmail(
      teacher.email
    );

  /*
   * Khi đề có UID chủ sở hữu,
   * UID phải khớp tuyệt đối.
   */
  if (
    owner.uid
  ) {
    return Boolean(
      teacherUid &&
        owner.uid ===
          teacherUid
    );
  }

  /*
   * Chỉ dùng email cho dữ liệu cũ
   * hoàn toàn chưa có UID.
   */
  return Boolean(
    owner.email &&
      teacherEmail &&
      owner.email ===
        teacherEmail
  );
}

export function isSchoolAdmin(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  const role =
    normalizeRole(
      teacher.role
    );

  if (
    role !==
    "admin"
  ) {
    return false;
  }

  return isSameSchool(
    teacher,
    test
  );
}

export function canViewTest(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  return isTestOwner(
    teacher,
    test
  );
}

export function canEditTest(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  return isTestOwner(
    teacher,
    test
  );
}

export function canPublishTest(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  return isTestOwner(
    teacher,
    test
  );
}

export function canAssignTest(
  teacher: CurrentTeacher,
  test: TestAccessRecord
): boolean {
  return isTestOwner(
    teacher,
    test
  );
}
