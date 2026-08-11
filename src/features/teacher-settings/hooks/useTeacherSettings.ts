"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_TEACHER_SETTINGS,
} from "../constants";

import {
  getTeacherSettings,
} from "../services/teacherSettingsService";

import type {
  TeacherSettings,
} from "../types";

type UseTeacherSettingsResult = {
  settings: TeacherSettings;
  loading: boolean;
  error: string | null;

  reload:
    () => Promise<TeacherSettings>;
};

let cachedSettings:
  TeacherSettings | null = null;

let settingsRequest:
  Promise<TeacherSettings> | null =
    null;

function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Không tải được cài đặt giáo viên.";
}

async function loadTeacherSettings(
  force = false
): Promise<TeacherSettings> {
  if (
    cachedSettings &&
    !force
  ) {
    return cachedSettings;
  }

  if (
    settingsRequest &&
    !force
  ) {
    return settingsRequest;
  }

  settingsRequest =
    getTeacherSettings()
      .then((settings) => {
        cachedSettings =
          settings;

        return settings;
      })
      .finally(() => {
        settingsRequest =
          null;
      });

  return settingsRequest;
}

export function clearTeacherSettingsCache() {
  cachedSettings = null;
  settingsRequest = null;
}

export function setTeacherSettingsCache(
  settings: TeacherSettings
) {
  cachedSettings =
    settings;
}

export default function useTeacherSettings(): UseTeacherSettingsResult {
  const [
    settings,
    setSettings,
  ] =
    useState<TeacherSettings>(
      cachedSettings ??
        DEFAULT_TEACHER_SETTINGS
    );

  const [
    loading,
    setLoading,
  ] = useState(
    cachedSettings === null
  );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    let active = true;

    async function load() {
      if (
        cachedSettings
      ) {
        setSettings(
          cachedSettings
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result =
          await loadTeacherSettings();

        if (!active) {
          return;
        }

        setSettings(result);
      } catch (
        loadError
      ) {
        if (!active) {
          return;
        }

        setError(
          getErrorMessage(
            loadError
          )
        );

        setSettings(
          DEFAULT_TEACHER_SETTINGS
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const reload =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const result =
          await loadTeacherSettings(
            true
          );

        setSettings(result);

        return result;
      } catch (
        reloadError
      ) {
        const message =
          getErrorMessage(
            reloadError
          );

        setError(message);

        throw reloadError;
      } finally {
        setLoading(false);
      }
    }, []);

  return {
    settings,
    loading,
    error,
    reload,
  };
}