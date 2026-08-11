"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  AnswerReview,
  ScoreSummary,
} from "@/components/student/attempt-result";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import { fetchAdminAttemptDetail } from "@/lib/api/reporting";
import { EXAM_ATTEMPT_STATUS } from "@/lib/constants/exam-attempt";
import { formatDuration, vietnamDateTimeFormatter } from "@/lib/formatting";
import type { StudentExamAttemptResult } from "@/types/exam-attempt";
import type { AdminAttemptDetail } from "@/types/reporting";

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải chi tiết lượt làm bài. Vui lòng thử lại.";
}

export function AdminAttemptDetailView({ attemptId }: { attemptId: string }) {
  const [detail, setDetail] = useState<AdminAttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminAttemptDetail(attemptId)
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
  }, [attemptId]);

  if (error) {
    return (
      <div className="border-border space-y-4 rounded-xl border p-6">
        <p role="alert" className="text-destructive">
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/results">Quay lại danh sách kết quả</Link>
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <p className="text-muted-foreground py-12 text-center" aria-live="polite">
        Đang tải chi tiết lượt làm bài...
      </p>
    );
  }

  const isTerminal = detail.attempt.status !== EXAM_ATTEMPT_STATUS.IN_PROGRESS;
  const result: StudentExamAttemptResult | null =
    isTerminal &&
    detail.score &&
    detail.attempt.submittedAt &&
    detail.attempt.timeUsedSeconds !== undefined
      ? {
          exam: {
            id: detail.exam?.id ?? "",
            title: detail.exam?.title ?? "Đề thi không còn tồn tại",
          },
          attempt: {
            id: detail.attempt.id,
            attemptNumber: detail.attempt.attemptNumber,
            status: detail.attempt.status,
            startedAt: detail.attempt.startedAt,
            expiresAt: detail.attempt.expiresAt,
            submittedAt: detail.attempt.submittedAt,
            timeUsedSeconds: detail.attempt.timeUsedSeconds,
          },
          visibility: { score: true, answers: Boolean(detail.answerReview) },
          score: detail.score,
          answerReview: detail.answerReview,
        }
      : null;

  return (
    <div className="space-y-8">
      <header className="border-border bg-background rounded-xl border p-6 shadow-sm">
        <p className="text-primary text-sm font-semibold">CHI TIẾT LƯỢT LÀM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {detail.exam?.title ?? "Đề thi không còn tồn tại"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {detail.student ? (
            <Link
              className="underline-offset-4 hover:underline"
              href={`/admin/students/${detail.student.id}`}
            >
              {detail.student.fullName} (@{detail.student.username})
            </Link>
          ) : (
            "Tài khoản học sinh đã xóa"
          )}{" "}
          · Lần làm {detail.attempt.attemptNumber}
        </p>
        <div className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            Bắt đầu:{" "}
            {vietnamDateTimeFormatter.format(
              new Date(detail.attempt.startedAt),
            )}
          </p>
          <p>
            {detail.attempt.submittedAt
              ? `Nộp bài: ${vietnamDateTimeFormatter.format(new Date(detail.attempt.submittedAt))}`
              : "Chưa nộp bài"}
          </p>
          <p>
            {detail.attempt.timeUsedSeconds !== undefined
              ? `Thời gian làm bài: ${formatDuration(detail.attempt.timeUsedSeconds)}`
              : `Hết giờ: ${vietnamDateTimeFormatter.format(new Date(detail.attempt.expiresAt))}`}
          </p>
        </div>
      </header>

      {!isTerminal && (
        <div className="border-primary/20 bg-primary/5 rounded-xl border p-6">
          <h2 className="font-semibold">Lượt làm bài đang diễn ra</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Đáp án đang làm không được hiển thị cho quản trị viên. Kết quả sẽ có
            sau khi học sinh nộp bài hoặc hết giờ.
          </p>
        </div>
      )}

      {result && <ScoreSummary result={result} />}
      {result && <AnswerReview result={result} />}

      <Button asChild variant="outline">
        <Link href="/admin/results">Quay lại danh sách kết quả</Link>
      </Button>
    </div>
  );
}
