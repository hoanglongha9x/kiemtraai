import type {
  DocumentData,
  DocumentReference,
} from "firebase-admin/firestore";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import type {
  CurrentTeacher,
} from "@/server/auth/teacherAuth";

import {
  canViewTest,
} from "@/server/tests/testPermissions";

export type StoredTestDocument = {
  id: string;

  data: Record<
    string,
    unknown
  >;
};

function mergeDocuments(
  documents:
    StoredTestDocument[]
): StoredTestDocument[] {
  const documentMap =
    new Map<
      string,
      StoredTestDocument
    >();

  documents.forEach(
    (
      document
    ) => {
      documentMap.set(
        document.id,
        document
      );
    }
  );

  return Array.from(
    documentMap.values()
  );
}

export function createTestReference(): DocumentReference {
  return getAdminDb()
    .collection(
      "tests"
    )
    .doc();
}

export async function saveTest(
  reference:
    DocumentReference,
  data:
    DocumentData
): Promise<void> {
  await reference.set(
    data
  );
}

export async function getTestById(
  testId: string
): Promise<StoredTestDocument | null> {
  const document =
    await getAdminDb()
      .collection(
        "tests"
      )
      .doc(
        testId
      )
      .get();

  if (
    !document.exists
  ) {
    return null;
  }

  return {
    id:
      document.id,

    data:
      document.data() as Record<
        string,
        unknown
      >,
  };
}

async function listTeacherOwnedTests(
  teacher:
    CurrentTeacher
): Promise<StoredTestDocument[]> {
  const collection =
    getAdminDb()
      .collection(
        "tests"
      );

  const [
    ownerSnapshot,
    legacySnapshot,
  ] =
    await Promise.all([
      collection
        .where(
          "owner.uid",
          "==",
          teacher.uid
        )
        .get(),

      collection
        .where(
          "teacherEmail",
          "==",
          teacher.email
        )
        .get(),
    ]);

  return mergeDocuments([
    ...ownerSnapshot.docs.map(
      (
        document
      ) => ({
        id:
          document.id,

        data:
          document.data() as Record<
            string,
            unknown
          >,
      })
    ),

    ...legacySnapshot.docs.map(
      (
        document
      ) => ({
        id:
          document.id,

        data:
          document.data() as Record<
            string,
            unknown
          >,
      })
    ),
  ]);
}

async function listAdminSchoolTests(
  teacher:
    CurrentTeacher
): Promise<StoredTestDocument[]> {
  /*
   * Tạm thời đọc toàn bộ để hỗ trợ đồng thời:
   * - schema mới: owner.schoolId
   * - schema cũ: schoolId
   * - dữ liệu cũ thiếu schoolId
   *
   * Sau khi migration hoàn tất, có thể đổi sang query
   * owner.schoolId để tối ưu.
   */
  const snapshot =
    await getAdminDb()
      .collection(
        "tests"
      )
      .get();

  return snapshot.docs
    .map(
      (
        document
      ) => ({
        id:
          document.id,

        data:
          document.data() as Record<
            string,
            unknown
          >,
      })
    )
    .filter(
      (
        document
      ) =>
        canViewTest(
          teacher,
          document.data
        )
    );
}

export async function listAccessibleTests(
  teacher:
    CurrentTeacher
): Promise<StoredTestDocument[]> {
  const documents =
    await listTeacherOwnedTests(
      teacher
    );

  return documents.filter(
    (
      document
    ) =>
      canViewTest(
        teacher,
        document.data
      )
  );
}

export async function updateTestById(
  testId: string,
  data: DocumentData
): Promise<void> {
  await getAdminDb()
    .collection("tests")
    .doc(testId)
    .update(data);
}

export async function testExists(
  testId: string
): Promise<boolean> {
  const document =
    await getAdminDb()
      .collection("tests")
      .doc(testId)
      .get();

  return document.exists;
}

export async function replaceTestById(
  testId: string,
  data: DocumentData
): Promise<void> {
  await getAdminDb()
    .collection("tests")
    .doc(testId)
    .set(data, {
      merge: true,
    });
}
