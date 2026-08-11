"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  TestDraft,
  TestSaveStatus,
} from "@/types/test-draft";

import {
  createTestDraft,
  normalizeTestDraft,
  updateTestDraftTimestamp,
} from "@/lib/test-draft";

const DEFAULT_STORAGE_KEY =
  "kiemtra_ai_test_draft_v1";

const DEFAULT_AUTOSAVE_DELAY = 800;

type DraftUpdater =
  | TestDraft
  | ((
      currentDraft: TestDraft
    ) => TestDraft);

type UseTestDraftOptions = {
  storageKey?: string;
  autosaveDelay?: number;
};

type UseTestDraftResult = {
  draft: TestDraft | null;

  isHydrated: boolean;
  isDirty: boolean;

  saveStatus: TestSaveStatus;
  lastSavedAt: string | null;

  updateDraft: (
    updater: DraftUpdater
  ) => void;

  saveDraftNow: () => boolean;
  resetDraft: () => void;
  clearSavedDraft: () => void;
};

export function useTestDraft(
  options: UseTestDraftOptions = {}
): UseTestDraftResult {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    autosaveDelay = DEFAULT_AUTOSAVE_DELAY,
  } = options;

  const [draft, setDraft] =
    useState<TestDraft | null>(null);

  const [isHydrated, setIsHydrated] =
    useState(false);

  const [isDirty, setIsDirty] =
    useState(false);

  const [saveStatus, setSaveStatus] =
    useState<TestSaveStatus>("idle");

  const [lastSavedAt, setLastSavedAt] =
    useState<string | null>(null);

  /**
   * Khôi phục bản nháp sau khi component mount.
   * localStorage chỉ được truy cập phía trình duyệt.
   */
  useEffect(() => {
    try {
      const savedValue =
        window.localStorage.getItem(
          storageKey
        );

      if (!savedValue) {
        setDraft(createTestDraft());
        return;
      }

      const parsedValue: unknown =
        JSON.parse(savedValue);

      const restoredDraft =
        normalizeTestDraft(parsedValue);

      setDraft(restoredDraft);
      setLastSavedAt(
        restoredDraft.updatedAt || null
      );
      setSaveStatus("saved");
    } catch (error) {
      console.error(
        "Không thể khôi phục bản nháp:",
        error
      );

      setDraft(createTestDraft());
      setSaveStatus("error");
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  /**
   * Cập nhật đề và đánh dấu có thay đổi chưa lưu.
   */
  const updateDraft = useCallback(
    (updater: DraftUpdater) => {
      setDraft((currentDraft) => {
        if (!currentDraft) {
          return currentDraft;
        }

        const nextDraft =
          typeof updater === "function"
            ? updater(currentDraft)
            : updater;

        return updateTestDraftTimestamp(
          nextDraft
        );
      });

      setIsDirty(true);
      setSaveStatus("idle");
    },
    []
  );

  /**
   * Lưu bản nháp ngay lập tức.
   */
  const saveDraftNow =
    useCallback((): boolean => {
      if (!draft) {
        return false;
      }

      try {
        setSaveStatus("saving");

        const draftToSave =
          updateTestDraftTimestamp(draft);

        window.localStorage.setItem(
          storageKey,
          JSON.stringify(draftToSave)
        );

        setDraft(draftToSave);
        setIsDirty(false);
        setSaveStatus("saved");
        setLastSavedAt(
          draftToSave.updatedAt
        );

        return true;
      } catch (error) {
        console.error(
          "Không thể lưu bản nháp:",
          error
        );

        setSaveStatus("error");

        return false;
      }
    }, [draft, storageKey]);

  /**
   * Tự động lưu sau khi người dùng ngừng chỉnh sửa.
   */
  useEffect(() => {
    if (
      !isHydrated ||
      !draft ||
      !isDirty
    ) {
      return;
    }

    setSaveStatus("saving");

    const timeoutId =
      window.setTimeout(() => {
        try {
          const draftToSave =
            updateTestDraftTimestamp(draft);

          window.localStorage.setItem(
            storageKey,
            JSON.stringify(draftToSave)
          );

          setDraft(draftToSave);
          setIsDirty(false);
          setSaveStatus("saved");
          setLastSavedAt(
            draftToSave.updatedAt
          );
        } catch (error) {
          console.error(
            "Autosave bản nháp thất bại:",
            error
          );

          setSaveStatus("error");
        }
      }, autosaveDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    autosaveDelay,
    draft,
    isDirty,
    isHydrated,
    storageKey,
  ]);

  /**
   * Xóa bản nháp hiện tại và tạo một đề mới.
   */
  const resetDraft =
    useCallback(() => {
      const confirmed = window.confirm(
        "Bạn có chắc muốn tạo đề mới? Bản nháp hiện tại sẽ bị xóa."
      );

      if (!confirmed) {
        return;
      }

      try {
        window.localStorage.removeItem(
          storageKey
        );

        setDraft(createTestDraft());
        setIsDirty(false);
        setSaveStatus("idle");
        setLastSavedAt(null);
      } catch (error) {
        console.error(
          "Không thể tạo đề mới:",
          error
        );

        setSaveStatus("error");
      }
    }, [storageKey]);

  /**
   * Chỉ xóa bản đã lưu trong localStorage.
   * Draft đang hiển thị trong editor vẫn được giữ nguyên.
   */
  const clearSavedDraft =
    useCallback(() => {
      try {
        window.localStorage.removeItem(
          storageKey
        );

        setIsDirty(true);
        setSaveStatus("idle");
        setLastSavedAt(null);
      } catch (error) {
        console.error(
          "Không thể xóa bản nháp đã lưu:",
          error
        );

        setSaveStatus("error");
      }
    }, [storageKey]);

  return {
    draft,

    isHydrated,
    isDirty,

    saveStatus,
    lastSavedAt,

    updateDraft,
    saveDraftNow,
    resetDraft,
    clearSavedDraft,
  };
}