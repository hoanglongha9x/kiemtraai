import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentAdmin } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type TeacherRole = "admin" | "teacher";
type TeacherStatus = "active" | "locked";

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return safeString(value).toLowerCase();
}


export async function GET(request: Request) {
  try {
    await getCurrentAdmin(request);

    const db = getAdminDb();

    const snapshot = await db
      .collection("teachers")
      .orderBy("createdAt", "desc")
      .get();

    const teachers = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        email: data.email || doc.id,
        name: data.name || "",
        subject: data.subject || "",
        role: data.role || "teacher",
        status: data.status || "active",
        schoolId: data.schoolId || "",
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
      };
    });

    return NextResponse.json({
      status: "success",
      teachers,
    });
  } catch (error: any) {
    console.error("GET /api/admin/teachers error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được danh sách giáo viên.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentAdmin = await getCurrentAdmin(request);

    const body = await request.json();

    const email = normalizeEmail(body.email);
    const name = safeString(body.name);
    const subject = safeString(body.subject || "Toán");

    const role: TeacherRole =
      body.role === "admin" || body.role === "teacher" ? body.role : "teacher";

    const status: TeacherStatus =
      body.status === "locked" || body.status === "active"
        ? body.status
        : "active";

    if (!email) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng nhập email giáo viên.",
        },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        {
          status: "error",
          message: "Email giáo viên không hợp lệ.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          status: "error",
          message: "Vui lòng nhập họ tên giáo viên.",
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = new Date().toISOString();

    const teacherRef = db.collection("teachers").doc(email);
    const existingDoc = await teacherRef.get();

    if (existingDoc.exists) {
      return NextResponse.json(
        {
          status: "error",
          message: "Giáo viên này đã tồn tại trong hệ thống.",
        },
        { status: 409 }
      );
    }

    await teacherRef.set({
      email,
      name,
      subject,
      role,
      status,
      schoolId: currentAdmin.schoolId || "",
      createdAt: now,
      updatedAt: now,
      createdBy: currentAdmin.email,
    });

    return NextResponse.json({
      status: "success",
      teacher: {
        id: email,
        email,
        name,
        subject,
        role,
        status,
        schoolId: currentAdmin.schoolId || "",
        createdAt: now,
        updatedAt: now,
      },
      message: "Đã thêm giáo viên thành công.",
    });
  } catch (error: any) {
    console.error("POST /api/admin/teachers error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không thêm được giáo viên.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const adminDb = getAdminDb();
    const currentAdmin = await getCurrentAdmin(request);

    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const rawAction = String(body.action || "").trim();

    const status = String(body.status || "").trim();
    const role = String(body.role || "").trim();

    let action = rawAction;

    if (!action && status === "locked") {
      action = "lock";
    }

    if (!action && status === "active") {
      action = "unlock";
    }

    if (!action && role === "admin") {
      action = "makeAdmin";
    }

    if (!action && role === "teacher") {
      action = "makeTeacher";
    }

    const validActions = [
      "lock",
      "unlock",
      "makeAdmin",
      "makeTeacher",
      "locked",
      "active",
      "admin",
      "teacher",
    ];

    if (!validActions.includes(action)) {
      return Response.json(
        {
          status: "error",
          message: `Thao tác không hợp lệ: ${rawAction || status || role || "--"}`,
        },
        { status: 400 }
      );
    }

    if (action === "locked") {
      action = "lock";
    }

    if (action === "active") {
      action = "unlock";
    }

    if (action === "admin") {
      action = "makeAdmin";
    }

    if (action === "teacher") {
      action = "makeTeacher";
    }

    if (!email) {
      return Response.json(
        {
          status: "error",
          message: "Thiếu email giáo viên.",
        },
        { status: 400 }
      );
    }

    if (!["lock", "unlock", "makeAdmin", "makeTeacher"].includes(action)) {
      return Response.json(
        {
          status: "error",
          message: "Thao tác không hợp lệ.",
        },
        { status: 400 }
      );
    }

    if (email === currentAdmin.email.toLowerCase()) {
      return Response.json(
        {
          status: "error",
          message: "Bạn không thể tự khóa hoặc tự đổi quyền của chính mình.",
        },
        { status: 400 }
      );
    }

    const teacherRef = adminDb.collection("teachers").doc(email);
    const teacherDoc = await teacherRef.get();

    if (!teacherDoc.exists) {
      return Response.json(
        {
          status: "error",
          message: "Không tìm thấy giáo viên này.",
        },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: currentAdmin.email,
    };

    if (action === "lock") {
      updateData.status = "locked";
    }

    if (action === "unlock") {
      updateData.status = "active";
    }

    if (action === "makeAdmin") {
      updateData.role = "admin";
    }

    if (action === "makeTeacher") {
      updateData.role = "teacher";
    }

    await teacherRef.update(updateData);

    return Response.json({
      status: "success",
      message: "Đã cập nhật giáo viên.",
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/teachers error:", error);

    return Response.json(
      {
        status: "error",
        message: error?.message || "Không cập nhật được giáo viên.",
      },
      { status: 500 }
    );
  }
}