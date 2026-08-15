import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonStatus({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

function TableShape({
  columns = 6,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  const widths = ["w-24", "w-32", "w-20", "w-28"];

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div
        className="bg-muted/70 grid gap-5 px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(5rem, 1fr))` }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className={cn("h-4", widths[index % 4])} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="border-border grid min-h-14 items-center gap-5 border-t px-4 py-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(5rem, 1fr))`,
          }}
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn(
                "h-4",
                widths[(rowIndex + columnIndex) % widths.length],
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MetricCardsSkeleton({
  count = 5,
  label = "Đang tải số liệu tổng quan",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <SkeletonStatus label={label} className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="border-border bg-background space-y-3 rounded-xl border p-4 shadow-sm"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function TableSkeleton({
  columns = 6,
  rows = 5,
  label = "Đang tải bảng dữ liệu",
}: {
  columns?: number;
  rows?: number;
  label?: string;
}) {
  return (
    <SkeletonStatus label={label} className="overflow-x-auto">
      <div className="min-w-3xl">
        <TableShape columns={columns} rows={rows} />
      </div>
    </SkeletonStatus>
  );
}

export function ExamCardsSkeleton() {
  return (
    <SkeletonStatus label="Đang tải danh sách đề thi">
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-border bg-background flex min-h-52 flex-col rounded-xl border p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="mt-auto flex gap-2 pt-6">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function StatisticsSkeleton({
  label,
  metricCount = 6,
  tableColumns = 7,
}: {
  label: string;
  metricCount?: number;
  tableColumns?: number;
}) {
  return (
    <SkeletonStatus label={label} className="space-y-8">
      <div className="border-border bg-background space-y-3 rounded-xl border p-6 shadow-sm">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-48" />
      </div>
      {metricCount > 0 && (
        <div className="space-y-4">
          <Skeleton className="h-7 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: metricCount }, (_, index) => (
              <div
                key={index}
                className="border-border bg-background space-y-3 rounded-xl border p-4"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-4 overflow-x-auto">
        <Skeleton className="h-7 w-48" />
        <div className="min-w-3xl">
          <TableShape columns={tableColumns} rows={4} />
        </div>
      </div>
    </SkeletonStatus>
  );
}

export function ResultDetailSkeleton({ label }: { label: string }) {
  return (
    <SkeletonStatus label={label} className="space-y-8">
      <div className="border-border bg-background space-y-3 rounded-xl border p-6 shadow-sm">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-3/4 max-w-2xl" />
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </SkeletonStatus>
  );
}

export function ExamFormSkeleton() {
  return (
    <SkeletonStatus label="Đang tải đề thi" className="space-y-8">
      {Array.from({ length: 3 }, (_, sectionIndex) => (
        <div
          key={sectionIndex}
          className="border-border bg-background space-y-5 rounded-xl border p-5 shadow-sm"
        >
          <Skeleton className="h-7 w-48" />
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: sectionIndex === 2 ? 6 : 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonStatus>
  );
}

export function ExamWorkspaceSkeleton() {
  return (
    <SkeletonStatus label="Đang tải không gian làm bài" className="h-full">
      <div className="flex h-full min-h-[calc(100dvh-1rem)] flex-col gap-2 lg:min-h-0">
        <div className="border-border bg-background flex min-h-14 items-center justify-between rounded-lg border px-3 shadow-sm">
          <Skeleton className="hidden h-5 w-64 lg:block" />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="size-9" />
            <Skeleton className="h-9 w-14 sm:w-20" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(24rem,2fr)]">
          <div className="border-border bg-background min-h-[65dvh] rounded-xl border lg:min-h-0">
            <div className="border-border flex h-9 items-center gap-3 border-b px-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="border-border bg-background space-y-4 rounded-xl border p-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </SkeletonStatus>
  );
}
