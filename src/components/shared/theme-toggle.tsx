"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const themes = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
  { value: "system", label: "Hệ thống" },
] as const;

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
        <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();
  const selectedTheme = mounted && theme ? theme : "system";

  return (
    <label className="group relative inline-flex shrink-0 items-center">
      <span className="pointer-events-none absolute left-2.5 z-10 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:stroke-linecap-round [&_svg]:stroke-linejoin-round">
        <ThemeIcon theme={selectedTheme} />
      </span>
      <span className="sr-only">Giao diện</span>
      <select
        aria-label="Chọn giao diện"
        value={selectedTheme}
        disabled={!mounted}
        onChange={(event) => setTheme(event.target.value)}
        className="border-input bg-background hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 h-9 cursor-pointer appearance-none rounded-md border py-1 pr-7 pl-8 text-sm font-medium outline-none transition-colors focus-visible:ring-3 disabled:cursor-wait sm:pr-8"
      >
        {themes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="text-muted-foreground pointer-events-none absolute right-2 size-3.5 fill-none stroke-current stroke-2"
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" />
      </svg>
    </label>
  );
}
