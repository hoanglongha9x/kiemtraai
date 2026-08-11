import {
  normalizeNumber,
  safeString,
} from "@/server/shared/normalize";

import {
  resolveTestOwner,
} from "@/server/tests/testPermissions";

import type {
  QuestionTypeCounts,
  SectionCounts,
  TestSection,
} from "./testTypes";

export type TeacherTestListItem = {
  id: string;

  title: string;

  description: string;

  instructions: string;

  subject: string;

  grade: string;

  duration: number;

  durationMinutes: number;

  totalScore: number;

  totalQuestions: number;

  questionCount: number;

  questionTypeCounts:
    QuestionTypeCounts;

  sectionCounts:
    SectionCounts;

  status: string;

  visibility: string;

  source: string;

  versionNumber: number;

  teacherEmail: string;

  teacherName: string;

  schoolId: string;

  owner: {
    uid: string;

    email: string;

    name: string;

    schoolId: string;
  };

  createdAt: string;

  updatedAt: string;

  publishedAt?: string;
};

function getSections(
  rawData:
    Record<
      string,
      unknown
    >
): TestSection[] {
  if (
    !Array.isArray(
      rawData.sections
    )
  ) {
    return [];
  }

  return rawData.sections as TestSection[];
}

function calculateCountsFromSections(
  sections:
    TestSection[]
): {
  totalQuestions: number;

  questionTypeCounts:
    QuestionTypeCounts;

  sectionCounts:
    SectionCounts;
} {
  const questionTypeCounts:
    QuestionTypeCounts = {
      single_choice: 0,

      true_false_group: 0,

      short_answer: 0,
    };

  const sectionCounts:
    SectionCounts = {
      part_1: 0,

      part_2: 0,

      part_3: 0,
    };

  let totalQuestions =
    0;

  sections.forEach(
    (
      section
    ) => {
      const questions =
        Array.isArray(
          section.questions
        )
          ? section.questions
          : [];

      totalQuestions +=
        questions.length;

      if (
        section.id ===
          "part_1" ||
        section.id ===
          "part_2" ||
        section.id ===
          "part_3"
      ) {
        sectionCounts[
          section.id
        ] +=
          questions.length;
      }

      questions.forEach(
        (
          question
        ) => {
          if (
            question.questionType ===
              "single_choice" ||
            question.questionType ===
              "true_false_group" ||
            question.questionType ===
              "short_answer"
          ) {
            questionTypeCounts[
              question.questionType
            ] += 1;
          }
        }
      );
    }
  );

  return {
    totalQuestions,

    questionTypeCounts,

    sectionCounts,
  };
}

function readObject(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

export function mapTestListItem(
  documentId: string,
  rawData:
    Record<
      string,
      unknown
    >
): TeacherTestListItem {
  const metadata =
    readObject(
      rawData.metadata
    );

  const version =
    readObject(
      rawData.version
    );

  const sections =
    getSections(
      rawData
    );

  const calculated =
    calculateCountsFromSections(
      sections
    );

  /*
   * Fallback cho dữ liệu schema cũ.
   */
  const legacyQuestions =
    Array.isArray(
      rawData.questions
    )
      ? rawData.questions
      : [];

  const totalQuestions =
    normalizeNumber(
      rawData.totalQuestions ??
        rawData.questionCount,
      calculated.totalQuestions ||
        legacyQuestions.length
    );

  const storedQuestionTypeCounts =
    readObject(
      rawData.questionTypeCounts
    );

  const storedSectionCounts =
    readObject(
      rawData.sectionCounts
    );

  const questionTypeCounts:
    QuestionTypeCounts = {
    single_choice:
      normalizeNumber(
        storedQuestionTypeCounts
          .single_choice,
        calculated
          .questionTypeCounts
          .single_choice
      ),

    true_false_group:
      normalizeNumber(
        storedQuestionTypeCounts
          .true_false_group,
        calculated
          .questionTypeCounts
          .true_false_group
      ),

    short_answer:
      normalizeNumber(
        storedQuestionTypeCounts
          .short_answer,
        calculated
          .questionTypeCounts
          .short_answer
      ),
  };

  const sectionCounts:
    SectionCounts = {
    part_1:
      normalizeNumber(
        storedSectionCounts
          .part_1,
        calculated
          .sectionCounts
          .part_1
      ),

    part_2:
      normalizeNumber(
        storedSectionCounts
          .part_2,
        calculated
          .sectionCounts
          .part_2
      ),

    part_3:
      normalizeNumber(
        storedSectionCounts
          .part_3,
        calculated
          .sectionCounts
          .part_3
      ),
  };

  const owner =
    resolveTestOwner(
      rawData
    );

  const durationMinutes =
    normalizeNumber(
      rawData.durationMinutes ??
        rawData.duration,
      0
    );

  const publishedAt =
    safeString(
      rawData.publishedAt ??
        version.publishedAt
    );

  return {
    id:
      documentId,

    title:
      safeString(
        rawData.title
      ),

    description:
      safeString(
        rawData.description
      ),

    instructions:
      safeString(
        rawData.instructions
      ),

    subject:
      safeString(
        metadata.subject ??
          rawData.subject
      ),

    grade:
      safeString(
        metadata.grade ??
          rawData.grade
      ),

    duration:
      durationMinutes,

    durationMinutes,

    totalScore:
      normalizeNumber(
        rawData.totalScore,
        10
      ),

    totalQuestions,

    questionCount:
      totalQuestions,

    questionTypeCounts,

    sectionCounts,

    status:
      safeString(
        rawData.status
      ) ||
      "draft",

    visibility:
      safeString(
        rawData.visibility
      ) ||
      "private",

    source:
      safeString(
        rawData.source
      ) ||
      "manual",

    versionNumber:
      normalizeNumber(
        version.number,
        1
      ),

    teacherEmail:
      owner.email,

    teacherName:
      owner.name,

    schoolId:
      owner.schoolId,

    owner,

    createdAt:
      safeString(
        rawData.createdAt
      ),

    updatedAt:
      safeString(
        rawData.updatedAt
      ),

    publishedAt:
      publishedAt ||
      undefined,
  };
}