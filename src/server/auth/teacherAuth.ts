import type {
  DecodedIdToken,
} from "firebase-admin/auth";

import {
  getAdminAuth,
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  ApiError,
} from "@/server/http/apiError";

import {
  normalizeEmail,
  safeString,
} from "@/server/shared/normalize";

export type TeacherRole =
  | "admin"
  | "teacher";

export type TeacherStatus =
  | "active"
  | "locked";

export type TeacherProfileDocument = {
  email?: string;

  name?: string;

  role?:
    | TeacherRole
    | string;

  status?:
    | TeacherStatus
    | string;

  subject?: string;

  schoolId?: string;
};

export type CurrentTeacher = {
  uid: string;

  email: string;

  name: string;

  role: TeacherRole;

  status: "active";

  subject?: string;

  schoolId: string;

  picture?: string;
};

function extractBearerToken(
  request: Request
): string {
  const authorizationHeader =
    request.headers.get(
      "authorization"
    ) ?? "";

  if (
    !authorizationHeader.startsWith(
      "Bearer "
    )
  ) {
    return "";
  }

  return authorizationHeader
    .slice(
      "Bearer ".length
    )
    .trim();
}

async function verifyTeacherToken(
  token: string
): Promise<DecodedIdToken> {
  try {
    return await getAdminAuth()
      .verifyIdToken(
        token
      );
  } catch {
    throw new ApiError(
      "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      401,
      {
        code:
          "INVALID_AUTH_TOKEN",
      }
    );
  }
}

async function loadTeacherProfile(
  email: string
): Promise<TeacherProfileDocument> {
  const teacherDocument =
    await getAdminDb()
      .collection(
        "teachers"
      )
      .doc(
        email
      )
      .get();

  if (
    !teacherDocument.exists
  ) {
    throw new ApiError(
      "Email này chưa được cấp quyền giáo viên.",
      403,
      {
        code:
          "TEACHER_NOT_AUTHORIZED",
      }
    );
  }

  return (
    teacherDocument.data() ??
    {}
  ) as TeacherProfileDocument;
}

export async function getCurrentTeacher(
  request: Request
): Promise<CurrentTeacher> {
  const token =
    extractBearerToken(
      request
    );

  if (!token) {
    throw new ApiError(
      "Bạn chưa đăng nhập.",
      401,
      {
        code:
          "AUTH_TOKEN_REQUIRED",
      }
    );
  }

  const decodedToken =
    await verifyTeacherToken(
      token
    );

  const uid =
    safeString(
      decodedToken.uid
    );

  const email =
    normalizeEmail(
      decodedToken.email
    );

  if (
    !uid ||
    !email
  ) {
    throw new ApiError(
      "Không xác định được tài khoản giáo viên.",
      401,
      {
        code:
          "TEACHER_IDENTITY_MISSING",
      }
    );
  }

  const teacherProfile =
    await loadTeacherProfile(
      email
    );

  if (
    teacherProfile.status !==
    "active"
  ) {
    throw new ApiError(
      "Tài khoản giáo viên này đang bị khóa.",
      403,
      {
        code:
          "TEACHER_ACCOUNT_LOCKED",
      }
    );
  }

  const role: TeacherRole =
    teacherProfile.role ===
    "admin"
      ? "admin"
      : "teacher";

  return {
    uid,

    email,

    name:
      safeString(
        teacherProfile.name
      ) ||
      safeString(
        decodedToken.name
      ) ||
      email,

    role,

    status:
      "active",

    subject:
      safeString(
        teacherProfile.subject
      ) ||
      undefined,

    schoolId:
      safeString(
        teacherProfile.schoolId
      ) ||
      "fpt",

    picture:
      safeString(
        decodedToken.picture
      ) ||
      undefined,
  };
}

export async function getCurrentAdmin(
  request: Request
): Promise<CurrentTeacher> {
  const teacher =
    await getCurrentTeacher(
      request
    );

  requireAdmin(
    teacher
  );

  return teacher;
}

export function requireAdmin(
  teacher: CurrentTeacher
): void {
  if (
    teacher.role !==
    "admin"
  ) {
    throw new ApiError(
      "Chỉ quản trị viên mới được thực hiện thao tác này.",
      403,
      {
        code:
          "ADMIN_REQUIRED",
      }
    );
  }
}