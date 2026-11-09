"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ExamCardsSkeleton } from "@/components/shared/loading-skeletons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api/client";
import {
  fetchStudentExams,
  startStudentExamAttempt,
} from "@/lib/api/student-exams";
import { STUDENT_EXAM_STATE } from "@/lib/constants/exam-attempt";
import { createConfirmedExamStart } from "@/lib/exam/start-flow";
import {
  exitDocumentFullscreen,
  isDocumentElementFullscreen,
  requestDocumentFullscreen,
} from "@/lib/fullscreen";
import type {
  StudentExamState,
  StudentExamSummary,
} from "@/types/exam-attempt";

const stateLabels: Record<StudentExamState, string> = {
  IN_PROGRESS: "Đang làm",
  NOT_STARTED: "Chưa làm",
  COMPLETED: "Đã hoàn thành",
};

const stateClassNames: Record<StudentExamState, string> = {
  IN_PROGRESS: "bg-primary/10 text-primary ring-primary/20 ring-1",
  NOT_STARTED:
    "bg-blue-50 text-blue-700 ring-blue-200 ring-1 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-800",
  COMPLETED:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 ring-1 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800",
};

const stateCardClassNames: Record<StudentExamState, string> = {
  IN_PROGRESS: "border-primary/40 bg-primary/[0.025]",
  NOT_STARTED: "border-border bg-card",
  COMPLETED: "border-border bg-card",
};

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể tải danh sách đề thi. Vui lòng thử lại.";
}

function getAttemptHref(examId: string, attemptId: string): string {
  return `/student/exams/${examId}/attempts/${attemptId}`;
}

function getResultHref(examId: string, attemptId: string): string {
  return `${getAttemptHref(examId, attemptId)}/result`;
}

