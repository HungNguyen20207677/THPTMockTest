"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchAdminExamAssignmentCompletion } from "@/lib/api/reporting";
import { examAvailabilityDateFormatter } from "@/lib/exam/availability";
import type { AdminExamAssignmentCompletionPage } from "@/types/reporting";

const PAGE_SIZE = 20;
const completionStatusLabels = {
  NOT_STARTED: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  COMPLETED: "Hoàn thành",
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
  return "Không thể tải tiến độ hoàn thành. Vui lòng thử lại.";
}

export function ExamCompletionTracking({ examId }: { examId: string }) {
  const [page, setPage] = useState(1);
  const [report, setReport] =
    useState<AdminExamAssignmentCompletionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminExamAssignmentCompletion(examId, page, PAGE_SIZE)
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
  }, [examId, page, refreshVersion]);

  if (error) {
    return (
      <div className="border-border space-y-3 rounded-xl border p-4">
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRefreshVersion((version) => version + 1)}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        role="status"
        className="border-border rounded-xl border p-6 text-sm"
      >
        Đang tải tiến độ hoàn thành...
      </div>
    );
  }

  const metrics = [
    ["Được phân công", report.totals.assigned],
    ["Hoàn thành", report.totals.completed],
    ["Đang làm", report.totals.inProgress],
    ["Chưa làm", report.totals.notStarted],
    ...(report.exam.assignmentDueAt
      ? ([["Quá hạn", report.totals.overdue]] as Array<[string, number]>)
      : []),
  ] as Array<[string, number]>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-sm">
          {report.exam.assignmentDueAt
            ? `Hạn hoàn thành: ${examAvailabilityDateFormatter.format(new Date(report.exam.assignmentDueAt))}`
            : "Không đặt hạn hoàn thành"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="border-border bg-card rounded-xl border p-3 shadow-xs"
          >
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="border-border overflow-x-auto rounded-xl border shadow-xs">
        <table className="w-full min-w-[48rem] border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
          <thead className="bg-muted/70">
            <tr>
              {[
                "Học sinh",
                "Trạng thái",
                "Thời điểm hoàn thành đầu tiên",
                "Đúng hạn",
                "Kết quả",
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
            {report.students.map((item) => (
              <tr
                key={item.student.id}
                className="border-border hover:bg-muted/30 border-t transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/students/${item.student.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.student.fullName}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    @{item.student.username}
                    {!item.student.isActive ? " · Đã vô hiệu hóa" : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium">
                    {completionStatusLabels[item.completionStatus]}
                  </span>
                  {item.isOverdue && (
                    <span className="text-destructive ml-2 text-xs font-semibold">
                      Quá hạn
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {item.firstCompletion
                    ? examAvailabilityDateFormatter.format(
                        new Date(item.firstCompletion.submittedAt),
                      )
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {item.firstCompletion?.timeliness === "ON_TIME"
                    ? "Đúng hạn"
                    : item.firstCompletion?.timeliness === "LATE"
                      ? "Trễ hạn"
                      : "—"}
                </td>
                <td className="px-4 py-3">
                  {item.firstCompletion ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/admin/results/${item.firstCompletion.attemptId}`}
                      >
                        Xem lượt {item.firstCompletion.attemptNumber}
                      </Link>
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {report.students.length === 0 && (
              <tr className="border-border border-t">
                <td
                  colSpan={5}
                  className="text-muted-foreground px-4 py-10 text-center"
                >
                  Chưa có học sinh trong phạm vi phân công hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        pagination={report.pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
