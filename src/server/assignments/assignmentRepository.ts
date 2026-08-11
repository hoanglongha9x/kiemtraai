import type {
  DocumentData,
  DocumentReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import {
  getAdminDb,
} from "@/lib/firebase/admin";

import type {
  CurrentTeacher,
} from "@/server/auth/teacherAuth";

import type {
  StoredAssignmentDocument,
} from "./assignmentTypes";

function mapDocument(
  document: QueryDocumentSnapshot<DocumentData>
): StoredAssignmentDocument {
  return {
    id: document.id,

    data:
      document.data() as Record<
        string,
        unknown
      >,
  };
}

function mergeDocuments(
  documents: StoredAssignmentDocument[]
): StoredAssignmentDocument[] {
  const map =
    new Map<
      string,
      StoredAssignmentDocument
    >();

  documents.forEach(
    (
      document
    ) => {
      map.set(
        document.id,
        document
      );
    }
  );

  return Array.from(
    map.values()
  );
}

export function createAssignmentReference(): DocumentReference {
  return getAdminDb()
    .collection(
      "assignments"
    )
    .doc();
}

export async function saveAssignment(
  reference: DocumentReference,
  data: DocumentData
): Promise<void> {
  await reference.set(
    data
  );
}

export async function getAssignmentById(
  assignmentId: string
): Promise<StoredAssignmentDocument | null> {
  const document =
    await getAdminDb()
      .collection(
        "assignments"
      )
      .doc(
        assignmentId
      )
      .get();

  if (
    !document.exists
  ) {
    return null;
  }

  return {
  id: document.id,

  data:
    document.data() as Record<
      string,
      unknown
    >,
};
}

export async function getAssignmentByCode(
  assignmentCode: string
): Promise<StoredAssignmentDocument | null> {
  const snapshot =
    await getAdminDb()
      .collection(
        "assignments"
      )
      .where(
        "assignmentCode",
        "==",
        assignmentCode
      )
      .limit(1)
      .get();

  if (
    snapshot.empty
  ) {
    return null;
  }

  return mapDocument(
    snapshot.docs[0]
  );
}

export async function assignmentCodeExists(
  assignmentCode: string
): Promise<boolean> {
  const snapshot =
    await getAdminDb()
      .collection(
        "assignments"
      )
      .where(
        "assignmentCode",
        "==",
        assignmentCode
      )
      .limit(1)
      .get();

  return !snapshot.empty;
}

export async function updateAssignmentById(
  assignmentId: string,
  data: DocumentData
): Promise<void> {
  await getAdminDb()
    .collection(
      "assignments"
    )
    .doc(
      assignmentId
    )
    .update(
      data
    );
}

async function listTeacherAssignments(
  teacher: CurrentTeacher
): Promise<StoredAssignmentDocument[]> {
  const collection =
    getAdminDb()
      .collection(
        "assignments"
      );

  const [
    creatorUidSnapshot,
    creatorEmailSnapshot,
    legacyEmailSnapshot,
  ] =
    await Promise.all([
      collection
        .where(
          "creator.uid",
          "==",
          teacher.uid
        )
        .get(),

      collection
        .where(
          "creator.email",
          "==",
          teacher.email
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
    ...creatorUidSnapshot.docs.map(
      mapDocument
    ),

    ...creatorEmailSnapshot.docs.map(
      mapDocument
    ),

    ...legacyEmailSnapshot.docs.map(
      mapDocument
    ),
  ]);
}

async function listAdminAssignments(
  teacher: CurrentTeacher
): Promise<StoredAssignmentDocument[]> {
  const snapshot =
    await getAdminDb()
      .collection(
        "assignments"
      )
      .get();

  return snapshot.docs
    .map(
      mapDocument
    )
    .filter(
      (
        assignment
      ) => {
        const creator =
          assignment.data.creator;

        const creatorRecord =
          creator &&
          typeof creator ===
            "object" &&
          !Array.isArray(
            creator
          )
            ? creator as Record<
                string,
                unknown
              >
            : {};

        const creatorSchoolId =
          String(
            creatorRecord.schoolId ??
              assignment.data.schoolId ??
              "fpt"
          ).trim();

        return (
          creatorSchoolId ===
            teacher.schoolId ||
          (
            creatorSchoolId ===
              "default" &&
            teacher.schoolId ===
              "fpt"
          )
        );
      }
    );
}

export async function listAccessibleAssignments(
  teacher: CurrentTeacher
): Promise<StoredAssignmentDocument[]> {
  return listTeacherAssignments(
    teacher
  );
}
