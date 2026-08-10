import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center px-6 py-16">
      <section className="max-w-2xl space-y-6">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase">
          Luyện thi Toán THPT
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Không gian luyện đề Toán THPT tập trung và gọn gàng.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg leading-8">
          Đăng nhập bằng tài khoản được cấp để sử dụng hệ thống luyện thi cá
          nhân.
        </p>
        <Button asChild>
          <Link href="/login">Đăng nhập</Link>
        </Button>
      </section>
    </main>
  );
}
