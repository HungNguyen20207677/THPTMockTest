"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/types/user";

interface NavigationItem {
  href: string;
  label: string;
}

interface DashboardNavigationProps {
  user: AppUser;
  items: NavigationItem[];
  children: ReactNode;
}

function isNavigationItemActive(
  pathname: string,
  href: string,
  homeHref: string,
): boolean {
  return (
    pathname === href || (href !== homeHref && pathname.startsWith(`${href}/`))
  );
}

function BrandLink({ homeHref }: { homeHref: string }) {
  return (
    <Link
      href={homeHref}
      aria-label="THPTMockTest - Trang chính"
      className="focus-visible:ring-ring inline-flex rounded-md outline-none focus-visible:ring-2"
    >
      <Image
        src="/logo.png"
        alt="THPTMockTest"
        width={240}
        height={72}
        priority
        className="h-8 w-auto max-w-40 rounded-sm bg-white object-contain"
      />
    </Link>
  );
}

function NavigationLinks({
  items,
  pathname,
  homeHref,
  onNavigate,
}: {
  items: NavigationItem[];
  pathname: string;
  homeHref: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Điều hướng chính" className="min-h-0 flex-1">
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = isNavigationItemActive(
            pathname,
            item.href,
            homeHref,
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current stroke-2"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function DashboardNavigation({
  user,
  items,
  children,
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const [mobileMenu, setMobileMenu] = useState({
    pathname,
    isOpen: false,
  });
  const homeHref = user.role === "ADMIN" ? "/admin" : "/student";
  const isMobileOpen = mobileMenu.pathname === pathname && mobileMenu.isOpen;
  const activeItem = items.find((item) =>
    isNavigationItemActive(pathname, item.href, homeHref),
  );

  function setIsMobileOpen(isOpen: boolean) {
    setMobileMenu({ pathname, isOpen });
  }

  return (
    <div className="bg-background min-h-dvh min-w-0">
      <aside className="border-border bg-card fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <BrandLink homeHref={homeHref} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <NavigationLinks
            items={items}
            pathname={pathname}
            homeHref={homeHref}
          />
        </div>
      </aside>

      <div className="min-w-0 lg:pl-56">
        <header className="border-border bg-background/90 sticky top-0 z-30 h-15 border-b backdrop-blur-md">
          <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-6">
            <Dialog open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="lg:hidden"
                  aria-label="Mở menu điều hướng"
                >
                  <MenuIcon />
                </Button>
              </DialogTrigger>
              <DialogContent
                showCloseButton
                className="inset-y-0 top-0 left-0 h-dvh max-h-dvh w-[min(18rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 grid-rows-[4rem_minmax(0,1fr)] gap-0 rounded-none border-y-0 border-l-0 p-0"
              >
                <DialogTitle className="sr-only">Menu điều hướng</DialogTitle>
                <div className="border-border flex items-center border-b px-5 pr-14">
                  <BrandLink homeHref={homeHref} />
                </div>
                <div className="min-h-0 overflow-y-auto px-3 py-4">
                  <NavigationLinks
                    items={items}
                    pathname={pathname}
                    homeHref={homeHref}
                    onNavigate={() => setIsMobileOpen(false)}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <p className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
              {activeItem?.label ?? "Trang chính"}
            </p>
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        <div className="min-w-0 overflow-x-clip">{children}</div>
      </div>
    </div>
  );
}
