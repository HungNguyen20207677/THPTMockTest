import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requirePageRole } from "@/lib/auth/authorization";
import { USER_ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Quản trị",
};

export default async function AdminDashboardPage() {
  const admin = await requirePageRole(USER_ROLE.ADMIN);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="border-border bg-background max-w-2xl space-y-5 rounded-xl border p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-primary text-sm font-semibold">KHU VỰC QUẢN TRỊ</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Xin chào, {admin.fullName}
          </h1>
          <p className="text-muted-foreground leading-7">
            Bạn có thể tạo và quản lý tài khoản học sinh. Chức năng đề thi sẽ
            được bổ sung ở giai đoạn sau.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/students">Quản lý học sinh</Link>
        </Button>
      </section>
    </main>
  );
}
