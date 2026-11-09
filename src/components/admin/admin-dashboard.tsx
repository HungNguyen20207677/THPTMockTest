"use client";

import { useEffect, useState } from "react";

import { MetricCardsSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchAdminDashboardSummary } from "@/lib/api/reporting";
import type { AdminDashboardSummary } from "@/types/reporting";

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải số liệu tổng quan. Vui lòng thử lại.";
}

export function AdminDashboard() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminDashboardSummary()
      .then((response) => {
        if (isCurrent) {
          setSummary(response.data.summary);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(getRequestError(requestError));
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshVersion]);

  if (error) {
    return (
      <div className="border-border space-y-3 rounded-xl border p-5">
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            setRefreshVersion((version) => version + 1);
          }}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  if (!summary) {
    return <MetricCardsSkeleton />;
  }

  const metrics = [
    {
      label: "Học sinh hoạt động",
      value: summary.activeStudentCount,
      icon: "students",
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Tổng số đề thi",
      value: summary.examCount,
      icon: "exams",
      tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    {
      label: "Đề đang xuất bản",
      value: summary.publishedExamCount,
      icon: "published",
      tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Lượt đang làm",
      value: summary.activeAttemptCount,
      icon: "active",
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    {
      label: "Lượt đã hoàn thành",
      value: summary.completedAttemptCount,
      icon: "completed",
      tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    },
  ] as const;

  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="overview-heading" className="text-lg font-semibold">
            Tổng quan hệ thống
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Các chỉ số hoạt động hiện tại của học sinh và đề thi.
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Lượt hết giờ được chốt tự động trước khi tổng hợp.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-border bg-card hover:border-primary/25 rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow] hover:shadow-sm"
          >
            <div
              className={`flex size-8 items-center justify-center rounded-md ${metric.tone}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4 fill-none stroke-current stroke-2"
              >
                {metric.icon === "students" && (
                  <>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </>
                )}
                {metric.icon === "exams" && (
                  <>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6M8 13h8M8 17h6" />
                  </>
                )}
                {metric.icon === "published" && (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12 2.5 2.5L16 9" />
                  </>
                )}
                {metric.icon === "active" && (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                )}
                {metric.icon === "completed" && (
                  <>
                    <path d="M9 11 12 14 22 4" />
                    <path d="M21 12a9 9 0 1 1-5.3-8.2" />
                  </>
                )}
              </svg>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">
              {metric.value}
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-5">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
