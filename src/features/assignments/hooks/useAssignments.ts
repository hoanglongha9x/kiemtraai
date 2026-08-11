"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  createAssignment as createAssignmentRequest,
  listAssignments,
  updateAssignmentStatus,
} from "../api";

import type {
  AssignmentAction,
  AssignmentFeedback,
  AssignmentListItem,
  CreateAssignmentInput,
  UseAssignmentsResult,
} from "../types";

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

function sortAssignments(
  assignments:
    AssignmentListItem[]
): AssignmentListItem[] {
  return [
    ...assignments,
  ].sort(
    (
      first,
      second
    ) =>
      String(
        second.createdAt
      ).localeCompare(
        String(
          first.createdAt
        )
      )
  );
}

export function useAssignments(): UseAssignmentsResult {
  const [
    assignments,
    setAssignments,
  ] = useState<
    AssignmentListItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(
    false
  );

  const [
    mutating,
    setMutating,
  ] = useState(
    false
  );

  const [
    initialized,
    setInitialized,
  ] = useState(
    false
  );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    feedback,
    setFeedback,
  ] = useState<
    AssignmentFeedback | null
  >(null);

  const replaceAssignment =
    useCallback(
      (
        nextAssignment:
          AssignmentListItem
      ) => {
        setAssignments(
          (
            currentAssignments
          ) => {
            const exists =
              currentAssignments.some(
                (
                  assignment
                ) =>
                  assignment.id ===
                  nextAssignment.id
              );

            if (!exists) {
              return sortAssignments([
                nextAssignment,
                ...currentAssignments,
              ]);
            }

            return sortAssignments(
              currentAssignments.map(
                (
                  assignment
                ) =>
                  assignment.id ===
                  nextAssignment.id
                    ? nextAssignment
                    : assignment
              )
            );
          }
        );
      },
      []
    );

  const loadAssignments =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );

        try {
          const loadedAssignments =
            await listAssignments();

          setAssignments(
            sortAssignments(
              loadedAssignments
            )
          );
        } catch (
          loadError
        ) {
          const message =
            getErrorMessage(
              loadError,
              "Không tải được danh sách giao đề."
            );

          setError(
            message
          );

          setFeedback({
            variant:
              "error",

            message,
          });
        } finally {
          setLoading(
            false
          );

          setInitialized(
            true
          );
        }
      },
      []
    );

  const refresh =
    useCallback(
      async () => {
        if (
          loading ||
          mutating
        ) {
          return;
        }

        setFeedback({
          variant:
            "loading",

          message:
            "Đang tải lại dữ liệu...",
        });

        try {
          const loadedAssignments =
            await listAssignments();

          setAssignments(
            sortAssignments(
              loadedAssignments
            )
          );

          setError(
            null
          );

          setFeedback({
            variant:
              "success",

            message:
              "Đã tải lại danh sách giao đề.",
          });
        } catch (
          refreshError
        ) {
          const message =
            getErrorMessage(
              refreshError,
              "Không tải lại được danh sách giao đề."
            );

          setError(
            message
          );

          setFeedback({
            variant:
              "error",

            message,
          });
        }
      },
      [
        loading,
        mutating,
      ]
    );

  const createAssignment =
    useCallback(
      async (
        input:
          CreateAssignmentInput
      ): Promise<
        AssignmentListItem | null
      > => {
        if (mutating) {
          return null;
        }

        setMutating(
          true
        );

        setError(
          null
        );

        setFeedback({
          variant:
            "loading",

          message:
            "Đang giao đề...",
        });

        try {
          const response =
            await createAssignmentRequest(
              input
            );

          replaceAssignment(
            response.assignment
          );

          setFeedback({
            variant:
              "success",

            message:
              response.message ||
              "Đã giao đề thành công.",
          });

          return response.assignment;
        } catch (
          createError
        ) {
          const message =
            getErrorMessage(
              createError,
              "Không giao được đề."
            );

          setError(
            message
          );

          setFeedback({
            variant:
              "error",

            message,
          });

          return null;
        } finally {
          setMutating(
            false
          );
        }
      },
      [
        mutating,
        replaceAssignment,
      ]
    );

  const performAction =
    useCallback(
      async (
        assignmentId:
          string,

        action:
          AssignmentAction,

        loadingMessage:
          string,

        fallbackMessage:
          string
      ): Promise<
        AssignmentListItem | null
      > => {
        if (mutating) {
          return null;
        }

        setMutating(
          true
        );

        setError(
          null
        );

        setFeedback({
          variant:
            "loading",

          message:
            loadingMessage,
        });

        try {
          const response =
            await updateAssignmentStatus(
              assignmentId,
              action
            );

          replaceAssignment(
            response.assignment
          );

          setFeedback({
            variant:
              "success",

            message:
              response.message ||
              fallbackMessage,
          });

          return response.assignment;
        } catch (
          actionError
        ) {
          const message =
            getErrorMessage(
              actionError,
              fallbackMessage
            );

          setError(
            message
          );

          setFeedback({
            variant:
              "error",

            message,
          });

          return null;
        } finally {
          setMutating(
            false
          );
        }
      },
      [
        mutating,
        replaceAssignment,
      ]
    );

  const lockAssignment =
    useCallback(
      (
        assignmentId:
          string
      ) =>
        performAction(
          assignmentId,
          "lock",
          "Đang khóa lượt giao đề...",
          "Không khóa được lượt giao đề."
        ),
      [
        performAction,
      ]
    );

  const unlockAssignment =
    useCallback(
      (
        assignmentId:
          string
      ) =>
        performAction(
          assignmentId,
          "unlock",
          "Đang mở khóa lượt giao đề...",
          "Không mở khóa được lượt giao đề."
        ),
      [
        performAction,
      ]
    );

  const archiveAssignment =
    useCallback(
      (
        assignmentId:
          string
      ) =>
        performAction(
          assignmentId,
          "archive",
          "Đang lưu trữ lượt giao đề...",
          "Không lưu trữ được lượt giao đề."
        ),
      [
        performAction,
      ]
    );

  const restoreAssignment =
    useCallback(
      (
        assignmentId:
          string
      ) =>
        performAction(
          assignmentId,
          "restore",
          "Đang khôi phục lượt giao đề...",
          "Không khôi phục được lượt giao đề."
        ),
      [
        performAction,
      ]
    );

  const clearFeedback =
    useCallback(
      () => {
        setFeedback(
          null
        );
      },
      []
    );

  const clearError =
    useCallback(
      () => {
        setError(
          null
        );
      },
      []
    );

  return {
    assignments,

    loading,

    mutating,

    initialized,

    error,

    feedback,

    loadAssignments,

    refresh,

    createAssignment,

    lockAssignment,

    unlockAssignment,

    archiveAssignment,

    restoreAssignment,

    clearFeedback,

    clearError,
  };
}