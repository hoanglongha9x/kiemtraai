"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  QuestionCardData,
} from "@/components/question-bank/types";

import {
  getTest,
  getTestServiceErrorMessage,
  publishTest,
  saveTest,
} from "../services";

import type {
  TestData,
  TestQuestionSnapshot,
  TestSection,
  TestValidationResult,
} from "../types";

import {
  addQuestionsToSection,
  moveQuestionInSection,
  removeQuestionFromSection,
  replaceTestSection,
  synchronizeTestTotals,
  updateQuestionRequired,
  updateQuestionScore,
  updateTestDescription,
  updateTestDuration,
  updateTestGrade,
  updateTestInstructions,
  updateTestQuestionSnapshot,
  updateTestSubject,
  updateTestTitle,
  validateTest,
} from "../utils";

export type TestEditorSaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error";

export type AddEditorQuestionsResult = {
  addedCount: number;
  duplicateCount: number;
  incompatibleCount: number;
};

export type UseTestEditorOptions = {
  testId: string;
  ownerUid: string;
  autoLoad?: boolean;
};

export type UseTestEditorResult = {
  test: TestData | null;

  loading: boolean;
  saving: boolean;
  publishing: boolean;
  initialized: boolean;

  error: string | null;
  saveError: string | null;
  publishError: string | null;

  saveStatus:
    TestEditorSaveStatus;

  dirty: boolean;

  lastSavedAt:
    string | null;

  validation:
    TestValidationResult | null;

  canPublish: boolean;

  setTitle:
    (title: string) => void;

  setDescription:
    (description: string) => void;

  setInstructions:
    (instructions: string) => void;

  setDurationMinutes:
    (minutes: number) => void;

  setSubject:
    (subject: string) => void;

  setGrade:
    (grade: string) => void;

  updateSection:
    (
      sectionId: string,
      changes: Partial<
        Omit<
          TestSection,
          "id"
        >
      >
    ) => void;

  addQuestions:
    (
      sectionId: string,
      questions:
        QuestionCardData[]
    ) => AddEditorQuestionsResult;

  removeQuestion:
    (
      sectionId: string,
      testQuestionId: string
    ) => void;

  moveQuestion:
    (
      sectionId: string,
      testQuestionId: string,
      direction:
        | "up"
        | "down"
    ) => void;

  setQuestionScore:
    (
      sectionId: string,
      testQuestionId: string,
      score: number
    ) => void;

  setQuestionRequired:
    (
      sectionId: string,
      testQuestionId: string,
      required: boolean
    ) => void;

  setQuestionSnapshot:
    (
      sectionId: string,
      testQuestionId: string,
      snapshot:
        TestQuestionSnapshot
    ) => void;

  load:
    () => Promise<void>;

  save:
    () => Promise<boolean>;

  publish:
    () => Promise<boolean>;

  reset:
    () => void;
};

