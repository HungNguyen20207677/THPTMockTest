"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ExamTable } from "@/components/admin/exam-table";
import { BulkDeleteConfirmationDialog } from "@/components/admin/bulk-delete-confirmation-dialog";
import { BulkSelectionToolbar } from "@/components/admin/bulk-selection-toolbar";
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
  bulkDeleteExamRecords,
  deleteExamRecord,
  fetchExams,
  updateExamRecordStatus,
} from "@/lib/api/exams";
import {
  formatBulkDeletionResult,
  getDeletedBulkItemIds,
} from "@/lib/bulk-deletion-result";
import { MAX_ADMIN_BULK_DELETE_ITEMS } from "@/lib/validations/bulk-deletion";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkReport, setBulkReport] = useState<string | null>(null);
  const createLinkRef = useRef<HTMLAnchorElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchExams()
      .then((response) => {
        if (isCurrent) {
          setExams(response.data.exams);
          setSelectedIds(new Set());
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

  function toggleSelected(examId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(examId)) next.delete(examId);
      else next.add(examId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const allSelected =
        exams.length > 0 && exams.every((exam) => current.has(exam.id));
      return allSelected ? new Set() : new Set(exams.map((exam) => exam.id));
    });
  }

  async function handleBulkDelete() {
    const selected = exams.filter((exam) => selectedIds.has(exam.id));
    if (selected.length === 0 || isMutating) return;
    setIsMutating(true);
    setActionError(null);
    setBulkReport(null);
    try {
      const response = await bulkDeleteExamRecords(
        selected.map((exam) => ({
          id: exam.id,
          expectedUpdatedAt: exam.updatedAt,
        })),
      );
      const deletedIds = getDeletedBulkItemIds(response.data);
      setExams((current) => current.filter((exam) => !deletedIds.has(exam.id)));
      setSelectedIds(
        new Set(
          response.data.items
            .filter((item) => !deletedIds.has(item.id))
            .map((item) => item.id),
        ),
      );
      setBulkReport(
        formatBulkDeletionResult(
          response.data,
          new Map(selected.map((exam) => [exam.id, exam.title])),
        ),
      );
      setIsBulkDeleteOpen(false);
    } catch (error) {
      setActionError(getRequestError(error));
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

      <BulkDeleteConfirmationDialog
        open={isBulkDeleteOpen}
        count={selectedIds.size}
        entityLabel="đề thi"
        description="Xóa vĩnh viễn các đề đã chọn cùng lượt làm bài, PDF đề, PDF lời giải và ảnh bài tự luận liên quan?"
        isPending={isMutating}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={() => void handleBulkDelete()}
      />

      {actionError && !deleteTarget && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {actionError}
        </p>
      )}
      {bulkReport && (
        <p
          role="status"
          className="border-border bg-muted/30 whitespace-pre-line rounded-md border px-4 py-3 text-sm"
        >
          {bulkReport}
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
          <BulkSelectionToolbar
            selectedCount={selectedIds.size}
            entityLabel="đề thi"
            isBusy={isMutating}
            deleteDisabled={selectedIds.size > MAX_ADMIN_BULK_DELETE_ITEMS}
            onClear={() => setSelectedIds(new Set())}
            onDelete={() => setIsBulkDeleteOpen(true)}
          />
          <ExamTable
            exams={exams}
            isBusy={isMutating}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleAll={toggleAll}
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
