import type { Metadata } from "next";

import { StudentExamList } from "@/components/student/exam-list";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Trang học sinh",
};

export default async function StudentDashboardPage() {
  const student = await requirePageRole(USER_ROLE.STUDENT);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="border-border mb-7 border-b pb-7">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Khu vực học sinh
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Xin chào, {student.fullName}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6 sm:text-base">
          Chọn đề thi để bắt đầu hoặc tiếp tục lượt làm hiện tại.
        </p>
      </section>
      <StudentExamList />
    </main>
  );
}
