import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="border-border bg-background/95 h-16 border-b">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          aria-label="THPTMockTest - Trang chủ"
          className="flex items-center"
        >
          <Image
            src="/logo.png"
            alt="THPTMockTest"
            width={240}
            height={72}
            priority
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>
    </header>
  );
}
