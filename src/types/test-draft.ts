import type { TestQuestionDraft } from "./test-question";

export type TestStructureMode =
  | "gdpt_2018"
  | "custom";

export type TestStatus =
  | "draft"
  | "published"
  | "archived";

export type TestSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error";

export type TestDraft = {
  id: string;

  title: string;
  subject: string;
  grade: string;

  durationMinutes: number;

  description: string;
  instructions: string;

  structureMode: TestStructureMode;
  status: TestStatus;

  questions: TestQuestionDraft[];

  createdAt: string;
  updatedAt: string;
};

export type TestDraftValidationResult = {
  valid: boolean;
  errors: string[];
};