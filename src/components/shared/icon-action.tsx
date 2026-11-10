"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IconActionProps extends Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "size"
> {
  label: string;
  icon: AppIconName;
  href?: string;
  destructive?: boolean;
}

export function IconAction({
  label,
  icon,
  href,
  destructive = false,
  variant = "ghost",
  className,
  type,
  ...props
}: IconActionProps) {
  const buttonClassName = cn(
    "size-9 rounded-lg",
    destructive &&
      "text-destructive hover:bg-destructive/10 hover:text-destructive",
    className,
  );
  const content = <AppIcon name={icon} className="size-4" />;

  return (
    <span className="group/action relative inline-flex">
      {href ? (
        <Button
          asChild
          size="icon"
          variant={variant}
          className={buttonClassName}
          {...props}
        >
          <Link href={href} aria-label={label} title={label}>
            {content}
          </Link>
        </Button>
      ) : (
        <Button
          type={type ?? "button"}
          size="icon"
          variant={variant}
          aria-label={label}
          title={label}
          className={buttonClassName}
          {...props}
        >
          {content}
        </Button>
      )}
      <span
        role="tooltip"
        aria-hidden="true"
        className="bg-popover text-popover-foreground pointer-events-none absolute top-full right-0 z-50 mt-1.5 w-max max-w-56 translate-y-[-0.125rem] rounded-md border px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-[opacity,transform] duration-150 group-hover/action:translate-y-0 group-hover/action:opacity-100 group-focus-within/action:translate-y-0 group-focus-within/action:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
      >
        {label}
      </span>
    </span>
  );
}
