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
  IN_PROGRESS: "bg-primary/10 text-primary",
  NOT_STARTED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-emerald-100 text-emerald-800",
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

    try {
      const response = await confirmStart();
      const { attempt } = response.data.context;
      router.push(getAttemptHref(target.id, attempt.id));
    } catch (error) {
      setStartError(getRequestError(error));
    } finally {
      startInFlightRef.current = false;
      setIsStarting(false);
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
                  ? "Thời gian làm bài vẫn đang tiếp tục. Sau khi xác nhận, trình duyệt sẽ thử mở chế độ toàn màn hình và đưa bạn trở lại bài thi."
                  : "Thời gian làm bài là 90 phút. Sau khi xác nhận, thời gian bắt đầu tính ngay và trình duyệt sẽ thử mở chế độ toàn màn hình. Tải lại trang hoặc đóng trình duyệt không làm dừng thời gian."}
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

      {exams.length === 0 ? (
        <div className="border-border bg-background rounded-xl border p-8 text-center shadow-sm">
          <p className="font-medium">Chưa có đề thi đang mở.</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Các đề đã xuất bản sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {exams.map((exam) => (
            <article
              key={exam.id}
              className="border-border bg-background flex flex-col rounded-xl border p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{exam.title}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stateClassNames[exam.state]}`}
                >
                  {stateLabels[exam.state]}
                </span>
              </div>
              {exam.description && (
                <p className="text-muted-foreground mt-3 line-clamp-3 text-sm leading-6">
                  {exam.description}
                </p>
              )}
              <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>{exam.durationMinutes} phút</span>
                {exam.completedAttemptCount > 0 && (
                  <span>Đã hoàn thành {exam.completedAttemptCount} lần</span>
                )}
                {exam.state === STUDENT_EXAM_STATE.COMPLETED && (
                  <span>
                    {!exam.isAvailable
                      ? "Đề thi đã đóng"
                      : exam.allowRetake
                        ? "Được phép làm lại"
                        : "Không cho phép làm lại"}
                  </span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {exam.state === STUDENT_EXAM_STATE.IN_PROGRESS &&
                  exam.activeAttemptId && (
                    <Button
                      type="button"
                      onClick={(event) => {
                        startTriggerRef.current = event.currentTarget;
                        setStartError(null);
                        setStartTarget(exam);
                      }}
                    >
                      Tiếp tục làm bài
                    </Button>
                  )}
                {exam.state === STUDENT_EXAM_STATE.NOT_STARTED && (
                  <Button
                    type="button"
                    onClick={(event) => {
                      startTriggerRef.current = event.currentTarget;
                      setStartError(null);
                      setStartTarget(exam);
                    }}
                  >
                    Bắt đầu làm bài
                  </Button>
                )}
                {exam.state === STUDENT_EXAM_STATE.COMPLETED &&
                  exam.latestCompletedAttemptId && (
                    <Button asChild>
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
                      Lịch sử làm bài
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
    </>
  );
}
