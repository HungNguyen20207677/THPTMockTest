"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  if (theme === "light") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4 fill-none stroke-current stroke-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 fill-none stroke-current stroke-2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { resolvedTheme, setTheme } = useTheme();
  const activeTheme =
    mounted && resolvedTheme === "dark"
      ? ("dark" as const)
      : ("light" as const);
  const nextTheme = activeTheme === "dark" ? "light" : "dark";
  const actionLabel = mounted
    ? `Chuyển sang giao diện ${nextTheme === "dark" ? "tối" : "sáng"}`
    : "Đang xác định giao diện";

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={!mounted}
      aria-label={actionLabel}
      aria-pressed={mounted ? activeTheme === "dark" : undefined}
      title={actionLabel}
      className="text-muted-foreground hover:text-foreground size-9 rounded-full"
      onClick={() => setTheme(nextTheme)}
    >
      <ThemeIcon theme={activeTheme} />
    </Button>
  );
}
