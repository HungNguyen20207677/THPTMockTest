"use client";

import { useEffect, useRef, useState } from "react";

import {
  CreateStudentForm,
  EditStudentForm,
  ResetPasswordForm,
} from "@/components/admin/student-forms";
import { StudentTable } from "@/components/admin/student-table";
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
  deleteStudentAccount,
  fetchStudents,
  updateStudentAccountStatus,
} from "@/lib/api/students";
import type { StudentAccount } from "@/types/user";

type ActivePanel =
  | { type: "create" }
  | { type: "edit"; student: StudentAccount }
  | { type: "password"; student: StudentAccount }
  | null;

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

export function StudentManagement() {
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentAccount | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const formTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void fetchStudents()
      .then((response) => {
        if (isCurrent) {
          setStudents(response.data.students);
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

  function refreshStudents() {
    setIsLoading(true);
    setLoadError(null);
    setRefreshVersion((version) => version + 1);
  }

  function handleSaved() {
    setActivePanel(null);
    setActionError(null);
    refreshStudents();
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

  async function handleToggleStatus(student: StudentAccount) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      await updateStudentAccountStatus(student.id, {
        isActive: !student.isActive,
      });
      refreshStudents();
    } catch (error) {
      setActionError(getActionError(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || isMutating) {
      return;
    }

    setIsMutating(true);
    setActionError(null);

    try {
      await deleteStudentAccount(deleteTarget.id);
      setDeleteTarget(null);
      setActivePanel(null);
      refreshStudents();
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
            Quản lý học sinh
          </h1>
          <p className="text-muted-foreground mt-2">
            Tạo và quản lý tài khoản dùng để đăng nhập hệ thống.
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
          Tạo học sinh
        </Button>
      </div>

      {activePanel?.type === "create" && (
        <CreateStudentForm onCancel={closePanel} onSaved={handleSaved} />
      )}
      {activePanel?.type === "edit" && (
        <EditStudentForm
          key={activePanel.student.id}
          student={activePanel.student}
          onCancel={closePanel}
          onSaved={handleSaved}
        />
      )}
      {activePanel?.type === "password" && (
        <ResetPasswordForm
          key={activePanel.student.id}
          student={activePanel.student}
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
              <AlertDialogTitle>Xác nhận xóa tài khoản</AlertDialogTitle>
              <AlertDialogDescription>
                Xóa vĩnh viễn tài khoản {deleteTarget.fullName} (@
                {deleteTarget.username}) cùng toàn bộ lượt làm bài, lịch sử và
                kết quả của học sinh này? Tài khoản và tất cả dữ liệu liên quan
                sẽ bị xóa vĩnh viễn, không thể khôi phục. Nếu chỉ muốn ngăn đăng
                nhập và giữ lại dữ liệu, hãy khóa tài khoản.
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
                {isMutating ? "Đang xóa..." : "Xóa tài khoản"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {actionError && !deleteTarget && (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {actionError}
        </p>
      )}

      {loadError ? (
        <div className="border-border space-y-3 rounded-xl border p-5">
          <p role="alert" className="text-destructive text-sm">
            {loadError}
          </p>
          <Button type="button" variant="outline" onClick={refreshStudents}>
            Thử lại
          </Button>
        </div>
      ) : isLoading ? (
        <p
          className="text-muted-foreground py-8 text-center"
          aria-live="polite"
        >
          Đang tải danh sách học sinh...
        </p>
      ) : (
        <StudentTable
          students={students}
          isBusy={isMutating || activePanel !== null}
          onEdit={(student, trigger) => {
            formTriggerRef.current = trigger;
            setActivePanel({ type: "edit", student });
            setDeleteTarget(null);
          }}
          onResetPassword={(student, trigger) => {
            formTriggerRef.current = trigger;
            setActivePanel({ type: "password", student });
            setDeleteTarget(null);
          }}
          onToggleStatus={(student) => void handleToggleStatus(student)}
          onDelete={(student, trigger) => {
            setActionError(null);
            deleteTriggerRef.current = trigger;
            setDeleteTarget(student);
            setActivePanel(null);
          }}
        />
      )}
    </div>
  );
}
