import {
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import {
  getCurrentTeacher,
  type CurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  isApiError,
} from "@/server/http/apiError";

import type {
  TestData,
} from "@/features/tests/types";

export const runtime =
  "nodejs";


type AssignmentTestOption = {
  id: string;

  title: string;

  subject: string;

  grade: string;

  durationMinutes: number;

  totalQuestions: number;

  totalScore: number;

  versionNumber: number;

  publishedAt?: string;
};

type AssignmentClassOption = {
  id: string;

  className: string;

  grade: string;

  schoolYear: string;

  studentCount: number;
};

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

function canAdminAccessSchool(
  teacher: CurrentTeacher,
  schoolIdValue: unknown
): boolean {
  if (
    teacher.role !==
    "admin"
  ) {
    return false;
  }

  const schoolId =
    safeString(
      schoolIdValue
    );

  return (
    !schoolId ||
    schoolId ===
      "default" ||
    schoolId ===
      teacher.schoolId
  );
}

function canAccessTest(
  teacher: CurrentTeacher,
  test: TestData
): boolean {
  if (
    teacher.role ===
    "admin"
  ) {
    return canAdminAccessSchool(
      teacher,
      test.owner?.schoolId
    );
  }

  return (
    safeString(
      test.owner?.uid
    ) ===
    teacher.uid
  );
}

function canAccessClass(
  teacher: CurrentTeacher,
  data:
    Record<
      string,
      unknown
    >
): boolean {
  if (
    teacher.role ===
    "admin"
  ) {
    return canAdminAccessSchool(
      teacher,
      data.schoolId
    );
  }

  return (
    normalizeEmail(
      data.teacherEmail
    ) ===
    teacher.email
  );
}

async function getStudentCount(
  classId: string
): Promise<number> {
  const snapshot =
    await getAdminDb()
      .collection(
        "students"
      )
      .where(
        "classId",
        "==",
        classId
      )
      .get();

  return snapshot.docs.filter(
    (
      document
    ) =>
      document.data()
        .status !==
      "deleted"
  ).length;
}

async function loadPublishedTests(
  teacher: CurrentTeacher
): Promise<
  AssignmentTestOption[]
> {
  const db =
    getAdminDb();

  const snapshot =
    teacher.role ===
    "admin"
      ? await db
          .collection(
            "tests"
          )
          .where(
            "status",
            "==",
            "published"
          )
          .get()
      : await db
          .collection(
            "tests"
          )
          .where(
            "owner.uid",
            "==",
            teacher.uid
          )
          .where(
            "status",
            "==",
            "published"
          )
          .get();

  return snapshot.docs
    .map(
      (
        document
      ) => ({
        id:
          document.id,

        ...document.data(),
      }) as TestData
    )
    .filter(
      (
        test
      ) =>
        canAccessTest(
          teacher,
          test
        )
    )
    .filter(
      (
        test
      ) =>
        test.version
          ?.status ===
        "published"
    )
    .map(
      (
        test
      ): AssignmentTestOption => ({
        id:
          test.id,

        title:
          safeString(
            test.title
          ) ||
          "Đề chưa đặt tên",

        subject:
          safeString(
            test.metadata
              ?.subject
          ),

        grade:
          safeString(
            test.metadata
              ?.grade
          ),

        durationMinutes:
          Number(
            test.durationMinutes ||
              0
          ),

        totalQuestions:
          Number(
            test.totalQuestions ||
              0
          ),

        totalScore:
          Number(
            test.totalScore ||
              0
          ),

        versionNumber:
          Number(
            test.version
              ?.number ||
              1
          ),

        publishedAt:
          safeString(
            test.publishedAt ??
              test.version
                ?.publishedAt
          ) ||
          undefined,
      })
    )
    .sort(
      (
        first,
        second
      ) =>
        String(
          second.publishedAt ??
            ""
        ).localeCompare(
          String(
            first.publishedAt ??
              ""
          )
        )
    );
}

async function loadActiveClasses(
  teacher: CurrentTeacher
): Promise<
  AssignmentClassOption[]
> {
  const db =
    getAdminDb();

  const snapshot =
    teacher.role ===
    "admin"
      ? await db
          .collection(
            "classes"
          )
          .get()
      : await db
          .collection(
            "classes"
          )
          .where(
            "teacherEmail",
            "==",
            teacher.email
          )
          .get();

  const accessibleClasses =
    snapshot.docs
      .map(
        (
          document
        ) => ({
          id:
            document.id,

          data:
            document.data() as
              Record<
                string,
                unknown
              >,
        })
      )
      .filter(
        (
          item
        ) =>
          item.data.status ===
          "active"
      )
      .filter(
        (
          item
        ) =>
          canAccessClass(
            teacher,
            item.data
          )
      );

  const classes =
    await Promise.all(
      accessibleClasses.map(
        async (
          item
        ): Promise<AssignmentClassOption> => ({
          id:
            item.id,

          className:
            safeString(
              item.data
                .className
            ) ||
            item.id,

          grade:
            safeString(
              item.data.grade
            ),

          schoolYear:
            safeString(
              item.data
                .schoolYear
            ),

          studentCount:
            await getStudentCount(
              item.id
            ),
        })
      )
    );

  return classes.sort(
    (
      first,
      second
    ) =>
      first.className.localeCompare(
        second.className,
        "vi"
      )
  );
}

export async function GET(
  request: Request
) {
  try {
    const teacher =
      await getCurrentTeacher(
        request
      );

    const [
      tests,
      classes,
    ] =
      await Promise.all([
        loadPublishedTests(
          teacher
        ),

        loadActiveClasses(
          teacher
        ),
      ]);

    return NextResponse.json({
      status:
        "success",

      tests,

      classes,
    });
  } catch (
    error: unknown
  ) {
    console.error(
      "GET /api/teacher/assignments/options error:",
      error
    );

    const statusCode =
      isApiError(error)
        ? error.statusCode
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Không tải được dữ liệu tạo lượt giao đề.";

    return NextResponse.json(
      {
        status:
          "error",

        message,
      },
      {
        status:
          statusCode,
      }
    );
  }
}