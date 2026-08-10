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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight">Tạo đề thi</h1>
        <p className="text-muted-foreground mt-2">
          Nhập thông tin, tệp PDF và đáp án cố định của đề Toán THPT.
        </p>
      </div>
      <ExamForm mode="create" />
    </main>
  );
}
