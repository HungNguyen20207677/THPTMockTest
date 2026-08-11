"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminResultListPanel } from "@/components/admin/result-list-panel";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchAdminExamResults } from "@/lib/api/reporting";
import { formatScore, scoreFormatter } from "@/lib/formatting";
import type { AdminExamResults } from "@/types/reporting";

const statusLabels = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  HIDDEN: "Đã ẩn",
} as const;

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải thống kê đề thi. Vui lòng thử lại.";
}

function formatImprovement(value: number | null): string {
  if (value === null) return "Chưa có";
  return `${value > 0 ? "+" : ""}${scoreFormatter.format(value)}`;
}

export function AdminExamResultsView({ examId }: { examId: string }) {
  const [report, setReport] = useState<AdminExamResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminExamResults(examId)
      .then((response) => {
        if (isCurrent) {
          setReport(response.data.report);
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
  }, [examId]);

  if (error) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/exams">Quay lại danh sách đề thi</Link>
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <p className="text-muted-foreground py-12 text-center" aria-live="polite">
        Đang tải thống kê đề thi...
      </p>
    );
  }

  const metrics = [
    { label: "Lượt hoàn thành", value: String(report.completedAttemptCount) },
    { label: "Lượt đang làm", value: String(report.activeAttemptCount) },
    {
      label: "Học sinh đã hoàn thành",
      value: String(report.distinctStudentCount),
    },
    { label: "Điểm trung bình", value: formatScore(report.statistics.average) },
    { label: "Điểm cao nhất", value: formatScore(report.statistics.highest) },
    { label: "Điểm thấp nhất", value: formatScore(report.statistics.lowest) },
    { label: "Nộp chủ động", value: String(report.submittedAttemptCount) },
    { label: "Tự động nộp", value: String(report.autoSubmittedAttemptCount) },
  ];

  return (
    <div className="space-y-8">
      <header className="border-border bg-background rounded-xl border p-6 shadow-sm">
        <p className="text-primary text-sm font-semibold">THỐNG KÊ ĐỀ THI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {report.exam.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          Trạng thái hiện tại: {statusLabels[report.exam.status]}
        </p>
      </header>

      <section aria-labelledby="exam-summary-heading" className="space-y-4">
        <h2 id="exam-summary-heading" className="text-xl font-bold">
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

      <section aria-labelledby="exam-students-heading" className="space-y-4">
        <div>
          <h2 id="exam-students-heading" className="text-xl font-bold">
            Kết quả theo học sinh
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Danh sách sắp theo tên, không xếp hạng theo điểm.
          </p>
        </div>
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead className="bg-muted/70">
              <tr>
                {[
                  "Học sinh",
                  "Số lượt",
                  "Lần đầu",
                  "Gần nhất",
                  "Tốt nhất",
                  "Trung bình",
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
              {report.students.map((item, index) => (
                <tr
                  key={item.student?.id ?? `missing-${index}`}
                  className="border-border border-t"
                >
                  <td className="px-4 py-3">
                    {item.student ? (
                      <div>
                        <Link
                          className="font-medium underline-offset-4 hover:underline"
                          href={`/admin/students/${item.student.id}`}
                        >
                          {item.student.fullName}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          @{item.student.username}
                        </p>
                      </div>
                    ) : (
                      "Tài khoản đã xóa"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.statistics.completedAttemptCount}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.first)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.latest)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.best)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatScore(item.statistics.average)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatImprovement(item.statistics.improvement)}
                  </td>
                </tr>
              ))}
              {report.students.length === 0 && (
                <tr className="border-border border-t">
                  <td
                    colSpan={7}
                    className="text-muted-foreground px-4 py-10 text-center"
                  >
                    Đề thi chưa có lượt làm bài đã hoàn thành.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="exam-results-heading" className="space-y-4">
        <h2 id="exam-results-heading" className="text-xl font-bold">
          Các lượt đã hoàn thành
        </h2>
        <AdminResultListPanel examId={examId} />
      </section>

      <Button asChild variant="outline">
        <Link href="/admin/exams">Quay lại danh sách đề thi</Link>
      </Button>
    </div>
  );
}
