import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { normalizeSubjectName } from "@/lib/subjects";

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

function normalizeSubject(value: unknown): string {
  const subject = normalizeSubjectName(
    safeString(value).slice(0, 60)
  );

  return subject || "Khác";
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
    googleName: decoded.name || "",
    picture: decoded.picture || "",
  };
}

export async function POST(request: Request) {
  try {
    const googleUser = await getGoogleUserFromRequest(request);

    if (!isAllowedSchoolEmail(googleUser.email)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Chỉ email @fpt.edu.vn được phép đăng ký giáo viên.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = safeString(body.name);
    const subject = normalizeSubject(body.subject);

    if (!name) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng nhập họ và tên giáo viên.",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const teacherRef = db.collection("teachers").doc(googleUser.email);
    const teacherDoc = await teacherRef.get();

    if (teacherDoc.exists) {
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
          email: teacher.email || googleUser.email,
          name: teacher.name || name,
          role: teacher.role || "teacher",
          status: teacher.status || "active",
          subject: normalizeSubjectName(
            teacher.subject || subject
          ),
          schoolId: teacher.schoolId || "fpt",
          picture: teacher.picture || googleUser.picture || "",
          createdAt: teacher.createdAt || "",
          updatedAt: teacher.updatedAt || "",
        },
        message: "Hồ sơ giáo viên đã tồn tại.",
      });
    }

    const now = new Date().toISOString();

    const teacherData = {
      email: googleUser.email,
      name,
      role: "teacher",
      status: "active",
      subject,
      schoolId: "fpt",
      provider: "google",
      uid: googleUser.uid,
      picture: googleUser.picture,
      createdAt: now,
      updatedAt: now,
      createdBy: "self-register",
    };

    await teacherRef.set(teacherData);

    return NextResponse.json({
      status: "success",
      teacher: teacherData,
      message: "Đã hoàn tất đăng ký giáo viên.",
    });
  } catch (error: any) {
    console.error("POST /api/teacher/register error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không đăng ký được giáo viên.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
