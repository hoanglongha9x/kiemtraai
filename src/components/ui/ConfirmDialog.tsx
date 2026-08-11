"use client";

import {
  useEffect,
  type ReactNode,
} from "react";

import {
  Button,
} from "@/components/ui";

import styles from "./ConfirmDialog.module.css";

export type ConfirmDialogVariant =
  | "danger"
  | "warning"
  | "primary";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "danger",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !loading
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        "";
    };
  }, [
    loading,
    onClose,
    open,
  ]);

  if (!open) {
    return null;
  }

  const confirmButtonVariant =
    variant === "danger"
      ? "danger"
      : variant === "warning"
        ? "secondary"
        : "primary";

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !loading
        ) {
          onClose();
        }
      }}
    >
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={
          description
            ? "confirm-dialog-description"
            : undefined
        }
      >
        <header
          className={styles.header}
        >
          <div
            className={[
              styles.icon,
              styles[variant],
            ].join(" ")}
            aria-hidden="true"
          >
            {variant === "danger"
              ? "!"
              : variant === "warning"
                ? "⚠"
                : "?"}
          </div>

          <div
            className={
              styles.heading
            }
          >
            <h2
              id="confirm-dialog-title"
              className={styles.title}
            >
              {title}
            </h2>

            {description && (
              <div
                id="confirm-dialog-description"
                className={
                  styles.description
                }
              >
                {description}
              </div>
            )}
          </div>
        </header>

        <footer
          className={styles.footer}
        >
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            variant={
              confirmButtonVariant
            }
            disabled={loading}
            onClick={() => {
              void onConfirm();
            }}
          >
            {loading
              ? "Đang xử lý..."
              : confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  );
}