export function StudentExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<StudentExamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const [startTarget, setStartTarget] = useState<StudentExamSummary | null>(
    null,
  );
  const [isStarting, setIsStarting] = useState(false);
  const startTriggerRef = useRef<HTMLButtonElement | null>(null);
  const startInFlightRef = useRef(false);

  useEffect(() => {
    let isCurrent = true;

    void fetchStudentExams()
      .then((response) => {
        if (isCurrent) {
          setExams(response.data.exams);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(getRequestError(error));
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
  }, [refreshVersion]);

  async function handleConfirmedStart() {
    if (!startTarget || startInFlightRef.current) {
      return;
    }

    startInFlightRef.current = true;
    const target = startTarget;
    const confirmStart = createConfirmedExamStart({
      wasDocumentFullscreen: isDocumentElementFullscreen(),
      requestFullscreen: requestDocumentFullscreen,
      startAttempt: () =>
        startStudentExamAttempt(
          target.id,
          target.state === STUDENT_EXAM_STATE.IN_PROGRESS
            ? target.activeAttemptId
            : undefined,
        ),
      exitFullscreen: exitDocumentFullscreen,
    });
    setIsStarting(true);
    setStartError(null);
    let navigationStarted = false;

    try {
      const response = await confirmStart();
      const { attempt } = response.data.context;
      router.push(getAttemptHref(target.id, attempt.id));
      navigationStarted = true;
    } catch (error) {
      setStartError(getRequestError(error));

      if (
        error instanceof ApiClientError &&
        (error.code === "EXAM_NOT_FOUND" ||
          error.code === "EXAM_NOT_PUBLISHED" ||
          error.code === "EXAM_RETAKE_NOT_ALLOWED")
      ) {
        setStartTarget(null);
        setIsLoading(true);
        setLoadError(null);
        setRefreshVersion((version) => version + 1);
      }
    } finally {
      if (!navigationStarted) {
        startInFlightRef.current = false;
        setIsStarting(false);
      }
    }
  }

  if (isLoading) {
    return <ExamCardsSkeleton />;
  }

  if (loadError) {
    return (
      <div className="border-border space-y-3 rounded-xl border p-5">
        <p role="alert" className="text-destructive text-sm">
          {loadError}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsLoading(true);
            setLoadError(null);
            setRefreshVersion((version) => version + 1);
          }}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  const stateCounts = exams.reduce(
    (counts, exam) => {
      counts[exam.state] += 1;
      return counts;
    },
    {
      [STUDENT_EXAM_STATE.IN_PROGRESS]: 0,
      [STUDENT_EXAM_STATE.NOT_STARTED]: 0,
      [STUDENT_EXAM_STATE.COMPLETED]: 0,
    },
  );

  return (
    <>
      <AlertDialog
        open={Boolean(startTarget)}
        onOpenChange={(open) => {
          if (!open && !isStarting) {
            setStartTarget(null);
            setStartError(null);
          }
        }}
      >
        {startTarget && (
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              startTriggerRef.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {startTarget.state === STUDENT_EXAM_STATE.COMPLETED
                  ? "Xác nhận làm lại"
                  : startTarget.state === STUDENT_EXAM_STATE.IN_PROGRESS
                    ? "Xác nhận tiếp tục làm bài"
                    : "Xác nhận bắt đầu làm bài"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {startTarget.state === STUDENT_EXAM_STATE.IN_PROGRESS
                  ? "Thời gian làm bài vẫn đang tiếp tục. Sau khi xác nhận, trình duyệt sẽ thử mở chế độ toàn màn hình và đưa bạn trở lại bài thi. Thoát bằng Esc hoặc điều khiển của trình duyệt sẽ tự động nộp bài ngay."
                  : "Thời gian làm bài là 90 phút. Sau khi xác nhận, thời gian bắt đầu tính ngay và trình duyệt sẽ thử mở chế độ toàn màn hình. Tải lại trang hoặc đóng trình duyệt không làm dừng thời gian. Thoát bằng Esc hoặc điều khiển của trình duyệt sẽ tự động nộp bài ngay."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {startError && (
              <p role="alert" className="text-destructive text-sm">
                {startError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isStarting}>Hủy</AlertDialogCancel>
              <Button
                type="button"
                disabled={isStarting}
                onClick={() => void handleConfirmedStart()}
              >
                {isStarting ? "Đang mở bài thi..." : "Xác nhận"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {startError && !startTarget && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-md border px-4 py-3 text-sm"
        >
          {startError}
        </p>
      )}

      <section aria-labelledby="available-exams-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="available-exams-heading" className="text-lg font-semibold">
              Đề thi của bạn
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Tiếp tục bài đang làm hoặc chọn một đề mới để bắt đầu.
            </p>
          </div>
          {exams.length > 0 && (
            <div
              className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
              aria-label="Tổng hợp trạng thái đề thi"
            >
              <span>
                <strong className="text-foreground tabular-nums">
                  {stateCounts.IN_PROGRESS}
                </strong>{" "}
                đang làm
              </span>
              <span>
                <strong className="text-foreground tabular-nums">
                  {stateCounts.NOT_STARTED}
                </strong>{" "}
                chưa làm
              </span>
              <span>
                <strong className="text-foreground tabular-nums">
                  {stateCounts.COMPLETED}
                </strong>{" "}
                hoàn thành
              </span>
            </div>
          )}
        </div>

        {exams.length === 0 ? (
          <div className="border-border bg-card rounded-lg border border-dashed px-6 py-12 text-center">
            <div className="bg-muted text-muted-foreground mx-auto flex size-10 items-center justify-center rounded-full">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5 fill-none stroke-current stroke-2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6M8 13h8M8 17h5" />
              </svg>
            </div>
            <p className="mt-4 font-medium">Chưa có đề thi đang mở.</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm leading-6">
              Các đề đã xuất bản dành cho bạn sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {exams.map((exam) => (
              <article
                key={exam.id}
                className={`flex flex-col rounded-lg border p-5 shadow-xs transition-[border-color,box-shadow] hover:shadow-sm ${stateCardClassNames[exam.state]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs font-medium">
                      Đề thi Toán · {exam.durationMinutes} phút
                    </p>
                    <h3 className="mt-1.5 text-lg leading-6 font-semibold">
                      {exam.title}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${stateClassNames[exam.state]}`}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {stateLabels[exam.state]}
                  </span>
                </div>
                {exam.description && (
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-6">
                    {exam.description}
                  </p>
                )}

                {exam.state === STUDENT_EXAM_STATE.IN_PROGRESS && (
                  <p className="border-primary/20 bg-primary/5 text-primary mt-4 rounded-md border px-3 py-2 text-sm font-medium">
                    Thời gian làm bài đang tiếp tục được tính.
                  </p>
                )}

                <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {exam.completedAttemptCount > 0 && (
                    <span>{exam.completedAttemptCount} lượt đã hoàn thành</span>
                  )}
                  {exam.completedAttemptCount > 0 &&
                    exam.state === STUDENT_EXAM_STATE.COMPLETED && (
                      <span aria-hidden="true">·</span>
                    )}
                  {exam.state === STUDENT_EXAM_STATE.COMPLETED && (
                    <span>
                      {!exam.isAvailable
                        ? "Đề thi đã đóng"
                        : exam.allowRetake
                          ? "Có thể làm lại"
                          : "Không cho phép làm lại"}
                    </span>
                  )}
                </div>

                <div className="border-border mt-auto flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
                  {exam.state === STUDENT_EXAM_STATE.IN_PROGRESS &&
                    exam.activeAttemptId && (
                      <Button
                        type="button"
                        className="sm:mr-auto"
                        onClick={(event) => {
                          startTriggerRef.current = event.currentTarget;
                          setStartError(null);
                          setStartTarget(exam);
                        }}
                      >
                        Tiếp tục làm bài
                        <span aria-hidden="true">→</span>
                      </Button>
                    )}
                  {exam.state === STUDENT_EXAM_STATE.NOT_STARTED && (
                    <Button
                      type="button"
                      className="sm:mr-auto"
                      onClick={(event) => {
                        startTriggerRef.current = event.currentTarget;
                        setStartError(null);
                        setStartTarget(exam);
                      }}
                    >
                      Bắt đầu làm bài
                      <span aria-hidden="true">→</span>
                    </Button>
                  )}
                  {exam.state === STUDENT_EXAM_STATE.COMPLETED &&
                    exam.latestCompletedAttemptId && (
                      <Button asChild className="sm:mr-auto">
                        <Link
                          href={getResultHref(
                            exam.id,
                            exam.latestCompletedAttemptId,
                          )}
                        >
                          Xem kết quả
                        </Link>
                      </Button>
                    )}
                  {exam.completedAttemptCount > 0 && (
                    <Button asChild variant="outline">
                      <Link href={`/student/exams/${exam.id}/history`}>
                        Lịch sử
                      </Link>
                    </Button>
                  )}
                  {exam.state === STUDENT_EXAM_STATE.COMPLETED &&
                    exam.isAvailable &&
                    exam.allowRetake && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(event) => {
                          startTriggerRef.current = event.currentTarget;
                          setStartError(null);
                          setStartTarget(exam);
                        }}
                      >
                        Làm lại
                      </Button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
