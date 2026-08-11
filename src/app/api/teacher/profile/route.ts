import {
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  getCurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  getApiErrorResponse,
} from "@/server/http/apiError";

import {
  normalizeSubjectName,
} from "@/lib/subjects";

export const runtime =
  "nodejs";

const ALLOWED_SUBJECTS = [
  "Toán",
  "Lý",
  "Hóa",
  "Sinh",
  "Tin học",
  "Văn",
  "Sử",
  "Địa",
  "Tiếng Anh",
  "Khác",
] as const;

type TeacherSubject =
  (typeof ALLOWED_SUBJECTS)[number];

function safeString(
  value: unknown
): string {
  return String(
    value ?? ""
  ).trim();
}

function normalizeEmail(
  value: unknown
): string {
  return safeString(
    value
  ).toLowerCase();
}

function normalizeSubject(
  value: unknown
): string {
  const subject =
    normalizeSubjectName(
      safeString(value).slice(0, 60)
    );

  return subject || "Khác";
}

function serializeTeacher(
  teacher: Record<
    string,
    unknown
  >,
  fallback: {
    uid: string;
    email: string;
    picture?: string;
  }
) {
  return {
    uid:
      safeString(
        teacher.uid
      ) || fallback.uid,

    email:
      normalizeEmail(
        teacher.email
      ) || fallback.email,

    name:
      safeString(
        teacher.name
      ),

    role:
      teacher.role ===
      "admin"
        ? "admin"
        : "teacher",

    status:
      teacher.status ===
      "locked"
        ? "locked"
        : "active",

    subject:
      normalizeSubject(
        teacher.subject
      ),

    schoolId:
      safeString(
        teacher.schoolId
      ) || "fpt",

    picture:
      safeString(
        teacher.picture
      ) ||
      fallback.picture,

    createdAt:
      safeString(
        teacher.createdAt
      ),

    updatedAt:
      safeString(
        teacher.updatedAt
      ),
  };
}

export async function GET(
  request: Request
) {
  try {
    const user =
      await getCurrentTeacher(
        request
      );

    const teacherDoc =
      await getAdminDb()
        .collection(
          "teachers"
        )
        .doc(user.email)
        .get();

    const teacher =
      teacherDoc.data() || {};

    return NextResponse.json({
      status: "success",
      teacher:
        serializeTeacher(
          teacher,
          user
        ),
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/teacher/profile error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không tải được hồ sơ giáo viên."
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const user =
      await getCurrentTeacher(
        request
      );

    const body =
      await request.json();

    const name =
      safeString(
        body?.name
      );

    const subject =
      normalizeSubject(
        body?.subject
      );

    if (!name) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Vui lòng nhập họ và tên giáo viên.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      name.length < 2
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Họ và tên phải có ít nhất 2 ký tự.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      name.length > 100
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Họ và tên không được vượt quá 100 ký tự.",
        },
        {
          status: 400,
        }
      );
    }

    const teacherRef =
      getAdminDb()
        .collection(
          "teachers"
        )
        .doc(user.email);

    const teacherDoc =
      await teacherRef.get();

    if (
      !teacherDoc.exists
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Không tìm thấy hồ sơ giáo viên.",
        },
        {
          status: 404,
        }
      );
    }

    const currentTeacher =
      teacherDoc.data() || {};

    if (
      currentTeacher.status !==
      "active"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Tài khoản giáo viên đang bị khóa.",
        },
        {
          status: 403,
        }
      );
    }

    const now =
      new Date().toISOString();

    const updateData = {
      name,
      subject,
      picture:
        safeString(
          currentTeacher.picture
        ) ||
        user.picture,
      uid:
        safeString(
          currentTeacher.uid
        ) ||
        user.uid,
      updatedAt: now,
    };

    await teacherRef.update(
      updateData
    );

    const updatedTeacher = {
      ...currentTeacher,
      ...updateData,
    };

    return NextResponse.json({
      status: "success",
      teacher:
        serializeTeacher(
          updatedTeacher,
          user
        ),
      message:
        "Đã cập nhật hồ sơ giáo viên.",
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "PATCH /api/teacher/profile error:",
      error
    );

    return getApiErrorResponse(
      error,
      "Không cập nhật được hồ sơ giáo viên."
    );
  }
}
