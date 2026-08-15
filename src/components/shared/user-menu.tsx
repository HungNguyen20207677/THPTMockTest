"use client";

import { useEffect, useId, useRef, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import type { AppUser } from "@/types/user";

function getInitials(fullName: string): string {
  const names = fullName.trim().split(/\s+/);
  const firstInitial = names[0]?.[0] ?? "";
  const lastInitial = names.length > 1 ? (names.at(-1)?.[0] ?? "") : "";
  return `${firstInitial}${lastInitial}`.toLocaleUpperCase("vi-VN");
}

export function UserMenu({ user }: { user: AppUser }) {
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 items-center gap-2 rounded-lg border border-transparent px-1.5 outline-none transition-colors focus-visible:ring-3 sm:px-2"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-bold">
          {getInitials(user.fullName)}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium md:block">
          {user.fullName}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="text-muted-foreground hidden size-4 sm:block"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" />
        </svg>
        <span className="sr-only">
          {isOpen ? "Đóng menu tài khoản" : "Mở menu tài khoản"}
        </span>
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="border-border bg-background absolute top-[calc(100%+0.5rem)] right-0 z-50 w-64 overflow-hidden rounded-xl border shadow-lg"
        >
          <div className="border-border border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              @{user.username}
            </p>
          </div>
          <div className="p-2">
            <LogoutButton presentation="menu" />
          </div>
        </div>
      )}
    </div>
  );
}
