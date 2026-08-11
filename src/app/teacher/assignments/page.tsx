import {
  Suspense,
} from "react";

import {
  AssignmentListPage,
} from "@/features/assignments/components";

function AssignmentsPageFallback() {
  return (
    <main
      style={{
        minHeight:
          "100vh",

        padding:
          32,

        background:
          "#f5f7fb",
      }}
    >
      <div
        style={{
          height:
            100,

          marginBottom:
            24,

          borderRadius:
            20,

          background:
            "#e2e8f0",
        }}
      />

      <div
        style={{
          height:
            360,

          borderRadius:
            20,

          background:
            "#e2e8f0",
        }}
      />
    </main>
  );
}

export default function TeacherAssignmentsPage() {
  return (
    <Suspense
      fallback={
        <AssignmentsPageFallback />
      }
    >
      <AssignmentListPage />
    </Suspense>
  );
}