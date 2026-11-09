"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ExamTable } from "@/components/admin/exam-table";
import { TableSkeleton } from "@/components/shared/loading-skeletons";
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
  deleteExamRecord,
  fetchExams,
  updateExamRecordStatus,
} from "@/lib/api/exams";
import type { ExamStatus, ExamSummary } from "@/types/exam";

function getRequestError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
    } else if (error.code === "FORBIDDEN") {
      window.location.replace("/");
    }

    return error.message;
  }

  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export function ExamManagement() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ExamSummary | null>(null);
  const createLinkRef = useRef<HTMLAnchorElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchExams()
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

  function refreshExams() {
    setIsLoading(true);
    setLoadError(null);
    setRefreshVersion((version) => version + 1);
  }

  async function handleStatusChange(
    exam: ExamSummary,
    status: ExamStatus,
    trigger: HTMLSelectElement,
  ) {
    if (isMutating || exam.status === status) {
      return;
    }

    setIsMutating(true);
    setActionError(null);
    setExams((currentExams) =>
      currentExams.map((currentExam) =>
        currentExam.id === exam.id ? { ...currentExam, status } : currentExam,
      ),
    );

    try {
      const response = await updateExamRecordStatus(exam.id, {
        status,
        expectedUpdatedAt: exam.updatedAt,
      });
      setExams((currentExams) =>
        currentExams.map((currentExam) =>
          currentExam.id === exam.id ? response.data.exam : currentExam,
        ),
      );
    } catch (error) {
      setExams((currentExams) =>
        currentExams.map((currentExam) =>
          currentExam.id === exam.id ? exam : currentExam,
        ),
      );
      setActionError(getRequestError(error));
    } finally {
      setIsMutating(false);
      requestAnimationFrame(() => {
        if (trigger.isConnected) {
          trigger.focus();
        }
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget || isMutating) {
      return;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      const response = await deleteExamRecord(deleteTarget.id, {
        expectedUpdatedAt: deleteTarget.updatedAt,
      });
      setExams((currentExams) =>
        currentExams.filter((exam) => exam.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setActionError(response.data.cleanupWarning);
    } catch (error) {
      setActionError(getRequestError(error));
      requestAnimationFrame(() => deleteButtonRef.current?.focus());
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="border-border flex flex-col gap-4 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase">
            Nội dung học tập
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Quản lý đề thi
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6 sm:text-base">
            Quản lý tệp PDF, đáp án và trạng thái hiển thị của đề Toán.
          </p>
        </div>
        <Button asChild>
          <Link ref={createLinkRef} href="/admin/exams/new">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-4 fill-none stroke-current stroke-2"
            >
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
            Tạo đề thi
          </Link>
        </Button>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isMutating) {
            setDeleteTarget(null);
            setActionError(null);
          }
        }}
      >
        {deleteTarget && (
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const trigger = deleteTriggerRef.current;

              if (trigger?.isConnected) {
                trigger.focus();
              } else {
                createLinkRef.current?.focus();
              }
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa đề thi</AlertDialogTitle>
              <AlertDialogDescription>
                Xóa vĩnh viễn “{deleteTarget.title}”, toàn bộ lượt làm bài, câu
                trả lời, điểm số, dữ liệu chấm bài, lịch sử, thống kê liên quan
                cùng tệp PDF đính kèm và tất cả ảnh bài tự luận đã tải lên? Tất
                cả dữ liệu này sẽ bị xóa vĩnh viễn và không thể khôi phục. Nếu
                chỉ muốn ngừng hiển thị đề, hãy chuyển đề sang trạng thái Đã ẩn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {actionError && (
              <p role="alert" className="text-destructive text-sm">
                {actionError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMutating}>Hủy</AlertDialogCancel>
              <Button
                ref={deleteButtonRef}
                type="button"
                variant="destructive"
                disabled={isMutating}
                onClick={() => void handleDelete()}
              >
                {isMutating ? "Đang xóa..." : "Xóa đề thi"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {actionError && !deleteTarget && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {actionError}
        </p>
      )}

      {loadError ? (
        <div className="border-border space-y-3 rounded-xl border p-5">
          <p role="alert" className="text-destructive text-sm">
            {loadError}
          </p>
          <Button type="button" variant="outline" onClick={refreshExams}>
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        <TableSkeleton columns={5} label="Đang tải danh sách đề thi" />
      ) : (
        <section aria-labelledby="exam-list-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="exam-list-heading" className="font-semibold">
                Danh sách đề thi
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {exams.length} đề thi
              </p>
            </div>
          </div>
          <ExamTable
            exams={exams}
            isBusy={isMutating}
            onStatusChange={(exam, status, trigger) =>
              void handleStatusChange(exam, status, trigger)
            }
            onDelete={(exam, trigger) => {
              setActionError(null);
              deleteTriggerRef.current = trigger;
              setDeleteTarget(exam);
            }}
          />
        </section>
      )}
    </div>
  );
}
