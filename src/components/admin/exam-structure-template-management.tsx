"use client";

import { useEffect, useRef, useState } from "react";

import { ExamStructureTemplateForm } from "@/components/admin/exam-structure-template-form";
import { ExamStructureTemplateTable } from "@/components/admin/exam-structure-template-table";
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
  deleteExamStructureTemplateRecord,
  fetchExamStructureTemplates,
} from "@/lib/api/exam-structure-templates";
import type { ExamStructureTemplate } from "@/types/exam-structure-template";

type ActivePanel =
  { type: "create" } | { type: "edit"; template: ExamStructureTemplate } | null;

function getActionError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "UNAUTHENTICATED") {
      window.location.replace("/login");
      return "Phiên đăng nhập đã hết hạn.";
    }

    if (error.code === "FORBIDDEN") {
      window.location.replace("/");
      return "Bạn không còn quyền truy cập trang này.";
    }

    return error.message;
  }

  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export function ExamStructureTemplateManagement() {
  const [templates, setTemplates] = useState<ExamStructureTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<ExamStructureTemplate | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const formTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchExamStructureTemplates()
      .then((response) => {
        if (isCurrent) {
          setTemplates(response.data.templates);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(getActionError(error));
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

  function refreshTemplates() {
    setIsLoading(true);
    setLoadError(null);
    setRefreshVersion((version) => version + 1);
  }

  function handleSaved() {
    setActivePanel(null);
    setActionError(null);
    refreshTemplates();
    requestAnimationFrame(() => createButtonRef.current?.focus());
  }

  function closePanel() {
    setActivePanel(null);

    requestAnimationFrame(() => {
      const trigger = formTriggerRef.current;

      if (trigger?.isConnected) {
        trigger.focus();
      } else {
        createButtonRef.current?.focus();
      }
    });
  }

  async function handleDelete() {
    if (!deleteTarget || isMutating) {
      return;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      await deleteExamStructureTemplateRecord(deleteTarget.id, {
        expectedUpdatedAt: deleteTarget.updatedAt,
      });
      setTemplates((currentTemplates) =>
        currentTemplates.filter((template) => template.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setActivePanel(null);
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Mẫu cấu trúc đề thi
          </h1>
          <p className="text-muted-foreground mt-2">
            Tạo và quản lý cấu trúc phần, loại câu hỏi và điểm tối đa để tái sử
            dụng cho các đề thi.
          </p>
        </div>
        <Button
          ref={createButtonRef}
          type="button"
          disabled={isMutating}
          onClick={(event) => {
            formTriggerRef.current = event.currentTarget;
            setActivePanel({ type: "create" });
            setDeleteTarget(null);
          }}
        >
          Tạo mẫu cấu trúc
        </Button>
      </div>

      {activePanel?.type === "create" && (
        <ExamStructureTemplateForm
          key="create"
          onCancel={closePanel}
          onSaved={handleSaved}
        />
      )}
      {activePanel?.type === "edit" && (
        <ExamStructureTemplateForm
          key={activePanel.template.id}
          template={activePanel.template}
          onCancel={closePanel}
          onSaved={handleSaved}
        />
      )}

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
                createButtonRef.current?.focus();
              }
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa mẫu cấu trúc</AlertDialogTitle>
              <AlertDialogDescription>
                Xóa vĩnh viễn mẫu “{deleteTarget.name}”? Thao tác này không thể
                hoàn tác.
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
                type="button"
                variant="destructive"
                disabled={isMutating}
                onClick={() => void handleDelete()}
              >
                {isMutating ? "Đang xóa..." : "Xóa mẫu"}
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
          <Button type="button" variant="outline" onClick={refreshTemplates}>
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        <TableSkeleton columns={6} label="Đang tải danh sách mẫu cấu trúc" />
      ) : (
        <ExamStructureTemplateTable
          templates={templates}
          isBusy={isMutating || activePanel !== null}
          onEdit={(template, trigger) => {
            formTriggerRef.current = trigger;
            setActivePanel({ type: "edit", template });
            setDeleteTarget(null);
          }}
          onDelete={(template, trigger) => {
            setActionError(null);
            deleteTriggerRef.current = trigger;
            setDeleteTarget(template);
            setActivePanel(null);
          }}
        />
      )}
    </div>
  );
}
