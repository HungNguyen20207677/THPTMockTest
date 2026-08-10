import type { Metadata } from "next";

import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Trang học sinh",
};

export default async function StudentDashboardPage() {
  const student = await requirePageRole(USER_ROLE.STUDENT);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="border-border bg-background max-w-2xl space-y-4 rounded-xl border p-6 shadow-sm">
        <p className="text-primary text-sm font-semibold">KHU VỰC HỌC SINH</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Xin chào, {student.fullName}
        </h1>
        <p className="text-muted-foreground">
          Tên đăng nhập: @{student.username}
        </p>
        <div className="bg-muted rounded-lg p-4 text-sm leading-6">
          Chức năng làm đề thi sẽ được triển khai trong giai đoạn tiếp theo.
        </div>
      </section>
    </main>
  );
}
