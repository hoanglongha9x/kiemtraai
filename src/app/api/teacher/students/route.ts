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

function normalizeStudentCode(value: unknown): string {
  return safeString(value).toUpperCase();
}

function canAccessTeacherData(
  teacher: TeacherProfile,
  ownerEmail: unknown,
  schoolId: unknown
): boolean {
  const owner = safeString(ownerEmail).toLowerCase();

  return Boolean(owner && owner === teacher.email);
}

function canAccessStudent(teacher: TeacherProfile, studentData: any): boolean {
  return canAccessTeacherData(
    teacher,
    studentData.teacherEmail,
    studentData.schoolId
  );
}

async function getClassForTeacher(classId: string, teacher: TeacherProfile) {
  const db = getAdminDb();

  const classDoc = await db.collection("classes").doc(classId).get();

  if (!classDoc.exists) {
    throw new ApiError("Không tìm thấy lớp.", 404);
  }

  const classData = classDoc.data()!;

  if (classData.status !== "active") {
    throw new ApiError("Lớp này hiện đang bị khóa.", 403);
  }

  if (!canAccessTeacherData(teacher, classData.teacherEmail, classData.schoolId)) {
    throw new ApiError("Bạn không có quyền thao tác với lớp này.", 403);
  }

  return {
    id: classDoc.id,
    ...classData,
  };
}

