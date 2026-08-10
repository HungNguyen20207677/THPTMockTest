import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-border bg-background/95 h-16 border-b">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-semibold tracking-tight">
          THPTMockTest
        </Link>
        <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium">
          Công cụ học tập cá nhân
        </span>
      </div>
    </header>
  );
}
