"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchStudentExamAttemptHistory } from "@/lib/api/student-exams";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import {
  formatDuration,
  scoreFormatter,
  vietnamDateTimeFormatter,
} from "@/lib/formatting";
import type { StudentExamAttemptHistory } from "@/types/reporting";

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải lịch sử làm bài. Vui lòng thử lại.";
}

export function StudentAttemptHistory({ examId }: { examId: string }) {
  const [history, setHistory] = useState<StudentExamAttemptHistory | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    void fetchStudentExamAttemptHistory(examId, page)
      .then((response) => {
        if (isCurrent) {
          setHistory(response.data.history);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(getRequestError(requestError));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [examId, page, refreshVersion]);

  if (error) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {error}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsLoading(true);
              setRefreshVersion((version) => version + 1);
            }}
          >
            Thử lại
          </Button>
          <Button asChild variant="outline">
            <Link href="/student">Quay lại danh sách đề thi</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!history) {
    return (
      <p className="text-muted-foreground py-12 text-center" aria-live="polite">
        Đang tải lịch sử làm bài...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-border bg-background rounded-xl border p-6 shadow-sm">
        <p className="text-primary text-sm font-semibold">LỊCH SỬ LÀM BÀI</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {history.exam.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          Các lượt đã hoàn thành được sắp theo thời gian nộp gần nhất.
        </p>
      </header>

      {!history.visibility.score && history.attempts.length > 0 && (
        <div className="bg-muted rounded-xl p-4 text-sm">
          Điểm số hiện chưa được công bố. Bạn vẫn có thể mở từng lượt để xem
          thông tin được phép hiển thị.
        </div>
      )}

      <div className="border-border overflow-x-auto rounded-xl border">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead className="bg-muted/70">
            <tr>
              {[
                "Lần làm",
                "Cách nộp",
                "Bắt đầu",
                "Nộp bài",
                "Thời gian",
                "Điểm",
                "",
              ].map((heading, index) => (
                <th
                  key={`${heading}-${index}`}
                  scope="col"
                  className="px-4 py-3 text-left font-semibold"
                >
                  {heading || <span className="sr-only">Thao tác</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.attempts.map((attempt) => (
              <tr key={attempt.id} className="border-border border-t">
                <td className="px-4 py-3 font-medium">
                  Lần {attempt.attemptNumber}
                </td>
                <td className="px-4 py-3">
                  {attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
                    ? "Tự động khi hết giờ"
                    : "Chủ động"}
                </td>
                <td className="px-4 py-3">
                  {vietnamDateTimeFormatter.format(new Date(attempt.startedAt))}
                </td>
                <td className="px-4 py-3">
                  {vietnamDateTimeFormatter.format(
                    new Date(attempt.submittedAt),
                  )}
                </td>
                <td className="px-4 py-3">
                  {formatDuration(attempt.timeUsedSeconds)}
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">
                  {attempt.score === undefined
                    ? "Chưa công bố"
                    : scoreFormatter.format(attempt.score)}
                </td>
                <td className="px-4 py-3">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/student/exams/${examId}/attempts/${attempt.id}/result`}
                      aria-label={`Xem kết quả lần làm ${attempt.attemptNumber}`}
                    >
                      Xem kết quả
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {history.attempts.length === 0 && (
              <tr className="border-border border-t">
                <td
                  colSpan={7}
                  className="text-muted-foreground px-4 py-10 text-center"
                >
                  Bạn chưa có lượt làm bài đã hoàn thành.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        pagination={history.pagination}
        disabled={isLoading}
        onPageChange={(nextPage) => {
          setIsLoading(true);
          setPage(nextPage);
        }}
      />

      <Button asChild variant="outline">
        <Link href="/student">Quay lại danh sách đề thi</Link>
      </Button>
    </div>
  );
}
