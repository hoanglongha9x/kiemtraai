import type {
  ReactNode,
} from "react";

import {
  ToastProvider,
} from "@/components/ui";

import TeacherArea from "@/features/teacher-shell/components/TeacherArea";

import TeacherSessionProvider from "@/features/teacher-shell/context/TeacherSessionProvider";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
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
