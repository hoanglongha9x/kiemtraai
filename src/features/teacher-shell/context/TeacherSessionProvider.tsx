"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  auth,
} from "@/lib/firebase/client";

import {
  getTeacherMe,
  logoutTeacher,
} from "@/features/auth/services/teacherAuthService";

import type {
  TeacherProfile,
} from "@/features/auth/types";

export type TeacherSessionStatus =
  | "loading"
  | "authenticated"
  | "needs_registration"
  | "unauthenticated"
  | "error";

type TeacherSessionContextValue = {
  firebaseUser: User | null;
  teacher:
    | TeacherProfile
    | null;

  status:
    TeacherSessionStatus;

  loading: boolean;
  error: string;

  refreshTeacher:
    () => Promise<void>;

  logout:
    () => Promise<void>;
};

export const TeacherSessionContext =
  createContext<
    TeacherSessionContextValue
    | undefined
  >(undefined);

type TeacherSessionProviderProps = {
  children: ReactNode;
};

const REGISTER_PATH =
  "/teacher/register";

export default function TeacherSessionProvider({
  children,
}: TeacherSessionProviderProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    firebaseUser,
    setFirebaseUser,
  ] =
    useState<User | null>(
      null
    );

  const [
    teacher,
    setTeacher,
  ] =
    useState<TeacherProfile | null>(
      null
    );

  const [
    status,
    setStatus,
  ] =
    useState<TeacherSessionStatus>(
      "loading"
    );

  const [
    error,
    setError,
  ] = useState("");

  const loadTeacher =
    useCallback(
      async (
        user: User
      ) => {
        setError("");
        setStatus("loading");

        const response =
          await getTeacherMe(
            user
          );

        if (
          response.status ===
          "success"
        ) {
          setTeacher({
            ...response.teacher,

            uid:
              response.teacher
                .uid ??
              user.uid,
          });

          setStatus(
            "authenticated"
          );

          if (
            pathname ===
            REGISTER_PATH
          ) {
            router.replace(
              "/teacher/dashboard"
            );
          }

          return;
        }

        if (
          response.status ===
          "needs_registration"
        ) {
          setTeacher(null);

          setStatus(
            "needs_registration"
          );

          if (
            pathname !==
            REGISTER_PATH
          ) {
            router.replace(
              REGISTER_PATH
            );
          }

          return;
        }

        setTeacher(null);
        setError(
          response.message
        );
        setStatus("error");

        try {
          await logoutTeacher();
        } catch (
          logoutError
        ) {
          console.error(
            "Không thể đăng xuất:",
            logoutError
          );
        }

        const message =
          encodeURIComponent(
            response.message
          );

        router.replace(
          `/login?message=${message}`
        );
      },
      [
        pathname,
        router,
      ]
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          currentUser
        ) => {
          setFirebaseUser(
            currentUser
          );

          if (!currentUser) {
            setTeacher(null);
            setStatus(
              "unauthenticated"
            );

            if (
              pathname !==
              REGISTER_PATH
            ) {
              router.replace(
                "/login"
              );
            }

            return;
          }

          await loadTeacher(
            currentUser
          );
        }
      );

    return () =>
      unsubscribe();
  }, [
    loadTeacher,
    pathname,
    router,
  ]);

  const refreshTeacher =
    useCallback(
      async () => {
        const currentUser =
          auth.currentUser;

        if (!currentUser) {
          setFirebaseUser(
            null
          );

          setTeacher(null);

          setStatus(
            "unauthenticated"
          );

          router.replace(
            "/login"
          );

          return;
        }

        setFirebaseUser(
          currentUser
        );

        await loadTeacher(
          currentUser
        );
      },
      [
        loadTeacher,
        router,
      ]
    );

  const logout =
    useCallback(
      async () => {
        setStatus("loading");

        try {
          await logoutTeacher();
        } finally {
          setFirebaseUser(
            null
          );

          setTeacher(null);

          setError("");

          setStatus(
            "unauthenticated"
          );

          router.replace(
            "/login"
          );

          router.refresh();
        }
      },
      [router]
    );

  const value =
    useMemo<
      TeacherSessionContextValue
    >(
      () => ({
        firebaseUser,
        teacher,

        status,

        loading:
          status ===
          "loading",

        error,

        refreshTeacher,
        logout,
      }),
      [
        firebaseUser,
        teacher,
        status,
        error,
        refreshTeacher,
        logout,
      ]
    );

  return (
    <TeacherSessionContext.Provider
      value={value}
    >
      {children}
    </TeacherSessionContext.Provider>
  );
}