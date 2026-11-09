"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import type { AppUser } from "@/types/user";

interface NavigationItem {
  href: string;
  label: string;
}

interface DashboardNavigationProps {
  user: AppUser;
  items: NavigationItem[];
}

export function DashboardNavigation({ user, items }: DashboardNavigationProps) {
  const pathname = usePathname();
  const homeHref = user.role === "ADMIN" ? "/admin" : "/student";

  return (
    <header className="border-border bg-background/90 sticky top-0 z-40 h-15 border-b backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href={homeHref}
          aria-label="THPTMockTest - Trang chính"
          className="focus-visible:ring-ring shrink-0 rounded-md outline-none focus-visible:ring-2"
        >
          <Image
            src="/logo.png"
            alt="THPTMockTest"
            width={240}
            height={72}
            priority
            className="h-8 w-auto max-w-28 rounded-sm bg-white object-contain sm:max-w-40"
          />
        </Link>
        <nav
          aria-label="Điều hướng chính"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max items-center gap-0.5">
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== homeHref &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 sm:px-3"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
