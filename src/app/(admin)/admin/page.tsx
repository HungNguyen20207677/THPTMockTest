import type { Metadata } from "next";
import Link from "next/link";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { Button } from "@/components/ui/button";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Quản trị",
};

export default async function AdminDashboardPage() {
  const admin = await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="border-border flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">
            Khu vực quản trị
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Xin chào, {admin.fullName}
          </h1>
          <p className="text-muted-foreground text-sm leading-6 sm:text-base">
            Bạn có thể quản lý tài khoản học sinh, tệp PDF và đáp án của các đề
            thi Toán THPT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button asChild>
            <Link href="/admin/students">Quản lý học sinh</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/exams">Quản lý đề thi</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/results">Xem kết quả</Link>
          </Button>
        </div>
      </section>
      <div className="mt-7">
        <AdminDashboard />
      </div>
    </main>
  );
}
