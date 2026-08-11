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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="mb-7">
        <p className="text-primary text-sm font-semibold">KHU VỰC HỌC SINH</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Xin chào, {student.fullName}
        </h1>
        <p className="text-muted-foreground mt-2">
          Chọn đề thi để bắt đầu hoặc tiếp tục lượt làm hiện tại.
        </p>
      </section>
      <StudentExamList />
    </main>
  );
}
