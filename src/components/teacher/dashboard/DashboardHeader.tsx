import type { ReactNode } from "react";

import PageHeader from "@/components/ui/PageHeader";

type Props = {
  teacherName?: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function DashboardHeader({
  teacherName = "Thầy/Cô",
  subtitle =
    "Theo dõi hoạt động giảng dạy và quản lý nội dung kiểm tra.",
  actions,
}: Props) {
  return (
    <PageHeader
      eyebrow="Tổng quan"
      title={`Xin chào, ${teacherName} 👋`}
      description={subtitle}
      actions={actions}
    />
  );
}