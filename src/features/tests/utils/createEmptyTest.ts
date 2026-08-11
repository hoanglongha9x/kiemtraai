import {
  DEFAULT_TEST_DURATION_MINUTES,
  DEFAULT_TEST_SETTINGS,
  DEFAULT_TEST_VISIBILITY,
} from "../constants";

import type {
  CreateTestInput,
  TestOwner,
} from "../types";

import {
  createTestSection,
} from "./createTestSection";

export type CreateEmptyTestOptions = {
  owner:
    TestOwner;

  subject?: string;

  grade?: string;

  includeDefaultSections?:
    boolean;

  now?: string;
};

export function createEmptyTest({
  owner,

  subject = "",

  grade = "10",

  includeDefaultSections =
    true,

  now =
    new Date().toISOString(),
}: CreateEmptyTestOptions): CreateTestInput {
  const sections =
    includeDefaultSections
      ? [
          createTestSection(
            "single_choice",
            0
          ),

          createTestSection(
            "true_false_group",
            1
          ),

          createTestSection(
            "short_answer",
            2
          ),
        ]
      : [];

  return {
    title:
      "Đề kiểm tra chưa đặt tên",

    description: "",

    instructions: "",

    durationMinutes:
      DEFAULT_TEST_DURATION_MINUTES,

    status:
      "draft",

    visibility:
      DEFAULT_TEST_VISIBILITY,

    metadata: {
      subject,

      grade,

      topics: [],

      tags: [],
    },

    sections,

    settings: {
      ...DEFAULT_TEST_SETTINGS,
    },

    owner,

    version: {
      number: 1,

      status:
        "draft",

      createdAt:
        now,
    },

    totalScore: 0,

    totalQuestions:
      0,
  };
}