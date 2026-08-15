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
          onClick={() => setRefreshVersion((version) => version + 1)}
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
    },
    {
      label: "Tổng số đề thi",
      value: summary.examCount,
    },
    {
      label: "Đề đang xuất bản",
      value: summary.publishedExamCount,
    },
    {
      label: "Lượt đang làm",
      value: summary.activeAttemptCount,
    },
    {
      label: "Lượt đã hoàn thành",
      value: summary.completedAttemptCount,
    },
  ];

  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <div>
        <h2 id="overview-heading" className="text-xl font-bold">
          Số liệu hiện tại
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Lượt hết giờ được chốt tự động trước khi tổng hợp.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-border bg-background rounded-xl border p-4 shadow-sm"
          >
            <p className="text-muted-foreground text-sm">{metric.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
