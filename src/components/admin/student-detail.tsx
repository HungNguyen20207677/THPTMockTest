"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminResultListPanel } from "@/components/admin/result-list-panel";
import { StatisticsSkeleton } from "@/components/shared/loading-skeletons";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchAdminStudentDetail } from "@/lib/api/reporting";
import { formatScore, scoreFormatter } from "@/lib/formatting";
import type { AdminStudentDetail } from "@/types/reporting";

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải thống kê học sinh. Vui lòng thử lại.";
}

function formatImprovement(value: number | null): string {
  if (value === null) return "Chưa có";
  return `${value > 0 ? "+" : ""}${scoreFormatter.format(value)}`;
}

export function AdminStudentDetailView({ studentId }: { studentId: string }) {
  const [detail, setDetail] = useState<AdminStudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminStudentDetail(studentId)
      .then((response) => {
        if (isCurrent) {
          setDetail(response.data.detail);
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
  }, [studentId]);

  if (error) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/students">Quay lại danh sách học sinh</Link>
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <StatisticsSkeleton label="Đang tải thống kê học sinh" metricCount={6} />
    );
  }

  const metrics = [
    {
      label: "Lượt đã hoàn thành",
      value: String(detail.statistics.completedAttemptCount),
    },
    { label: "Lượt đang làm", value: String(detail.activeAttemptCount) },
    { label: "Số đề đã tham gia", value: String(detail.distinctExamCount) },
    { label: "Điểm trung bình", value: formatScore(detail.statistics.average) },
    { label: "Điểm tốt nhất", value: formatScore(detail.statistics.best) },
    { label: "Điểm gần nhất", value: formatScore(detail.statistics.latest) },
  ];

  return (
    <div className="space-y-8">
      <header className="border-border bg-background rounded-xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-primary text-sm font-semibold">HỒ SƠ KẾT QUẢ</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {detail.student.fullName}
            </h1>
            <p className="text-muted-foreground mt-2">
              @{detail.student.username}
            </p>
          </div>
          <span
            className={
              detail.student.isActive
                ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800"
                : "rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700"
            }
          >
            {detail.student.isActive ? "Hoạt động" : "Đã khóa"}
          </span>
        </div>
      </header>

      <section aria-labelledby="student-summary-heading" className="space-y-4">
        <h2 id="student-summary-heading" className="text-xl font-bold">
          Tổng quan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="border-border bg-background rounded-xl border p-4"
            >
              <p className="text-muted-foreground text-sm">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="student-exams-heading" className="space-y-4">
        <div>
          <h2 id="student-exams-heading" className="text-xl font-bold">
            Kết quả theo đề thi
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Mức thay đổi là điểm gần nhất trừ điểm lần đầu của cùng đề.
          </p>
        </div>
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-3xl border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
            <thead className="bg-muted/70">
              <tr>
                {[
                  "Đề thi",
                  "Hoàn thành",
                  "Đang làm",
                  "Trung bình",
                  "Tốt nhất",
                  "Gần nhất",
                  "Thay đổi",
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-4 py-3 text-left font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.exams.map((item, index) => (
                <tr
                  key={item.exam?.id ?? `missing-${index}`}
                  className="border-border border-t"
                >
                  <td className="px-4 py-3 font-medium">
                    {item.exam ? (
                      <Link
                        className="underline-offset-4 hover:underline"
                        href={`/admin/exams/${item.exam.id}/results`}
                      >
                        {item.exam.title}
                      </Link>
                    ) : (
                      "Đề thi không còn tồn tại"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.statistics.completedAttemptCount}
                  </td>
                  <td className="px-4 py-3">{item.activeAttemptCount}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.average)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.best)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.latest)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatImprovement(item.statistics.improvement)}
                  </td>
                </tr>
              ))}
              {detail.exams.length === 0 && (
                <tr className="border-border border-t">
                  <td
                    colSpan={7}
                    className="text-muted-foreground px-4 py-10 text-center"
                  >
                    Học sinh chưa có lượt làm bài.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="student-results-heading" className="space-y-4">
        <h2 id="student-results-heading" className="text-xl font-bold">
          Các lượt đã hoàn thành
        </h2>
        <AdminResultListPanel studentId={studentId} />
      </section>

      <Button asChild variant="outline">
        <Link href="/admin/students">Quay lại danh sách học sinh</Link>
      </Button>
    </div>
  );
}
