import type {
  ReactNode,
} from "react";

import {
  ToastProvider,
} from "@/components/ui";

import TeacherArea from "@/features/teacher-shell/components/TeacherArea";

import TeacherSessionProvider from "@/features/teacher-shell/context/TeacherSessionProvider";

type TeacherLayoutProps = {
  children: ReactNode;
};

export default function TeacherLayout({
  children,
}: TeacherLayoutProps) {
  return (
    <ToastProvider>
      <TeacherSessionProvider>
        <TeacherArea>
          {children}
        </TeacherArea>
      </TeacherSessionProvider>
    </ToastProvider>
  );
}