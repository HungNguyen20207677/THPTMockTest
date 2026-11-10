import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export type AppIconName =
  | "bar-chart"
  | "book-open"
  | "clipboard-check"
  | "eye"
  | "file-text"
  | "graduation-cap"
  | "key-round"
  | "layout-dashboard"
  | "layout-template"
  | "lock"
  | "lock-open"
  | "menu"
  | "panel-left-close"
  | "panel-left-open"
  | "pencil"
  | "trash-2"
  | "users";

export function AppIcon({
  name,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { name: AppIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      {name === "layout-dashboard" && (
        <>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </>
      )}
      {name === "users" && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === "file-text" && (
        <>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h8M8 17h8M8 9h2" />
        </>
      )}
      {name === "book-open" && (
        <>
          <path d="M2 6a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H2z" />
          <path d="M22 6a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3h7z" />
        </>
      )}
      {name === "layout-template" && (
        <>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </>
      )}
      {name === "clipboard-check" && (
        <>
          <rect width="14" height="18" x="5" y="3" rx="2" />
          <path d="M9 5a3 3 0 0 1 6 0M9 12l2 2 4-4" />
        </>
      )}
      {name === "graduation-cap" && (
        <>
          <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0z" />
          <path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
        </>
      )}
      {name === "panel-left-close" && (
        <>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18M16 15l-3-3 3-3" />
        </>
      )}
      {name === "panel-left-open" && (
        <>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18M14 9l3 3-3 3" />
        </>
      )}
      {name === "menu" && <path d="M4 6h16M4 12h16M4 18h16" />}
      {name === "eye" && (
        <>
          <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.6 7.6 7.52 5 12 5s8.4 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.4 16.4 16.48 19 12 19s-8.4-2.6-9.94-6.65" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
      {name === "pencil" && (
        <>
          <path d="M21.17 6.17 17.83 2.83a2 2 0 0 0-2.83 0L3 14.83V21h6.17l12-12a2 2 0 0 0 0-2.83z" />
          <path d="m15 5 4 4M3 17h6" />
        </>
      )}
      {name === "trash-2" && (
        <>
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
        </>
      )}
      {name === "key-round" && (
        <>
          <path d="M2.59 13.41a2 2 0 0 0 0 2.82l1.18 1.18a2 2 0 0 0 2.82 0L9 15h3v-3l.59-.59a6 6 0 1 0-4-4z" />
          <circle cx="16" cy="8" r="1" />
        </>
      )}
      {name === "lock" && (
        <>
          <rect width="18" height="11" x="3" y="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      )}
      {name === "lock-open" && (
        <>
          <rect width="18" height="11" x="3" y="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </>
      )}
      {name === "bar-chart" && (
        <>
          <path d="M3 3v18h18M7 16v-5M12 16V8M17 16V5" />
        </>
      )}
    </svg>
  );
}