export function useTestEditor({
  testId,
  ownerUid,
  autoLoad = true,
}: UseTestEditorOptions): UseTestEditorResult {
  const [
    test,
    setTest,
  ] = useState<TestData | null>(
    null
  );

  const [
    originalTest,
    setOriginalTest,
  ] = useState<TestData | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    publishing,
    setPublishing,
  ] = useState(false);

  const [
    initialized,
    setInitialized,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    saveError,
    setSaveError,
  ] = useState<string | null>(
    null
  );

  const [
    publishError,
    setPublishError,
  ] = useState<string | null>(
    null
  );

  const [
    saveStatus,
    setSaveStatus,
  ] =
    useState<TestEditorSaveStatus>(
      "idle"
    );

  const [
    lastSavedAt,
    setLastSavedAt,
  ] = useState<string | null>(
    null
  );

  const requestIdRef =
    useRef(0);

  const savingRef =
    useRef(false);

  const publishingRef =
    useRef(false);

  const normalizedTestId =
    testId.trim();

  const normalizedOwnerUid =
    ownerUid.trim();

  const dirty =
    Boolean(
      test &&
        originalTest &&
        JSON.stringify(test) !==
          JSON.stringify(
            originalTest
          )
    );

  const validation =
    useMemo<
      TestValidationResult | null
    >(() => {
      if (!test) {
        return null;
      }

      return validateTest(
        test
      );
    }, [test]);

  const canPublish =
  Boolean(
    test &&
      (
        test.status ===
          "draft" ||
        test.status ===
          "published"
      ) &&
      validation?.valid &&
      !saving &&
      !publishing
  );

  const applyChange =
    useCallback(
      (
        updater:
          (
            currentTest:
              TestData
          ) => TestData
      ): void => {
        setTest(
          (currentTest) => {
            if (!currentTest) {
              return currentTest;
            }

            if (
              currentTest.status !==
              "draft"
            ) {
              return currentTest;
            }

            return synchronizeTestTotals(
              updater(
                currentTest
              )
            );
          }
        );

        setSaveStatus(
          "dirty"
        );

        setSaveError(null);
        setPublishError(null);
      },
      []
    );

  const load =
    useCallback(
      async (): Promise<void> => {
        if (
          !normalizedTestId ||
          !normalizedOwnerUid
        ) {
          setTest(null);
          setOriginalTest(null);

          setError(
            "Thiếu mã đề hoặc thông tin giáo viên."
          );

          setInitialized(true);

          return;
        }

        const requestId =
          requestIdRef.current +
          1;

        requestIdRef.current =
          requestId;

        try {
          setLoading(true);

          setError(null);
          setSaveError(null);
          setPublishError(null);

          const loadedTest =
            await getTest(
              normalizedTestId,
              normalizedOwnerUid
            );

          if (
            requestIdRef.current !==
            requestId
          ) {
            return;
          }
console.log(
  "CLIENT TEST OWNER DEBUG",
  {
    ownerUidPassedToEditor:
      normalizedOwnerUid,

    testOwnerUid:
      loadedTest.owner?.uid,

    testOwnerEmail:
      loadedTest.owner?.email,
  }
);
          const normalizedTest =
            synchronizeTestTotals(
              loadedTest
            );

          setTest(
            normalizedTest
          );

          setOriginalTest(
            normalizedTest
          );

          setSaveStatus(
            "idle"
          );

          setLastSavedAt(
            loadedTest.updatedAt ??
              null
          );
        } catch (
          loadError
        ) {
          if (
            requestIdRef.current !==
            requestId
          ) {
            return;
          }

          setTest(null);
          setOriginalTest(null);

          setError(
            getTestServiceErrorMessage(
              loadError,
              "Không thể tải đề kiểm tra."
            )
          );
        } finally {
          if (
            requestIdRef.current ===
            requestId
          ) {
            setLoading(false);
            setInitialized(true);
          }
        }
      },
      [
        normalizedOwnerUid,
        normalizedTestId,
      ]
    );

  const save =
    useCallback(
      async (): Promise<boolean> => {
        if (
          !test ||
          test.status !==
            "draft" ||
          savingRef.current ||
          publishingRef.current
        ) {
          return false;
        }

        try {
          savingRef.current =
            true;

          setSaving(true);
          setSaveError(null);
          setPublishError(null);

          setSaveStatus(
            "saving"
          );

          const response =
            await saveTest({
              test,

              validateBeforeSave:
                false,
            });

          const savedTest =
            synchronizeTestTotals(
              response.data
            );

          setTest(
            savedTest
          );

          setOriginalTest(
            savedTest
          );

          setLastSavedAt(
            savedTest.updatedAt ??
              new Date()
                .toISOString()
          );

          setSaveStatus(
            "saved"
          );

          return true;
        } catch (
          currentSaveError
        ) {
          setSaveError(
            getTestServiceErrorMessage(
              currentSaveError,
              "Không thể lưu đề kiểm tra."
            )
          );

          setSaveStatus(
            "error"
          );

          return false;
        } finally {
          savingRef.current =
            false;

          setSaving(false);
        }
      },
      [test]
    );

  const publish =
    useCallback(
      async (): Promise<boolean> => {
        if (
  !test ||
  (
    test.status !==
      "draft" &&
    test.status !==
      "published"
  ) ||
  publishingRef.current ||
  savingRef.current
) {
  return false;
}

        const currentValidation =
          validateTest(
            test
          );

        if (
          !currentValidation.valid
        ) {
          setPublishError(
            "Đề kiểm tra còn lỗi. Vui lòng khắc phục trước khi xuất bản."
          );

          return false;
        }

        try {
          publishingRef.current =
            true;

          setPublishing(true);

          setSaveError(null);
          setPublishError(null);

       if (
  dirty &&
  test.status ===
    "draft"
) {
            setSaveStatus(
              "saving"
            );

            const saveResponse =
              await saveTest({
                test,

                validateBeforeSave:
                  true,
              });

            const savedTest =
              synchronizeTestTotals(
                saveResponse.data
              );

            setTest(
              savedTest
            );

            setOriginalTest(
              savedTest
            );

            setLastSavedAt(
              savedTest.updatedAt ??
                new Date()
                  .toISOString()
            );

            setSaveStatus(
              "saved"
            );
          }

          const response =
            await publishTest({
              testId:
                test.id,

              ownerUid:
                normalizedOwnerUid,
            });

          const publishedTest =
            synchronizeTestTotals(
              response.data
            );

          setTest(
            publishedTest
          );

          setOriginalTest(
            publishedTest
          );

          setLastSavedAt(
            publishedTest.updatedAt ??
              new Date()
                .toISOString()
          );

          setSaveStatus(
            "saved"
          );

          return true;
        } catch (
          currentPublishError
        ) {
          setPublishError(
            getTestServiceErrorMessage(
              currentPublishError,
              "Không thể xuất bản đề kiểm tra."
            )
          );

          return false;
        } finally {
          publishingRef.current =
            false;

          setPublishing(false);
        }
      },
      [
        dirty,
        normalizedOwnerUid,
        test,
      ]
    );

  const reset =
    useCallback(
      (): void => {
        if (
          !originalTest ||
          originalTest.status !==
            "draft"
        ) {
          return;
        }

        setTest(
          originalTest
        );

        setSaveStatus(
          "idle"
        );

        setSaveError(null);
        setPublishError(null);
      },
      [originalTest]
    );

  const setTitle =
    useCallback(
      (title: string) => {
        applyChange(
          (currentTest) =>
            updateTestTitle(
              currentTest,
              title
            )
        );
      },
      [applyChange]
    );

  const setDescription =
    useCallback(
      (
        description:
          string
      ) => {
        applyChange(
          (currentTest) =>
            updateTestDescription(
              currentTest,
              description
            )
        );
      },
      [applyChange]
    );

  const setInstructions =
    useCallback(
      (
        instructions:
          string
      ) => {
        applyChange(
          (currentTest) =>
            updateTestInstructions(
              currentTest,
              instructions
            )
        );
      },
      [applyChange]
    );

  const setDurationMinutes =
    useCallback(
      (minutes: number) => {
        applyChange(
          (currentTest) =>
            updateTestDuration(
              currentTest,
              minutes
            )
        );
      },
      [applyChange]
    );

  const setSubject =
    useCallback(
      (subject: string) => {
        applyChange(
          (currentTest) =>
            updateTestSubject(
              currentTest,
              subject
            )
        );
      },
      [applyChange]
    );

  const setGrade =
    useCallback(
      (grade: string) => {
        applyChange(
          (currentTest) =>
            updateTestGrade(
              currentTest,
              grade
            )
        );
      },
      [applyChange]
    );

  const updateSection =
    useCallback(
      (
        sectionId: string,
        changes: Partial<
          Omit<
            TestSection,
            "id"
          >
        >
      ): void => {
        applyChange(
          (currentTest) => ({
            ...currentTest,

            sections:
              currentTest.sections.map(
                (section) =>
                  section.id ===
                  sectionId
                    ? {
                        ...section,
                        ...changes,

                        id:
                          section.id,
                      }
                    : section
              ),
          })
        );
      },
      [applyChange]
    );

  const addQuestions =
    useCallback(
      (
        sectionId: string,
        questions:
          QuestionCardData[]
      ): AddEditorQuestionsResult => {
        const result:
          AddEditorQuestionsResult = {
          addedCount: 0,
          duplicateCount: 0,
          incompatibleCount: 0,
        };

        const currentSection =
          test?.sections.find(
            (item) =>
              item.id ===
              sectionId
          );

        if (
          !test ||
          !currentSection ||
          test.status !== "draft"
        ) {
          return result;
        }

        const previewResult =
          addQuestionsToSection(
            currentSection,
            questions,
            test.sections
          );

        result.addedCount =
          previewResult
            .addedQuestionIds
            .length;

        result.duplicateCount =
          previewResult
            .duplicateQuestionIds
            .length;

        result.incompatibleCount =
          previewResult
            .incompatibleQuestionIds
            .length;

        applyChange(
          (currentTest) => {
            const section =
              currentTest.sections.find(
                (item) =>
                  item.id ===
                  sectionId
              );

            if (!section) {
              return currentTest;
            }

            const latestAddResult =
              addQuestionsToSection(
                section,
                questions,
                currentTest.sections
              );

            return replaceTestSection(
              currentTest,
              latestAddResult.section
            );
          }
        );

        return result;
      },
      [applyChange, test]
    );

  const removeQuestion =
    useCallback(
      (
        sectionId: string,
        testQuestionId:
          string
      ): void => {
        applyChange(
          (currentTest) => {
            const section =
              currentTest.sections.find(
                (item) =>
                  item.id ===
                  sectionId
              );

            if (!section) {
              return currentTest;
            }

            return replaceTestSection(
              currentTest,
              removeQuestionFromSection(
                section,
                testQuestionId
              )
            );
          }
        );
      },
      [applyChange]
    );

  const moveQuestion =
    useCallback(
      (
        sectionId: string,
        testQuestionId:
          string,
        direction:
          | "up"
          | "down"
      ): void => {
        applyChange(
          (currentTest) => {
            const section =
              currentTest.sections.find(
                (item) =>
                  item.id ===
                  sectionId
              );

            if (!section) {
              return currentTest;
            }

            return replaceTestSection(
              currentTest,
              moveQuestionInSection(
                section,
                testQuestionId,
                direction
              )
            );
          }
        );
      },
      [applyChange]
    );

  const setQuestionScore =
    useCallback(
      (
        sectionId: string,
        testQuestionId:
          string,
        score: number
      ): void => {
        applyChange(
          (currentTest) => {
            const section =
              currentTest.sections.find(
                (item) =>
                  item.id ===
                  sectionId
              );

            if (!section) {
              return currentTest;
            }

            return replaceTestSection(
              currentTest,
              updateQuestionScore(
                section,
                testQuestionId,
                score
              )
            );
          }
        );
      },
      [applyChange]
    );

  const setQuestionRequired =
    useCallback(
      (
        sectionId: string,
        testQuestionId:
          string,
        required: boolean
      ): void => {
        applyChange(
          (currentTest) => {
            const section =
              currentTest.sections.find(
                (item) =>
                  item.id ===
                  sectionId
              );

            if (!section) {
              return currentTest;
            }

            return replaceTestSection(
              currentTest,
              updateQuestionRequired(
                section,
                testQuestionId,
                required
              )
            );
          }
        );
      },
      [applyChange]
    );

  const setQuestionSnapshot =
    useCallback(
      (
        sectionId: string,
        testQuestionId:
          string,
        snapshot:
          TestQuestionSnapshot
      ): void => {
        applyChange(
          (currentTest) =>
            updateTestQuestionSnapshot(
              currentTest,
              sectionId,
              testQuestionId,
              snapshot
            )
        );
      },
      [applyChange]
    );

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    void load();
  }, [
    autoLoad,
    load,
  ]);

  return {
    test,

    loading,
    saving,
    publishing,
    initialized,

    error,
    saveError,
    publishError,

    saveStatus,

    dirty,

    lastSavedAt,

    validation,
    canPublish,

    setTitle,
    setDescription,
    setInstructions,
    setDurationMinutes,
    setSubject,
    setGrade,

    updateSection,

    addQuestions,

    removeQuestion,
    moveQuestion,

    setQuestionScore,
    setQuestionRequired,
    setQuestionSnapshot,

    load,
    save,
    publish,
    reset,
  };
}
