import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SkeletonStatus({
  label,
  className,
  containerClassName,
  children,
}: {
  label: string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={containerClassName}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
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

function PageHeaderShape({
  action = false,
  eyebrow = false,
}: {
  action?: boolean;
  eyebrow?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && <Skeleton className="h-4 w-36" />}
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

export function DashboardSkeleton({
  variant,
}: {
  variant: "admin" | "student";
}) {
  return (
    <SkeletonStatus
      label={
        variant === "admin"
          ? "Đang tải trang tổng quan"
          : "Đang tải trang học sinh"
      }
      className="space-y-8"
    >
      {variant === "admin" ? (
        <div className="border-border bg-background space-y-5 rounded-xl border p-6 shadow-sm">
          <PageHeaderShape eyebrow />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      ) : (
        <PageHeaderShape eyebrow />
      )}

      {variant === "admin" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="border-border bg-background space-y-3 rounded-xl border p-4 shadow-sm"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
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
      )}
    </SkeletonStatus>
  );
}

export function ManagementTableSkeleton({
  columns,
  label,
  filters = false,
}: {
  columns: number;
  label: string;
  filters?: boolean;
}) {
  return (
    <SkeletonStatus label={label} className="space-y-6">
      <PageHeaderShape action={!filters} eyebrow={filters} />
      {filters && (
        <div className="border-border bg-muted/30 grid gap-3 rounded-xl border p-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-3xl">
          <TableShape columns={columns} rows={6} />
        </div>
      </div>
    </SkeletonStatus>
  );
}

export function CurriculumTreeSkeleton({
  includeHeader = false,
}: {
  includeHeader?: boolean;
}) {
  return (
    <SkeletonStatus label="Đang tải cây kiến thức" className="space-y-6">
      {includeHeader && <PageHeaderShape action />}
      <div className="space-y-4">
        {Array.from({ length: 2 }, (_, gradeIndex) => (
          <div
            key={gradeIndex}
            className="border-border bg-background rounded-xl border shadow-sm"
          >
            <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 2 }, (_, chapterIndex) => (
                <div
                  key={chapterIndex}
                  className="border-border overflow-hidden rounded-lg border"
                >
                  <div className="bg-muted/30 border-border flex items-center justify-between border-b px-3 py-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-7 w-28" />
                  </div>
                  <div className="space-y-3 px-3 py-3">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-4 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

export function TopicSelectorSkeleton() {
  return (
    <SkeletonStatus
      label="Đang tải danh sách chủ đề"
      className="space-y-2 px-1"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-start gap-2 py-1">
          <Skeleton className="size-4 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </SkeletonStatus>
  );
}

export function StudentPickerSkeleton() {
  return (
    <SkeletonStatus label="Đang tải danh sách học sinh" className="space-y-3">
      <Skeleton className="h-9 w-full" />
      <div className="border-border space-y-3 rounded-md border p-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-start gap-3">
            <Skeleton className="size-4 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
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

export function ExamFormSkeleton({
  includeHeader = false,
}: {
  includeHeader?: boolean;
} = {}) {
  return (
    <SkeletonStatus label="Đang tải đề thi" className="space-y-8">
      {includeHeader && <PageHeaderShape />}
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
    <SkeletonStatus
      label="Đang tải không gian làm bài"
      className="h-full"
      containerClassName="h-full"
    >
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
