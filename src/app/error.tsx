"use client";

import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="text-destructive text-sm font-semibold">ĐÃ XẢY RA LỖI</p>
      <h1 className="mt-2 text-3xl font-bold">Không thể tải trang</h1>
      <p className="text-muted-foreground mt-3">
        Vui lòng thử lại. Nếu lỗi tiếp tục xảy ra, hãy quay lại sau.
      </p>
      <Button type="button" className="mt-6" onClick={reset}>
        Thử lại
      </Button>
    </main>
  );
}
