import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-primary text-sm font-semibold">KHÔNG TÌM THẤY</p>
      <h1 className="mt-2 text-3xl font-bold">Trang không tồn tại</h1>
      <p className="text-muted-foreground mt-3">
        Đường dẫn không hợp lệ hoặc nội dung đã không còn khả dụng.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Quay về trang chính</Link>
      </Button>
    </main>
  );
}
