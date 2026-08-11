import type { Metadata } from "next";

import { AdminResultListPanel } from "@/components/admin/result-list-panel";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Kết quả bài làm",
};

export default async function AdminResultsPage() {
  await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6">
        <p className="text-primary text-sm font-semibold">KẾT QUẢ BÀI LÀM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Tất cả kết quả
        </h1>
        <p className="text-muted-foreground mt-2">
          Tra cứu các lượt đã nộp theo học sinh, đề thi và cách nộp bài.
        </p>
      </div>
      <AdminResultListPanel showFilters />
    </main>
  );
}
