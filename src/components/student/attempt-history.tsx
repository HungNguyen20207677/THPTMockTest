"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatisticsSkeleton } from "@/components/shared/loading-skeletons";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchStudentExamAttemptHistory } from "@/lib/api/student-exams";
import {
  EXAM_ATTEMPT_GRADING_STATUS,
  EXAM_ATTEMPT_STATUS,
} from "@/lib/constants/exam-attempt";
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
              setError(null);
              setHistory(null);
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
      <StatisticsSkeleton label="Đang tải lịch sử làm bài" metricCount={0} />
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-border bg-card relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-7">
        <div
          className="bg-primary/80 absolute inset-y-0 left-0 w-1"
          aria-hidden="true"
        />
        <p className="text-primary text-xs font-semibold tracking-widest uppercase">
          Lịch sử làm bài
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {history.exam.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          Các lượt đã hoàn thành được sắp theo thời gian nộp gần nhất.
        </p>
      </header>

      {!history.visibility.score && history.attempts.length > 0 && (
        <div className="border-border bg-muted/50 rounded-xl border p-4 text-sm leading-6">
          Điểm số hiện chưa được công bố. Bạn vẫn có thể mở từng lượt để xem
          thông tin được phép hiển thị.
        </div>
      )}

      <div className="border-border hidden overflow-x-auto rounded-xl border shadow-xs md:block">
        <table className="w-full min-w-2xl border-collapse text-sm [&_td]:align-middle [&_th]:align-middle">
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
              <tr
                key={attempt.id}
                className="border-border hover:bg-muted/30 border-t transition-colors"
              >
                <td className="px-4 py-3 font-medium">
                  Lần {attempt.attemptNumber}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-muted inline-flex rounded-full px-2.5 py-1 text-xs font-medium">
                    {attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
                      ? "Tự động"
                      : "Chủ động"}
                  </span>
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
                  {attempt.gradingStatus ===
                  EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL
                    ? attempt.objectiveScore
                      ? `Chờ chấm · ${scoreFormatter.format(attempt.objectiveScore.earned)} / ${scoreFormatter.format(attempt.objectiveScore.maximum)}`
                      : "Bài tự luận đang chờ chấm"
                    : attempt.score === undefined
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

      <div className="space-y-3 md:hidden">
        {history.attempts.map((attempt) => (
          <article
            key={attempt.id}
            className="border-border bg-card rounded-xl border p-4 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Lần {attempt.attemptNumber}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Nộp{" "}
                  {vietnamDateTimeFormatter.format(
                    new Date(attempt.submittedAt),
                  )}
                </p>
              </div>
              <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-medium">
                {attempt.status === EXAM_ATTEMPT_STATUS.AUTO_SUBMITTED
                  ? "Tự động"
                  : "Chủ động"}
              </span>
            </div>
            <dl className="border-border mt-4 grid grid-cols-2 gap-3 border-y py-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Thời gian</dt>
                <dd className="mt-1 font-medium">
                  {formatDuration(attempt.timeUsedSeconds)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Điểm</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {attempt.gradingStatus ===
                  EXAM_ATTEMPT_GRADING_STATUS.PENDING_MANUAL
                    ? attempt.objectiveScore
                      ? `Chờ chấm · ${scoreFormatter.format(attempt.objectiveScore.earned)} / ${scoreFormatter.format(attempt.objectiveScore.maximum)}`
                      : "Đang chờ chấm"
                    : attempt.score === undefined
                      ? "Chưa công bố"
                      : scoreFormatter.format(attempt.score)}
                </dd>
              </div>
            </dl>
            <Button asChild size="sm" variant="outline" className="mt-4 w-full">
              <Link
                href={`/student/exams/${examId}/attempts/${attempt.id}/result`}
              >
                Xem kết quả
              </Link>
            </Button>
          </article>
        ))}
        {history.attempts.length === 0 && (
          <div className="border-border text-muted-foreground rounded-xl border px-4 py-10 text-center text-sm">
            Bạn chưa có lượt làm bài đã hoàn thành.
          </div>
        )}
      </div>

      <PaginationControls
        pagination={history.pagination}
        disabled={isLoading}
        onPageChange={(nextPage) => {
          setIsLoading(true);
          setPage(nextPage);
        }}
      />

      <div className="border-border border-t pt-6">
        <Button asChild variant="outline">
          <Link href="/student">Quay lại danh sách đề thi</Link>
        </Button>
      </div>
    </div>
  );
}
