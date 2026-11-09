import Link from "next/link";
import Image from "next/image";

import { ThemeToggle } from "@/components/shared/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-border bg-background/90 sticky top-0 z-40 h-15 border-b backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="THPTMockTest - Trang chủ"
          className="focus-visible:ring-ring flex items-center rounded-md outline-none focus-visible:ring-2"
        >
          <Image
            src="/logo.png"
            alt="THPTMockTest"
            width={240}
            height={72}
            priority
            className="h-8 w-auto max-w-44 rounded-sm bg-white object-contain sm:h-9 sm:max-w-none"
          />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
