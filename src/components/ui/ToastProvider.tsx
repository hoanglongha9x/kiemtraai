"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import styles from "./ToastProvider.module.css";

export type ToastVariant =
  | "success"
  | "error"
  | "warning"
  | "info";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastItem = Required<
  Pick<
    ToastInput,
    "title" | "variant" | "duration"
  >
> &
  Pick<ToastInput, "description"> & {
    id: string;
  };

type ToastContextValue = {
  showToast: (
    toast: ToastInput
  ) => string;

  dismissToast: (
    toastId: string
  ) => void;

  success: (
    title: string,
    description?: string
  ) => string;

  error: (
    title: string,
    description?: string
  ) => string;

  warning: (
    title: string,
    description?: string
  ) => string;

  info: (
    title: string,
    description?: string
  ) => string;
};

type ToastProviderProps = {
  children: ReactNode;
};

const ToastContext =
  createContext<ToastContextValue | null>(
    null
  );

function createToastId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

const toastIcons: Record<
  ToastVariant,
  string
> = {
  success: "✓",
  error: "!",
  warning: "⚠",
  info: "i",
};

export function ToastProvider({
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<
    ToastItem[]
  >([]);

  const dismissToast = useCallback(
    (toastId: string) => {
      setToasts((currentToasts) =>
        currentToasts.filter(
          (toast) =>
            toast.id !== toastId
        )
      );
    },
    []
  );

  const showToast = useCallback(
    ({
      title,
      description,
      variant = "info",
      duration = 3500,
    }: ToastInput): string => {
      const toastId =
        createToastId();

      const toast: ToastItem = {
        id: toastId,
        title,
        description,
        variant,
        duration,
      };

      setToasts((currentToasts) => [
        ...currentToasts,
        toast,
      ]);

      if (duration > 0) {
        window.setTimeout(() => {
          dismissToast(toastId);
        }, duration);
      }

      return toastId;
    },
    [dismissToast]
  );

  const value =
    useMemo<ToastContextValue>(
      () => ({
        showToast,
        dismissToast,

        success: (
          title,
          description
        ) =>
          showToast({
            title,
            description,
            variant: "success",
          }),

        error: (
          title,
          description
        ) =>
          showToast({
            title,
            description,
            variant: "error",
            duration: 5000,
          }),

        warning: (
          title,
          description
        ) =>
          showToast({
            title,
            description,
            variant: "warning",
          }),

        info: (
          title,
          description
        ) =>
          showToast({
            title,
            description,
            variant: "info",
          }),
      }),
      [
        dismissToast,
        showToast,
      ]
    );

  return (
    <ToastContext.Provider
      value={value}
    >
      {children}

      <div
        className={styles.viewport}
        aria-live="polite"
        aria-label="Thông báo"
      >
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={[
              styles.toast,
              styles[toast.variant],
            ].join(" ")}
            role={
              toast.variant === "error"
                ? "alert"
                : "status"
            }
          >
            <div
              className={styles.icon}
              aria-hidden="true"
            >
              {
                toastIcons[
                  toast.variant
                ]
              }
            </div>

            <div
              className={
                styles.content
              }
            >
              <h3
                className={
                  styles.title
                }
              >
                {toast.title}
              </h3>

              {toast.description && (
                <p
                  className={
                    styles.description
                  }
                >
                  {
                    toast.description
                  }
                </p>
              )}
            </div>

            <button
              type="button"
              className={
                styles.closeButton
              }
              onClick={() =>
                dismissToast(
                  toast.id
                )
              }
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast():
  ToastContextValue {
  const context =
    useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast phải được sử dụng bên trong ToastProvider."
    );
  }

  return context;
}