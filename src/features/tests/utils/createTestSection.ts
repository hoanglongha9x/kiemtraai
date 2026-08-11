import {
  TEST_SECTION_PRESETS,
} from "../constants";

import type {
  TestSection,
  TestSectionType,
} from "../types";

function createLocalId(
  prefix: string
): string {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createTestSection(
  type:
    TestSectionType,

  order:
    number
): TestSection {
  const preset =
    TEST_SECTION_PRESETS.find(
      (sectionPreset) =>
        sectionPreset.type ===
        type
    );

  if (!preset) {
    throw new Error(
      `Không hỗ trợ loại phần thi: ${type}.`
    );
  }

  return {
    id:
      createLocalId(
        "section"
      ),

    type,

    title:
      preset.title,

    description:
      preset.description,

    order,

    scorePerQuestion:
      preset.scorePerQuestion,

    questions: [],
  };
}