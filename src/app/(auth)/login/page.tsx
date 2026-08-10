import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/authorization";
import { ROLE_HOME } from "@/lib/constants/roles";

export const metadata: Metadata = {
  title: "Đăng nhập",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(ROLE_HOME[user.role]);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-6 py-16">
      <section className="border-border bg-background w-full space-y-7 rounded-xl border p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <p className="text-primary text-sm font-semibold tracking-wider uppercase">
            THPTMockTest
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Đăng nhập</h1>
          <p className="text-muted-foreground text-sm leading-6">
            Sử dụng tài khoản do quản trị viên cung cấp để tiếp tục.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
