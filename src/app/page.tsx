import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-white">
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
        {/* Left */}
        <section className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.08]">
            Không gian luyện đề Toán THPT{" "}
            <span className="text-primary">tập trung và gọn gàng.</span>
          </h1>

          <p className="text-muted-foreground mt-6 max-w-xl text-base">
            Làm đề thi thử theo đúng cấu trúc kỳ thi THPT, theo dõi kết quả và
            tiến bộ qua từng lần làm bài.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="px-6">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-3 border-t pt-6">
            <div className="px-4 first:pl-0">
              <p className="text-foreground text-sm font-semibold">90 phút</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Tổng thời gian làm bài thi
              </p>
            </div>

            <div className="border-l px-4">
              <p className="text-foreground text-sm font-semibold">22 câu</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Theo cấu trúc hiện hành
              </p>
            </div>

            <div className="border-l px-4">
              <p className="text-foreground text-sm font-semibold">3 phần</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Đa dạng dạng câu hỏi
              </p>
            </div>
          </div>
        </section>

        {/* Right */}
        <section className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div aria-hidden="true" className="absolute inset-8 " />

          <div className="relative overflow-hidden p-3">
            <Image
              src="/landing-illustration.jpg"
              alt="Minh họa giao diện luyện thi THPTMockTest"
              width={900}
              height={720}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
