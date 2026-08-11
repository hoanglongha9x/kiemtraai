import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentTeacher } from "@/server/auth/teacherAuth";

export const runtime = "nodejs";

type TeacherProfile = {
  email: string;
  name: string;
  role: "admin" | "teacher";
  status: "active" | "locked";
  schoolId?: string;
};

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function canAccessClass(teacher: TeacherProfile, classData: any): boolean {
  const classTeacherEmail = safeString(classData.teacherEmail).toLowerCase();

  return classTeacherEmail === teacher.email;
}

async function getStudentCount(classId: string): Promise<number> {
  const db = getAdminDb();

  const snapshot = await db
    .collection("students")
    .where("classId", "==", classId)
    .get();

  return snapshot.docs.filter((doc) => {
    const data = doc.data();
    return data.status !== "deleted";
  }).length;
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const db = getAdminDb();

    const snapshot = await db
      .collection("classes")
      .where("teacherEmail", "==", teacher.email)
      .get();

    const classesRaw = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item: any) => item.status !== "deleted")
      .filter((item: any) => canAccessClass(teacher, item))
      .sort((a: any, b: any) =>
        String(a.className || "").localeCompare(String(b.className || ""))
      );

    const classes = await Promise.all(
      classesRaw.map(async (item: any) => ({
        ...item,
        studentCount: await getStudentCount(item.id),
      }))
    );

    return NextResponse.json({
      status: "success",
      classes,
    });
  } catch (error: any) {
    console.error("GET /api/teacher/classes error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được danh sách lớp.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();

    const className = safeString(body.className);
    const grade = safeString(body.grade);
    const schoolYear = safeString(body.schoolYear);

    if (!className) {
      throw new ApiError("Vui lòng nhập tên lớp.", 400);
    }

    if (!grade) {
      throw new ApiError("Vui lòng nhập khối lớp.", 400);
    }

    const db = getAdminDb();
    const now = new Date().toISOString();

    const duplicateSnapshot = await db
      .collection("classes")
      .where("className", "==", className)
      .where("grade", "==", grade)
      .where("schoolYear", "==", schoolYear)
      .get();

    const hasActiveDuplicate = duplicateSnapshot.docs.some((doc) => {
      const data = doc.data();

      if (data.status === "deleted") return false;
      if (!canAccessClass(teacher, data)) return false;

      return true;
    });

    if (hasActiveDuplicate) {
      throw new ApiError(
        `Lớp ${className} - Khối ${grade} - Năm học ${schoolYear} đã tồn tại. Nếu bị trùng, hãy xóa lớp trùng trước.`,
        409
      );
    }

    const classRef = db.collection("classes").doc();

    const classData = {
      className,
      grade,
      schoolYear:
        schoolYear ||
        `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,

      teacherEmail: teacher.email,
      teacherName: teacher.name,
      schoolId: teacher.schoolId || "fpt",

      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: teacher.email,
      updatedBy: teacher.email,
    };

    await classRef.set(classData);

    return NextResponse.json({
      status: "success",
      classId: classRef.id,
      classItem: {
        id: classRef.id,
        ...classData,
        studentCount: 0,
      },
      message: "Đã tạo lớp thành công.",
    });
  } catch (error: any) {
    console.error("POST /api/teacher/classes error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tạo được lớp.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();

    const action = safeString(body.action);
    const classId = safeString(body.classId);

    if (!classId) {
      throw new ApiError("Thiếu classId.", 400);
    }

    const db = getAdminDb();
    const classRef = db.collection("classes").doc(classId);
    const classDoc = await classRef.get();

    if (!classDoc.exists) {
      throw new ApiError("Không tìm thấy lớp.", 404);
    }

    const classData = classDoc.data() || {};

    if (!canAccessClass(teacher, classData)) {
      throw new ApiError("Bạn không có quyền chỉnh sửa lớp này.", 403);
    }

    if (classData.status === "deleted") {
      throw new ApiError("Lớp này đã bị xóa.", 403);
    }

    const now = new Date().toISOString();

    if (action === "delete") {
      await classRef.update({
        status: "deleted",
        deletedAt: now,
        deletedBy: teacher.email,
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        message: `Đã xóa lớp ${classData.className || ""}.`,
      });
    }

    if (action === "lock") {
      await classRef.update({
        status: "locked",
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        message: `Đã khóa lớp ${classData.className || ""}.`,
      });
    }

    if (action === "unlock") {
      await classRef.update({
        status: "active",
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        message: `Đã mở khóa lớp ${classData.className || ""}.`,
      });
    }

    if (action === "update") {
      const className = safeString(body.className);
      const grade = safeString(body.grade);
      const schoolYear = safeString(body.schoolYear);

      if (!className) {
        throw new ApiError("Vui lòng nhập tên lớp.", 400);
      }

      if (!grade) {
        throw new ApiError("Vui lòng nhập khối lớp.", 400);
      }

      if (!schoolYear) {
        throw new ApiError("Vui lòng nhập năm học.", 400);
      }

      await classRef.update({
        className,
        grade,
        schoolYear,
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        message: `Đã cập nhật lớp ${className}.`,
      });
    }

    throw new ApiError("Action không hợp lệ.", 400);
  } catch (error: any) {
    console.error("PATCH /api/teacher/classes error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không cập nhật được lớp.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
