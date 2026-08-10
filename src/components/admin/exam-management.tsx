"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ExamTable } from "@/components/admin/exam-table";
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
      await deleteExamRecord(deleteTarget.id, {
        expectedUpdatedAt: deleteTarget.updatedAt,
      });
      setExams((currentExams) =>
        currentExams.filter((exam) => exam.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
    } catch (error) {
      setActionError(getRequestError(error));
      requestAnimationFrame(() => deleteButtonRef.current?.focus());
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý đề thi</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý tệp PDF, đáp án và trạng thái hiển thị của đề Toán.
          </p>
        </div>
        <Button asChild>
          <Link ref={createLinkRef} href="/admin/exams/new">
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
                Xóa vĩnh viễn “{deleteTarget.title}” và tệp PDF đính kèm? Thao
                tác này không thể hoàn tác.
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
        <p
          className="text-muted-foreground py-10 text-center"
          aria-live="polite"
        >
          Đang tải danh sách đề thi...
        </p>
      ) : (
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
      )}
    </div>
  );
}
