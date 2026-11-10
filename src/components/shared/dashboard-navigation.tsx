"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
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
  icon: AppIconName;
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

function BrandLink({
  homeHref,
  compact = false,
}: {
  homeHref: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={homeHref}
      aria-label="THPTMockTest - Trang chính"
      className="focus-visible:ring-ring inline-flex rounded-md outline-none focus-visible:ring-2"
    >
      <Image
        src={compact ? "/icon.png" : "/logo.png"}
        alt="THPTMockTest"
        width={compact ? 32 : 240}
        height={compact ? 32 : 72}
        priority
        className={cn(
          "rounded-sm bg-white object-contain",
          compact ? "size-8" : "h-8 w-auto max-w-40",
        )}
      />
    </Link>
  );
}

function NavigationLinks({
  items,
  pathname,
  homeHref,
  onNavigate,
  collapsed = false,
}: {
  items: NavigationItem[];
  pathname: string;
  homeHref: string;
  onNavigate?: () => void;
  collapsed?: boolean;
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
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "group/nav focus-visible:ring-ring relative flex min-h-10 items-center rounded-lg py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 motion-reduce:transition-none",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                isActive
                  ? "bg-accent text-accent-foreground before:bg-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
            >
              <AppIcon name={item.icon} className="size-[1.125rem]" />
              <span className={collapsed ? "sr-only" : undefined}>
                {item.label}
              </span>
              {collapsed && (
                <span
                  role="tooltip"
                  aria-hidden="true"
                  className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-2 w-max max-w-52 -translate-y-1/2 translate-x-[-0.125rem] rounded-md border px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-[opacity,transform] duration-150 group-hover/nav:translate-x-0 group-hover/nav:opacity-100 group-focus-visible/nav:translate-x-0 group-focus-visible/nav:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function DashboardNavigation({
  user,
  items,
  children,
}: DashboardNavigationProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState({
    pathname,
    isOpen: false,
  });
  const homeHref = user.role === "ADMIN" ? "/admin" : "/student";
  const isMobileOpen = mobileMenu.pathname === pathname && mobileMenu.isOpen;

  function setIsMobileOpen(isOpen: boolean) {
    setMobileMenu({ pathname, isOpen });
  }

  function toggleSidebar() {
    setIsSidebarCollapsed((collapsed) => !collapsed);
  }

  return (
    <div className="bg-background min-h-dvh min-w-0">
      <aside
        className={cn(
          "border-border bg-card fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width] duration-200 motion-reduce:transition-none lg:flex",
          isSidebarCollapsed ? "w-16" : "w-56",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center",
            isSidebarCollapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <BrandLink homeHref={homeHref} compact={isSidebarCollapsed} />
        </div>
        <div className="min-h-0 flex-1 px-2 py-3">
          <NavigationLinks
            items={items}
            pathname={pathname}
            homeHref={homeHref}
            collapsed={isSidebarCollapsed}
          />
        </div>
        <div className="border-border shrink-0 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "group/collapse relative h-10 w-full",
              isSidebarCollapsed ? "px-0" : "justify-start px-3",
            )}
            aria-label={
              isSidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"
            }
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? "Mở rộng thanh bên" : undefined}
            onClick={toggleSidebar}
          >
            <AppIcon
              name={isSidebarCollapsed ? "panel-left-open" : "panel-left-close"}
              className="size-[1.125rem]"
            />
            {!isSidebarCollapsed && <span>Thu gọn</span>}
            {isSidebarCollapsed && (
              <span
                role="tooltip"
                aria-hidden="true"
                className="bg-popover text-popover-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-2 w-max -translate-y-1/2 translate-x-[-0.125rem] rounded-md border px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-[opacity,transform] duration-150 group-hover/collapse:translate-x-0 group-hover/collapse:opacity-100 group-focus-visible/collapse:translate-x-0 group-focus-visible/collapse:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
              >
                Mở rộng thanh bên
              </span>
            )}
          </Button>
        </div>
      </aside>

      <div
        className={cn(
          "min-w-0 transition-[padding] duration-200 motion-reduce:transition-none",
          isSidebarCollapsed ? "lg:pl-16" : "lg:pl-56",
        )}
      >
        <header className="border-border bg-background/90 sticky top-0 z-30 h-14 border-b backdrop-blur-md">
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
                  <AppIcon name="menu" />
                </Button>
              </DialogTrigger>
              <DialogContent
                showCloseButton
                className="inset-y-0 top-0 left-0 h-dvh max-h-dvh w-[min(18rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 grid-rows-[4rem_minmax(0,1fr)] gap-0 rounded-none border-y-0 border-l-0 p-0 data-[state=closed]:motion-safe:animate-[ui-drawer-out_160ms_ease-in] data-[state=open]:motion-safe:animate-[ui-drawer-in_180ms_ease-out]"
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

            <div className="min-w-0 flex-1" />
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        <div className="min-w-0 overflow-x-clip">{children}</div>
      </div>
    </div>
  );
}
