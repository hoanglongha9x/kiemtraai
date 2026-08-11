import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const ALLOWED_EMAIL_DOMAIN = "@fpt.edu.vn";

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return safeString(value).toLowerCase();
}

function isAllowedSchoolEmail(email: string) {
  return email.endsWith(ALLOWED_EMAIL_DOMAIN);
}

async function getGoogleUserFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    const error: any = new Error("Bạn chưa đăng nhập.");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const decoded = await getAdminAuth().verifyIdToken(token);

  const email = normalizeEmail(decoded.email);

  if (!email) {
    const error: any = new Error("Không xác định được email Google.");
    error.statusCode = 401;
    throw error;
  }

  return {
    uid: decoded.uid,
    email,
    name: decoded.name || "",
    picture: decoded.picture || "",
  };
}

export async function GET(request: Request) {
  try {
    const googleUser = await getGoogleUserFromRequest(request);

    const db = getAdminDb();
    const teacherDoc = await db
      .collection("teachers")
      .doc(googleUser.email)
      .get();

    if (!teacherDoc.exists) {
      if (!isAllowedSchoolEmail(googleUser.email)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Chỉ email @fpt.edu.vn được phép sử dụng hệ thống.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json({
        status: "needs_registration",
        email: googleUser.email,
        name: googleUser.name || "",
        picture: googleUser.picture || "",
        message: "Vui lòng hoàn tất hồ sơ giáo viên.",
      });
    }

    const teacher = teacherDoc.data() || {};

    if (teacher.status !== "active") {
      return NextResponse.json(
        {
          status: "error",
          message: "Tài khoản giáo viên của bạn đang bị khóa.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: "success",
      teacher: {
        uid: teacher.uid || googleUser.uid,
        email: teacher.email || googleUser.email,
        name: teacher.name || googleUser.name || googleUser.email,
        role: teacher.role || "teacher",
        status: teacher.status || "active",
        subject: teacher.subject || "",
        schoolId: teacher.schoolId || "fpt",
        picture: teacher.picture || googleUser.picture || "",
        createdAt: teacher.createdAt || "",
        updatedAt: teacher.updatedAt || "",
      },
    });
  } catch (error: any) {
    console.error("GET /api/teacher/me error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được thông tin giáo viên.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}