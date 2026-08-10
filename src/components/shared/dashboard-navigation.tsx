import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
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
    <div className="border-border bg-background border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="font-medium">{user.fullName}</p>
            <p className="text-muted-foreground text-sm">@{user.username}</p>
          </div>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
