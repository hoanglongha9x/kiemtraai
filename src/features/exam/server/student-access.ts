import {
  asRecord,
  normalizeStringArray,
  safeString,
  safeUpper,
} from "@/features/exam/utils";

export class StudentAccessError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400
  ) {
    super(message);

    this.name = "StudentAccessError";
    this.statusCode = statusCode;
  }
}

export type AssignmentClassAccess = {
  classIds: string[];
  classNames: string[];
};

export type ValidateStudentAccessInput = {
  studentId: string;
  studentCode: string;
  student: Record<string, unknown>;
  assignment: Record<string, unknown>;
};

export type ValidatedStudentAccess = {
  studentId: string;
  studentCode: string;
  studentName: string;
  studentClassId: string;
  studentClassName: string;
  allowedClassIds: string[];
  allowedClassNames: string[];
};

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values.filter(Boolean)
    )
  );
}

export function getAssignmentClassIds(
  assignment: Record<string, unknown>
): string[] {
  const classSnapshots =
    Array.isArray(
      assignment.classSnapshots
    )
      ? assignment.classSnapshots
      : [];

  const snapshotClassIds =
    classSnapshots
      .map((item) => {
        const classSnapshot =
          asRecord(item);

        return safeString(
          classSnapshot.id ??
            classSnapshot.classId
        );
      })
      .filter(Boolean);

  if (
    snapshotClassIds.length > 0
  ) {
    return uniqueStrings(
      snapshotClassIds
    );
  }

  const classIds =
    normalizeStringArray(
      assignment.classIds
    );

  if (classIds.length > 0) {
    return uniqueStrings(
      classIds
    );
  }

  const classId =
    safeString(
      assignment.classId
    );

  return classId
    ? [classId]
    : [];
}

export function getAssignmentClassNames(
  assignment: Record<string, unknown>
): string[] {
  const classSnapshots =
    Array.isArray(
      assignment.classSnapshots
    )
      ? assignment.classSnapshots
      : [];

  const snapshotClassNames =
    classSnapshots
      .map((item) => {
        const classSnapshot =
          asRecord(item);

        return safeString(
          classSnapshot.className ??
            classSnapshot.name
        );
      })
      .filter(Boolean);

  if (
    snapshotClassNames.length > 0
  ) {
    return uniqueStrings(
      snapshotClassNames
    );
  }

  const classNames =
    normalizeStringArray(
      assignment.classNames
    );

  if (
    classNames.length > 0
  ) {
    return uniqueStrings(
      classNames
    );
  }

  const className =
    safeString(
      assignment.className
    );

  return className
    ? [className]
    : [];
}

export function getAssignmentClassAccess(
  assignment: Record<string, unknown>
): AssignmentClassAccess {
  return {
    classIds:
      getAssignmentClassIds(
        assignment
      ),

    classNames:
      getAssignmentClassNames(
        assignment
      ),
  };
}

export function validateStudentIdentity(
  studentId: string,
  studentCode: string,
  student: Record<string, unknown>
): void {
  const normalizedStudentId =
    safeString(studentId);

  const normalizedStudentCode =
    safeUpper(studentCode);

  if (
    !normalizedStudentId ||
    !normalizedStudentCode
  ) {
    throw new StudentAccessError(
      "Thiếu thông tin học sinh.",
      400
    );
  }

  const storedStudentCode =
    safeUpper(
      student.studentCode
    );

  if (
    !storedStudentCode ||
    storedStudentCode !==
      normalizedStudentCode
  ) {
    throw new StudentAccessError(
      "Mã học sinh không khớp.",
      403
    );
  }

  if (
    safeString(
      student.status
    ) !== "active"
  ) {
    throw new StudentAccessError(
      "Tài khoản học sinh đang bị khóa.",
      403
    );
  }
}

export function validateStudentClassAccess(
  student: Record<string, unknown>,
  assignment: Record<string, unknown>
): AssignmentClassAccess {
  const classAccess =
    getAssignmentClassAccess(
      assignment
    );

  const studentClassId =
    safeString(
      student.classId
    );

  if (!studentClassId) {
    throw new StudentAccessError(
      "Học sinh chưa được xếp lớp.",
      403
    );
  }

  if (
    classAccess.classIds.length === 0
  ) {
    throw new StudentAccessError(
      "Bài kiểm tra chưa được giao cho lớp nào.",
      403
    );
  }

  if (
    !classAccess.classIds.includes(
      studentClassId
    )
  ) {
    throw new StudentAccessError(
      "Học sinh không thuộc lớp được giao đề.",
      403
    );
  }

  return classAccess;
}

export function validateStudentAccess({
  studentId,
  studentCode,
  student,
  assignment,
}: ValidateStudentAccessInput): ValidatedStudentAccess {
  validateStudentIdentity(
    studentId,
    studentCode,
    student
  );

  const classAccess =
    validateStudentClassAccess(
      student,
      assignment
    );

  return {
    studentId:
      safeString(studentId),

    studentCode:
      safeUpper(
        student.studentCode ??
          studentCode
      ),

    studentName:
      safeString(
        student.studentName ??
          student.name
      ),

    studentClassId:
      safeString(
        student.classId
      ),

    studentClassName:
      safeString(
        student.className
      ),

    allowedClassIds:
      classAccess.classIds,

    allowedClassNames:
      classAccess.classNames,
  };
}