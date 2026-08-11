"use client";

import {
  useEffect,
  useRef,
} from "react";

export type UseTestAutosaveOptions = {
  enabled?: boolean;

  dirty: boolean;

  saving: boolean;

  delay?: number;

  save:
    () => Promise<boolean>;
};

export function useTestAutosave({
  enabled = true,
  dirty,
  saving,
  delay = 1500,
  save,
}: UseTestAutosaveOptions): void {
  const saveRef =
    useRef(save);

  const mountedRef =
    useRef(false);

  useEffect(() => {
    saveRef.current =
      save;
  }, [save]);

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    if (
      !enabled ||
      !dirty ||
      saving
    ) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          void saveRef.current();
        },
        delay
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    delay,
    dirty,
    enabled,
    saving,
  ]);
}