export async function GET(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const db = getAdminDb();

    const url = new URL(request.url);
    const classId = safeString(url.searchParams.get("classId"));

    let snapshot;

    if (classId) {
      await getClassForTeacher(classId, teacher);

      snapshot = await db
        .collection("students")
        .where("classId", "==", classId)
        .get();
    } else {
      snapshot = await db
        .collection("students")
        .where("teacherEmail", "==", teacher.email)
        .get();
    }

    const students = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item: any) => item.status !== "deleted")
      .sort((a: any, b: any) =>
        String(a.studentName || "").localeCompare(String(b.studentName || ""))
      );

    return NextResponse.json({
      status: "success",
      students,
    });
  } catch (error: any) {
    console.error("GET /api/teacher/students error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không tải được danh sách học sinh.",
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
    const studentId = safeString(body.studentId);

    if (!studentId) {
      throw new ApiError("Thiếu studentId.", 400);
    }

    const db = getAdminDb();
    const studentRef = db.collection("students").doc(studentId);
    const studentDoc = await studentRef.get();

    if (!studentDoc.exists) {
      throw new ApiError("Không tìm thấy học sinh.", 404);
    }

    const studentData = studentDoc.data() || {};

    if (!canAccessStudent(teacher, studentData)) {
      throw new ApiError("Bạn không có quyền cập nhật học sinh này.", 403);
    }

    if (studentData.status === "deleted") {
      throw new ApiError("Học sinh này đã bị xóa.", 403);
    }

    const now = new Date().toISOString();

    if (action === "lock") {
      await studentRef.update({
        status: "locked",
        lockedReason: "transfer_school",
        lockedReasonText: "Học sinh chuyển trường",
        lockedAt: now,
        lockedBy: teacher.email,
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        message: `Đã khóa học sinh ${studentData.studentName || ""} do chuyển trường.`,
      });
    }

    if (action === "unlock") {
      await studentRef.update({
        status: "active",
        lockedReason: "",
        lockedReasonText: "",
        unlockedAt: now,
        unlockedBy: teacher.email,
        updatedAt: now,
        updatedBy: teacher.email,
      });

      return NextResponse.json({
        status: "success",
        message: `Đã mở khóa học sinh ${studentData.studentName || ""}.`,
      });
    }

    if (action === "transfer") {
      const targetClassId = safeString(body.targetClassId);

      if (!targetClassId) {
        throw new ApiError("Vui lòng chọn lớp học sinh sẽ chuyển đến.", 400);
      }

      if (targetClassId === safeString(studentData.classId)) {
        throw new ApiError("Lớp chuyển đến phải khác lớp hiện tại.", 400);
      }

      const targetClass: any = await getClassForTeacher(targetClassId, teacher);
      const studentCode = normalizeStudentCode(studentData.studentCode);

      const duplicateSnap = await db
        .collection("students")
        .where("classId", "==", targetClassId)
        .where("studentCode", "==", studentCode)
        .get();

      const hasDuplicate = duplicateSnap.docs.some((doc) => {
        if (doc.id === studentId) return false;
        const data = doc.data();
        return data.status !== "deleted";
      });

      if (hasDuplicate) {
        throw new ApiError(
          `Lớp ${targetClass.className || ""} đã có mã học sinh ${studentCode}.`,
          409
        );
      }

      const previousClass = {
        classId: safeString(studentData.classId),
        className: safeString(studentData.className),
        transferredAt: now,
        transferredBy: teacher.email,
      };

      const updateData = {
        classId: targetClassId,
        className: safeString(targetClass.className),
        grade: safeString(targetClass.grade),
        schoolYear: safeString(targetClass.schoolYear),
        status: "active",
        transferReason: "transfer_class",
        transferReasonText: "Học sinh chuyển lớp",
        previousClass,
        updatedAt: now,
        updatedBy: teacher.email,
      };

      const batch = db.batch();

      batch.update(studentRef, updateData);

      const relatedCollections = ["examAttempts", "results"];

      for (const collectionName of relatedCollections) {
        const relatedSnap = await db
          .collection(collectionName)
          .where("studentId", "==", studentId)
          .get();

        relatedSnap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            classId: targetClassId,
            className: safeString(targetClass.className),
            studentTransfer: {
              fromClassId: previousClass.classId,
              fromClassName: previousClass.className,
              toClassId: targetClassId,
              toClassName: safeString(targetClass.className),
              transferredAt: now,
              transferredBy: teacher.email,
            },
            updatedAt: now,
          });
        });
      }

      await batch.commit();

      return NextResponse.json({
        status: "success",
        message: `Đã chuyển học sinh ${studentData.studentName || ""} sang lớp ${
          targetClass.className || ""
        }.`,
      });
    }

    throw new ApiError("Action không hợp lệ.", 400);
  } catch (error: any) {
    console.error("PATCH /api/teacher/students error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không cập nhật được học sinh.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const teacher = await getCurrentTeacher(request);
    const body = await request.json();

    const classId = safeString(body.classId);

    if (!classId) {
      throw new ApiError("Vui lòng chọn lớp.", 400);
    }

    const classItem: any = await getClassForTeacher(classId, teacher);

    const rawStudents = Array.isArray(body.students)
      ? body.students
      : [
          {
            studentCode: body.studentCode,
            studentName: body.studentName,
            gender: body.gender,
          },
        ];

    if (rawStudents.length === 0) {
      throw new ApiError("Vui lòng nhập ít nhất 1 học sinh.", 400);
    }

    if (rawStudents.length > 200) {
      throw new ApiError("Chỉ nên thêm tối đa 200 học sinh mỗi lần.", 400);
    }

    const cleanedStudents = rawStudents.map((item: any, index: number) => {
      const studentCode = normalizeStudentCode(item.studentCode);
      const studentName = safeString(item.studentName);
      const gender = safeString(item.gender);

      if (!studentCode) {
        throw new ApiError(`Dòng ${index + 1}: thiếu mã học sinh.`, 400);
      }

      if (!studentName) {
        throw new ApiError(`Dòng ${index + 1}: thiếu tên học sinh.`, 400);
      }

      return {
        studentCode,
        studentName,
        gender,
      };
    });

    const codeSet = new Set<string>();

    for (const student of cleanedStudents) {
      if (codeSet.has(student.studentCode)) {
        throw new ApiError(
          `Mã học sinh bị trùng trong danh sách nhập: ${student.studentCode}`,
          400
        );
      }

      codeSet.add(student.studentCode);
    }

    const db = getAdminDb();

    for (const student of cleanedStudents) {
      const duplicateSnap = await db
        .collection("students")
        .where("classId", "==", classId)
        .where("studentCode", "==", student.studentCode)
        .limit(1)
        .get();

      if (!duplicateSnap.empty) {
        throw new ApiError(
          `Mã học sinh ${student.studentCode} đã tồn tại trong lớp này.`,
          400
        );
      }
    }

    const now = new Date().toISOString();
    const batch = db.batch();

    const createdStudents: any[] = [];

    for (const student of cleanedStudents) {
      const studentRef = db.collection("students").doc();

      const studentData = {
        studentCode: student.studentCode,
        studentName: student.studentName,
        gender: student.gender,

        classId,
        className: classItem.className || "",

        teacherEmail: teacher.email,
        teacherName: teacher.name,
        schoolId: teacher.schoolId || "fpt",

        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      batch.set(studentRef, studentData);

      createdStudents.push({
        id: studentRef.id,
        ...studentData,
      });
    }

    await batch.commit();

    return NextResponse.json({
      status: "success",
      count: createdStudents.length,
      students: createdStudents,
      message:
        createdStudents.length === 1
          ? "Đã thêm học sinh thành công."
          : `Đã thêm ${createdStudents.length} học sinh thành công.`,
    });
  } catch (error: any) {
    console.error("POST /api/teacher/students error:", error);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Không thêm được học sinh.",
      },
      { status: error?.statusCode || 500 }
    );
  }
}
