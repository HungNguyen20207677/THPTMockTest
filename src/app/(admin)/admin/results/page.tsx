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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 max-w-3xl">
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Kết quả bài làm
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Tất cả kết quả
        </h1>
        <p className="text-muted-foreground mt-2">
          Tra cứu các lượt đã nộp theo học sinh, đề thi và cách nộp bài.
        </p>
      </header>
      <AdminResultListPanel showFilters />
    </main>
  );
}
