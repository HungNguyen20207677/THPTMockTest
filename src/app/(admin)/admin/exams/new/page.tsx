import type { Metadata } from "next";

import { ExamForm } from "@/components/admin/exam-form";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Tạo đề thi",
};

export default async function NewExamPage() {
  await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="border-border mb-7 border-b pb-7">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Quản lý đề thi
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Tạo đề thi
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6 sm:text-base">
          Nhập thông tin, tệp PDF và đáp án cố định của đề Toán THPT.
        </p>
      </div>
      <ExamForm mode="create" />
    </main>
  );
}
