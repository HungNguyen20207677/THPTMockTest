"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const activeAttemptPathPattern =
  /^\/student\/exams\/[^/]+\/attempts\/[^/]+\/?$/;

export function PublicHeaderBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthenticatedRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/student" ||
    pathname.startsWith("/student/");

  return isAuthenticatedRoute ? null : children;
}

export function StudentHeaderBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return activeAttemptPathPattern.test(pathname) ? null : children;
}
