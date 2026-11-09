import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(
        "bg-muted-foreground/15 animate-pulse rounded-md motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
