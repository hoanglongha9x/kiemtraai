"use client";

import {
  useContext,
} from "react";

import {
  TeacherSessionContext,
} from "../context/TeacherSessionProvider";

export default function useCurrentTeacher() {
  const context =
    useContext(
      TeacherSessionContext
    );

  if (!context) {
    throw new Error(
      "useCurrentTeacher phải được sử dụng bên trong TeacherSessionProvider."
    );
  }

  return context;
}