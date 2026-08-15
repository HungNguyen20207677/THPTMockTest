import Link from "next/link";
import Image from "next/image";

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
  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 h-15 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-3 sm:gap-5 sm:px-6">
        <Link
          href={user.role === "ADMIN" ? "/admin" : "/student"}
          aria-label="THPTMockTest - Trang chính"
          className="shrink-0"
        >
          <Image
            src="/logo.png"
            alt="THPTMockTest"
            width={240}
            height={72}
            priority
            className="h-8 w-auto max-w-32 object-contain sm:max-w-40"
          />
        </Link>
        <nav
          aria-label="Điều hướng chính"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max items-center gap-0.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:bg-accent rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-3"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
