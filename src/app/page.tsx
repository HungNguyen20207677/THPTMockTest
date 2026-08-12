"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function HomePage() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-white">
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
        {/* Left */}
        <motion.section
          initial="hidden"
          animate="visible"
          transition={{
            staggerChildren: 0.12,
            delayChildren: 0.1,
          }}
          className="max-w-2xl"
        >
          <motion.h1
            variants={fadeUp}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl lg:leading-[1.08]"
          >
            Không gian luyện đề Toán THPT{" "}
            <span className="text-primary">tập trung và gọn gàng.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="text-muted-foreground mt-6 max-w-xl text-base"
          >
            Làm đề thi thử theo đúng cấu trúc kỳ thi THPT, theo dõi kết quả và
            tiến bộ qua từng lần làm bài.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <Button
              asChild
              size="lg"
              className="px-6 animate-wiggle-cycle hover:animate-none active:animate-none"
            >
              <Link href="/login">Đăng nhập</Link>
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={{
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-10 grid grid-cols-3 border-t pt-6"
          >
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
          </motion.div>
        </motion.section>

        {/* Right */}
        <motion.section
          initial={{
            opacity: 0,
            x: 40,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.8,
            delay: 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative mx-auto w-full max-w-xl lg:max-w-none"
        >
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
        </motion.section>
      </div>
    </main>
  );
}
